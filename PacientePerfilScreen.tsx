import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useLanguage } from './localization/LanguageContext';
import type { RootStackParamList } from './navigation/types';
import { apiUrl } from './config/backend';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';
const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';
const MIN_REFRESH_INTERVAL_MS = 15000;

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  light: '#B3CFE5',
  white: '#FFFFFF',
  success: '#16a34a',
};

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

type User = {
  id?: number | string;
  nombres?: string;
  apellidos?: string;
  nombre?: string;
  apellido?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  plan?: string;
  fotoUrl?: string;
  fechanacimiento?: string;
  genero?: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  tipoSangre?: string;
  alergias?: string;
  medicamentos?: string;
  antecedentes?: string;
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;
  contactoEmergenciaParentesco?: string;
  recibirEmail?: boolean;
  recibirSMS?: boolean;
  compartirHistorial?: boolean;
};

type ProfileForm = {
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  cedula: string;
  fechaNacimiento: string;
  genero: string;
  direccion: string;
  tipoSangre: string;
  alergias: string;
  medicamentos: string;
  antecedentes: string;
  emergenciaNombre: string;
  emergenciaTelefono: string;
  emergenciaParentesco: string;
  recibirEmail: boolean;
  recibirSMS: boolean;
  compartirHistorial: boolean;
  confirmPassword: string;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeValue = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeDigits = (value: unknown, maxLength: number) =>
  String(value || '')
    .replace(/\D/g, '')
    .slice(0, maxLength);

const toComparableSqlDate = (rawValue: unknown) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (isoPrefix?.[1]) return isoPrefix[1];

  const parts = raw.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (/^\d+$/.test(dd) && /^\d+$/.test(mm) && /^\d+$/.test(yyyy)) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const sanitizeFotoUrl = (value: unknown) => {
  const clean = normalizeValue(value);
  if (!clean) return '';
  if (clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};

const buildPersistentPhotoUri = (asset: ImagePicker.ImagePickerAsset | undefined): string => {
  if (!asset) return '';

  const base64 = normalizeValue((asset as any)?.base64);
  if (base64) {
    const mimeRaw = normalizeValue((asset as any)?.mimeType).toLowerCase();
    const mimeType = mimeRaw.startsWith('image/') ? mimeRaw : 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  }

  return normalizeValue(asset.uri);
};

const toWebDataUrl = async (uri: string): Promise<string> => {
  if (Platform.OS !== 'web') return uri;
  const cleanUri = normalizeValue(uri);
  if (!cleanUri || cleanUri.startsWith('data:image/')) return cleanUri;

  try {
    const response = await fetch(cleanUri);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
          resolve(reader.result);
          return;
        }
        resolve(cleanUri);
      };
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(blob);
    });
    return normalizeValue(dataUrl);
  } catch {
    return cleanUri;
  }
};

const ProfileField: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
}> = ({ label, value, onChangeText, placeholder, multiline, secureTextEntry }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#8aa7bf"
      multiline={multiline}
      secureTextEntry={Boolean(secureTextEntry)}
      style={[styles.input, multiline && styles.inputMultiline]}
    />
  </View>
);

const ProfileCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

const PacientePerfilScreen: React.FC = () => {

  const { t, tx } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [bloodTypeOpen, setBloodTypeOpen] = useState(false);
  const selectingBloodTypeRef = useRef(false);
  const lastRefreshRef = useRef(0);
  const [form, setForm] = useState<ProfileForm>({
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    cedula: '',
    fechaNacimiento: '',
    genero: '',
    direccion: '',
    tipoSangre: '',
    alergias: '',
    medicamentos: '',
    antecedentes: '',
    emergenciaNombre: '',
    emergenciaTelefono: '',
    emergenciaParentesco: '',
    recibirEmail: true,
    recibirSMS: true,
    compartirHistorial: false,
    confirmPassword: '',
  });

  const getAuthToken = useCallback(async () => {
    const storageToken =
      Platform.OS === 'web'
        ? localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
        : (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
          (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
    const asyncToken =
      (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
      (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    return normalizeValue(storageToken || asyncToken);
  }, []);

  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    try {
      const rawUserFromStorage =
        Platform.OS === 'web'
          ? localStorage.getItem(LEGACY_USER_STORAGE_KEY)
          : await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY);
      const rawUserFromAsync = await AsyncStorage.getItem(STORAGE_KEY);
      const storageUser = ensurePatientSessionUser(parseUser(rawUserFromStorage) || parseUser(rawUserFromAsync));
      const token = await getAuthToken();

      let nextUser = storageUser;
      if (token) {
        try {
          const response = await fetch(apiUrl('/api/users/me/paciente-profile'), {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const payload = await response.json().catch(() => null);
          if (response.ok && payload?.success && payload?.profile) {
            const profile = payload.profile;
            nextUser = {
              ...(storageUser || {}),
              email: normalizeValue(profile.email || storageUser?.email),
              nombres: normalizeValue(profile.nombres || storageUser?.nombres),
              apellidos: normalizeValue(profile.apellidos || storageUser?.apellidos),
              nombre: normalizeValue(profile.nombres || storageUser?.nombre),
              apellido: normalizeValue(profile.apellidos || storageUser?.apellido),
              fechanacimiento: normalizeValue(profile.fechanacimiento || storageUser?.fechanacimiento),
              genero: normalizeValue(profile.genero || storageUser?.genero),
              cedula: normalizeValue(profile.cedula || storageUser?.cedula),
              telefono: normalizeValue(profile.telefono || storageUser?.telefono),
              direccion: normalizeValue(profile.direccion || storageUser?.direccion),
              tipoSangre: normalizeValue(profile.tipoSangre || storageUser?.tipoSangre),
              alergias: normalizeValue(profile.alergias || storageUser?.alergias),
              medicamentos: normalizeValue(profile.medicamentos || storageUser?.medicamentos),
              antecedentes: normalizeValue(profile.antecedentes || storageUser?.antecedentes),
              contactoEmergenciaNombre: normalizeValue(
                profile.contactoEmergenciaNombre || storageUser?.contactoEmergenciaNombre
              ),
              contactoEmergenciaTelefono: normalizeValue(
                profile.contactoEmergenciaTelefono || storageUser?.contactoEmergenciaTelefono
              ),
              contactoEmergenciaParentesco: normalizeValue(
                profile.contactoEmergenciaParentesco || storageUser?.contactoEmergenciaParentesco
              ),
              fotoUrl: sanitizeFotoUrl(profile.fotoUrl || storageUser?.fotoUrl),
              recibirEmail: Boolean(
                Object.prototype.hasOwnProperty.call(profile, 'recibirEmail')
                  ? profile.recibirEmail
                  : storageUser?.recibirEmail ?? true
              ),
              recibirSMS: Boolean(
                Object.prototype.hasOwnProperty.call(profile, 'recibirSMS')
                  ? profile.recibirSMS
                  : storageUser?.recibirSMS ?? true
              ),
              compartirHistorial: Boolean(
                Object.prototype.hasOwnProperty.call(profile, 'compartirHistorial')
                  ? profile.compartirHistorial
                  : storageUser?.compartirHistorial ?? false
              ),
            };
          }
        } catch {
          // Fallback to local storage.
        }
      }

      setUser(nextUser);
      if (nextUser) {
        const raw = JSON.stringify(nextUser);
        try {
          await AsyncStorage.setItem(STORAGE_KEY, raw);
          await AsyncStorage.setItem('user', raw);
        } catch {}
        try {
          if (Platform.OS === 'web') {
            localStorage.setItem(LEGACY_USER_STORAGE_KEY, raw);
            localStorage.setItem('user', raw);
          } else {
            await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, raw);
          }
        } catch {}
      }
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, [getAuthToken]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshRef.current = now;
      loadUser();
    }, [loadUser])
  );

  useEffect(() => {
    if (!user) return;

    setForm((prev) => ({
      ...prev,
      nombres: user.nombres || user.nombre || user.firstName || '',
      apellidos: user.apellidos || user.apellido || user.lastName || '',
      email: user.email || '',
      telefono: user.telefono || '',
      cedula: user.cedula || '',
      fechaNacimiento: user.fechanacimiento || '',
      genero: user.genero || '',
      direccion: user.direccion || '',
      tipoSangre: user.tipoSangre || '',
      alergias: user.alergias || '',
      medicamentos: user.medicamentos || '',
      antecedentes: user.antecedentes || '',
      emergenciaNombre: user.contactoEmergenciaNombre || '',
      emergenciaTelefono: user.contactoEmergenciaTelefono || '',
      emergenciaParentesco: user.contactoEmergenciaParentesco || '',
      recibirEmail:
        typeof user.recibirEmail === 'boolean' ? user.recibirEmail : prev.recibirEmail,
      recibirSMS: typeof user.recibirSMS === 'boolean' ? user.recibirSMS : prev.recibirSMS,
      compartirHistorial:
        typeof user.compartirHistorial === 'boolean'
          ? user.compartirHistorial
          : prev.compartirHistorial,
    }));
  }, [user]);

  const fullName = useMemo(() => {
    const name = `${form.nombres} ${form.apellidos}`.trim();
    return name || getPatientDisplayName(user, 'Paciente');
  }, [form.apellidos, form.nombres, user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user?.plan]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    const fotoUrl = sanitizeFotoUrl(user?.fotoUrl);
    if (fotoUrl) {
      return { uri: fotoUrl };
    }
    return DefaultAvatar;
  }, [user?.fotoUrl]);
  const hasProfilePhoto = useMemo(() => Boolean(sanitizeFotoUrl(user?.fotoUrl)), [user?.fotoUrl]);
  const requiresSensitiveConfirmation = useMemo(() => {
    if (!user) return false;

    const previousEmail = normalizeValue(user.email).toLowerCase();
    const nextEmail = normalizeValue(form.email).toLowerCase();
    const previousCedula = normalizeDigits(user.cedula, 11);
    const nextCedula = normalizeDigits(form.cedula, 11);
    const previousTelefono = normalizeDigits(user.telefono, 15);
    const nextTelefono = normalizeDigits(form.telefono, 15);
    const previousFechaNacimiento = toComparableSqlDate(user.fechanacimiento);
    const nextFechaNacimiento = toComparableSqlDate(form.fechaNacimiento);

    return (
      previousEmail !== nextEmail ||
      previousCedula !== nextCedula ||
      previousTelefono !== nextTelefono ||
      previousFechaNacimiento !== nextFechaNacimiento
    );
  }, [form.cedula, form.email, form.fechaNacimiento, form.telefono, user]);

  const updateField = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const filteredBloodTypes = useMemo(() => {
    const query = form.tipoSangre.trim().toUpperCase();
    if (!query) return BLOOD_TYPES;
    return BLOOD_TYPES.filter((type) => type.includes(query));
  }, [form.tipoSangre]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem('user');
    if (Platform.OS === 'web') {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
      localStorage.removeItem('user');
    } else {
      await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(LEGACY_USER_STORAGE_KEY);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const persistUser = async (nextUser: User) => {
    const raw = JSON.stringify(nextUser);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, raw);
      await AsyncStorage.setItem('user', raw);
    } catch {}
    try {
      await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, raw);
    } catch {}
    if (Platform.OS === 'web') {
      try {
        (globalThis as any).localStorage?.setItem(LEGACY_USER_STORAGE_KEY, raw);
        (globalThis as any).localStorage?.setItem('user', raw);
      } catch {}
    }
  };

  const handlePickProfilePhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso requerido', 'Debes permitir acceso a la galería para subir tu foto.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.55,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;
      const baseUri = buildPersistentPhotoUri(result.assets[0]);
      const uri = await toWebDataUrl(baseUri);
      if (!uri) return;

      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Sesion expirada', 'Inicia sesion nuevamente para actualizar tu foto.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const response = await fetch(apiUrl('/api/users/me/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fotoUrl: uri }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        Alert.alert('Error', payload?.message || 'No se pudo guardar la foto en el servidor.');
        return;
      }

      const finalUri = sanitizeFotoUrl(payload?.profile?.fotoUrl || uri);
      const nextUser: User = { ...(user || {}), fotoUrl: uri };
      nextUser.fotoUrl = finalUri;
      setUser(nextUser);
      await persistUser(nextUser);
      Alert.alert('Foto actualizada', 'Tu foto de perfil fue actualizada.');
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la foto de perfil.');
    }
  };

  const handleSave = async () => {
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.email.trim()) {
      Alert.alert('Datos incompletos', 'Completa al menos nombre, apellido y correo.');
      return;
    }
    const confirmPassword = normalizeValue(form.confirmPassword);
    if (requiresSensitiveConfirmation && !confirmPassword) {
      Alert.alert(
        'Confirmación requerida',
        'Debes escribir tu contraseña actual para guardar cambios en correo, cédula, teléfono o fecha de nacimiento.'
      );
      return;
    }

    setSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Sesion expirada', 'Inicia sesion nuevamente para guardar tus cambios.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const response = await fetch(apiUrl('/api/users/me/paciente-profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombres: normalizeValue(form.nombres),
          apellidos: normalizeValue(form.apellidos),
          email: normalizeValue(form.email).toLowerCase(),
          telefono: normalizeValue(form.telefono),
          cedula: normalizeValue(form.cedula),
          fechanacimiento: normalizeValue(form.fechaNacimiento),
          genero: normalizeValue(form.genero),
          direccion: normalizeValue(form.direccion),
          tipoSangre: normalizeValue(form.tipoSangre),
          alergias: normalizeValue(form.alergias),
          medicamentos: normalizeValue(form.medicamentos),
          antecedentes: normalizeValue(form.antecedentes),
          contactoEmergenciaNombre: normalizeValue(form.emergenciaNombre),
          contactoEmergenciaTelefono: normalizeValue(form.emergenciaTelefono),
          contactoEmergenciaParentesco: normalizeValue(form.emergenciaParentesco),
          recibirEmail: Boolean(form.recibirEmail),
          recibirSMS: Boolean(form.recibirSMS),
          compartirHistorial: Boolean(form.compartirHistorial),
          confirmPassword,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.profile) {
        Alert.alert('Error', payload?.message || 'No se pudo guardar el perfil.');
        return;
      }

      const profile = payload.profile;
      const nextUser: User = {
        ...(user || {}),
        email: normalizeValue(profile.email),
        nombres: normalizeValue(profile.nombres),
        apellidos: normalizeValue(profile.apellidos),
        nombre: normalizeValue(profile.nombres),
        apellido: normalizeValue(profile.apellidos),
        telefono: normalizeValue(profile.telefono),
        cedula: normalizeValue(profile.cedula),
        genero: normalizeValue(profile.genero),
        fechanacimiento: normalizeValue(profile.fechanacimiento),
        direccion: normalizeValue(profile.direccion),
        tipoSangre: normalizeValue(profile.tipoSangre),
        alergias: normalizeValue(profile.alergias),
        medicamentos: normalizeValue(profile.medicamentos),
        antecedentes: normalizeValue(profile.antecedentes),
        contactoEmergenciaNombre: normalizeValue(profile.contactoEmergenciaNombre),
        contactoEmergenciaTelefono: normalizeValue(profile.contactoEmergenciaTelefono),
        contactoEmergenciaParentesco: normalizeValue(profile.contactoEmergenciaParentesco),
        fotoUrl: sanitizeFotoUrl(profile.fotoUrl || user?.fotoUrl),
        recibirEmail: Boolean(profile.recibirEmail),
        recibirSMS: Boolean(profile.recibirSMS),
        compartirHistorial: Boolean(profile.compartirHistorial),
      };

      setUser(nextUser);
      setForm((prev) => ({ ...prev, confirmPassword: '' }));
      await persistUser(nextUser);
      Alert.alert('Perfil actualizado', 'Tus datos de paciente fueron guardados correctamente.');
    } catch {
      Alert.alert('Error de red', 'No se pudo conectar con el backend para guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <View>
          <View style={styles.logoBox}>
            <Image source={ViremLogo} style={styles.logo} />
            <View>
              <Text style={styles.logoTitle}>VIREM</Text>
              <Text style={styles.logoSubtitle}>Portal Paciente</Text>
            </View>
          </View>

          <View style={styles.userBox}>
            <Image source={userAvatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userPlan}>{planLabel}</Text>
            {!hasProfilePhoto ? (
              <Text style={styles.hintText}>No tienes foto. Ve a Perfil para agregarla.</Text>
            ) : null}
          </View>

          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('DashboardPaciente')}>
              <MaterialIcons name="grid-view" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.home')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('NuevaConsultaPaciente')}>
              <MaterialIcons name="person-search" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Buscar Médico</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteCitas')}
            >
              <MaterialIcons name="calendar-today" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.appointments')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('SalaEsperaVirtualPaciente')}
            >
              <MaterialIcons name="videocam" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.videocall')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteChat')}
            >
              <MaterialIcons name="chat-bubble" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.chat')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteRecetasDocumentos')}
            >
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.recipesDocs')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('PacientePerfil')}
            >
              <MaterialIcons name="account-circle" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>{t('menu.profile')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteConfiguracion')}
            >
              <MaterialIcons name="settings" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.settings')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              placeholder="Buscar en tu perfil"
              placeholderTextColor="#8aa7bf"
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate('PacienteNotificaciones')}
          >
            <MaterialIcons name="notifications" size={22} color={colors.dark} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.titleWrap}>
          <Text style={styles.pageTitle}>
            {tx({ es: 'Perfil del Paciente', en: 'Patient Profile', pt: 'Perfil do Paciente' })}
          </Text>
          <Text style={styles.pageSubtitle}>
            Mantén tus datos personales, médicos y de contacto siempre actualizados.
          </Text>
        </View>

        <ProfileCard title="Foto de perfil">
          <View style={styles.photoRow}>
            <Image source={userAvatarSource} style={styles.profilePhoto} />
            <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickProfilePhoto}>
              <MaterialIcons name="photo-camera" size={16} color={colors.primary} />
              <Text style={styles.photoActionBtnText}>
                {user?.fotoUrl ? 'Cambiar foto' : 'Agregar foto'}
              </Text>
            </TouchableOpacity>
          </View>
        </ProfileCard>

        <ProfileCard title="Datos personales">
          <View style={styles.grid2}>
            <ProfileField
              label="Nombres"
              value={form.nombres}
              onChangeText={(v) => updateField('nombres', v)}
              placeholder="Nombres"
            />
            <ProfileField
              label="Apellidos"
              value={form.apellidos}
              onChangeText={(v) => updateField('apellidos', v)}
              placeholder="Apellidos"
            />
            <ProfileField
              label="Cédula"
              value={form.cedula}
              onChangeText={(v) => updateField('cedula', v)}
              placeholder="001-0000000-0"
            />
            <ProfileField
              label="Fecha de nacimiento"
              value={form.fechaNacimiento}
              onChangeText={(v) => updateField('fechaNacimiento', v)}
              placeholder="DD/MM/AAAA"
            />
            <ProfileField
              label="Género"
              value={form.genero}
              onChangeText={(v) => updateField('genero', v)}
              placeholder="Hombre / Mujer / Otro"
            />
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Tipo de sangre</Text>
              <View>
                <TextInput
                  value={form.tipoSangre}
                  onChangeText={(v) => {
                    updateField('tipoSangre', v.toUpperCase());
                    setBloodTypeOpen(true);
                  }}
                  onFocus={() => setBloodTypeOpen(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      if (!selectingBloodTypeRef.current) {
                        setBloodTypeOpen(false);
                      }
                    }, 120);
                  }}
                  placeholder="Ej: O+"
                  placeholderTextColor="#8aa7bf"
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.bloodTypeChevron}
                  onPress={() => setBloodTypeOpen((prev) => !prev)}
                  activeOpacity={0.85}
                >
                  <MaterialIcons
                    name={bloodTypeOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={20}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              </View>

              {bloodTypeOpen ? (
                <View style={styles.autocompleteBox}>
                  {filteredBloodTypes.length > 0 ? (
                    filteredBloodTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.autocompleteItem}
                        onPressIn={() => {
                          selectingBloodTypeRef.current = true;
                        }}
                        onPress={() => {
                          updateField('tipoSangre', type);
                          setBloodTypeOpen(false);
                          setTimeout(() => {
                            selectingBloodTypeRef.current = false;
                          }, 0);
                        }}
                      >
                        <Text style={styles.autocompleteItemText}>{type}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.autocompleteEmpty}>
                      <Text style={styles.autocompleteEmptyText}>Sin coincidencias</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </ProfileCard>

        <ProfileCard title="Contacto y dirección">
          <View style={styles.grid2}>
            <ProfileField
              label="Correo electrónico"
              value={form.email}
              onChangeText={(v) => updateField('email', v)}
              placeholder="correo@ejemplo.com"
            />
            <ProfileField
              label="Teléfono"
              value={form.telefono}
              onChangeText={(v) => updateField('telefono', v)}
              placeholder="+1 809 000 0000"
            />
          </View>
          <View style={styles.blockSpacingTop}>
            <ProfileField
              label="Dirección"
              value={form.direccion}
              onChangeText={(v) => updateField('direccion', v)}
              placeholder="Calle, número, sector, ciudad"
            />
          </View>
        </ProfileCard>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setMedicalOpen((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardTitle}>Información médica relevante</Text>
            <MaterialIcons
              name={medicalOpen ? 'expand-less' : 'expand-more'}
              size={22}
              color={colors.blue}
            />
          </TouchableOpacity>

          {medicalOpen ? (
            <>
              <ProfileField
                label="Alergias"
                value={form.alergias}
                onChangeText={(v) => updateField('alergias', v)}
                placeholder="Alergia a penicilina, mariscos..."
                multiline
              />
              <ProfileField
                label="Medicamentos actuales"
                value={form.medicamentos}
                onChangeText={(v) => updateField('medicamentos', v)}
                placeholder="Medicamento - dosis - frecuencia"
                multiline
              />
              <ProfileField
                label="Antecedentes médicos"
                value={form.antecedentes}
                onChangeText={(v) => updateField('antecedentes', v)}
                placeholder="Hipertensión, asma, cirugías previas..."
                multiline
              />
            </>
          ) : (
            <Text style={styles.collapsibleHint}>
              Toca para ver o editar alergias, medicamentos y antecedentes.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setPrivacyOpen((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardTitle}>Preferencias y privacidad</Text>
            <MaterialIcons
              name={privacyOpen ? 'expand-less' : 'expand-more'}
              size={22}
              color={colors.blue}
            />
          </TouchableOpacity>

          {privacyOpen ? (
            <>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Recibir recordatorios por correo</Text>
                  <Text style={styles.switchSubtitle}>Notificaciones de citas y documentos.</Text>
                </View>
                <Switch
                  value={form.recibirEmail}
                  onValueChange={(v) => updateField('recibirEmail', v)}
                  trackColor={{ false: '#dbe6f2', true: '#7cb3ea' }}
                  thumbColor={form.recibirEmail ? colors.primary : '#fff'}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Recibir recordatorios por SMS</Text>
                  <Text style={styles.switchSubtitle}>Avisos rápidos de próximas consultas.</Text>
                </View>
                <Switch
                  value={form.recibirSMS}
                  onValueChange={(v) => updateField('recibirSMS', v)}
                  trackColor={{ false: '#dbe6f2', true: '#7cb3ea' }}
                  thumbColor={form.recibirSMS ? colors.primary : '#fff'}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Compartir historial con médicos de VIREM</Text>
                  <Text style={styles.switchSubtitle}>Permite una atención más completa y segura.</Text>
                </View>
                <Switch
                  value={form.compartirHistorial}
                  onValueChange={(v) => updateField('compartirHistorial', v)}
                  trackColor={{ false: '#dbe6f2', true: '#7cb3ea' }}
                  thumbColor={form.compartirHistorial ? colors.primary : '#fff'}
                />
              </View>
            </>
          ) : (
            <Text style={styles.collapsibleHint}>
              Toca para ver o editar tus preferencias de notificaciones y privacidad.
            </Text>
          )}
        </View>

        {requiresSensitiveConfirmation ? (
          <ProfileCard title="Confirmación de seguridad">
            <ProfileField
              label="Contraseña actual"
              value={form.confirmPassword}
              onChangeText={(v) => updateField('confirmPassword', v)}
              placeholder="Necesaria para guardar cambios sensibles"
              secureTextEntry
            />
            <Text style={styles.securityHint}>
              Requerida para cambiar correo, cédula, teléfono o fecha de nacimiento.
            </Text>
          </ProfileCard>
        ) : null}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="save" size={18} color="#fff" />
              <Text style={styles.saveButtonText}>Guardar cambios</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.successBanner}>
          <MaterialIcons name="verified-user" size={18} color={colors.success} />
          <Text style={styles.successText}>
            Tus datos son privados y están protegidos con cifrado de nivel médico.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: colors.bg,
  },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loaderText: { marginTop: 10, color: colors.muted, fontWeight: '700' },
  sidebar: {
    width: Platform.OS === 'web' ? 280 : '100%',
    backgroundColor: colors.white,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderRightColor: '#eef2f7',
    borderBottomColor: '#eef2f7',
    padding: Platform.OS === 'web' ? 20 : 14,
    justifyContent: 'space-between',
  },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, resizeMode: 'contain' },
  logoTitle: { fontSize: 20, fontWeight: '800', color: colors.dark, letterSpacing: 0.5 },
  logoSubtitle: { fontSize: 11, fontWeight: '700', color: colors.muted },
  userBox: { marginTop: 18, alignItems: 'center', paddingVertical: 12 },
  userAvatar: { width: 76, height: 76, borderRadius: 76, marginBottom: 10, borderWidth: 4, borderColor: '#f5f7fb' },
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14, textAlign: 'center' },
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  hintText: { marginTop: 6, color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  menu: {
    marginTop: 10,
    gap: 6,
    flex: Platform.OS === 'web' ? 1 : 0,
    flexDirection: Platform.OS === 'web' ? 'column' : 'row',
    flexWrap: 'wrap',
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: Platform.OS === 'web' ? 0 : 150,
  },
  menuItemActive: {
    backgroundColor: 'rgba(19,127,236,0.10)',
    borderRightWidth: 3,
    borderRightColor: colors.primary,
  },
  menuText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  menuTextActive: { color: colors.primary },
  logoutButton: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutText: { color: '#fff', fontWeight: '800' },
  main: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 24 : 14,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddeaf5',
  },
  searchInput: { flex: 1, color: colors.dark, fontWeight: '600', fontSize: 12 },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e6eef7',
  },
  notifDot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  titleWrap: { marginBottom: 14 },
  pageTitle: { color: colors.dark, fontSize: 28, fontWeight: '900' },
  pageSubtitle: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 4 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profilePhoto: {
    width: 88,
    height: 88,
    borderRadius: 88,
    borderWidth: 3,
    borderColor: '#dceafb',
    backgroundColor: '#f5f8fc',
  },
  photoHint: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  photoActionBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#cfe1f3',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8fcff',
  },
  photoActionBtnText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe8f4',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  collapsibleHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 0,
  },
  cardTitle: { color: colors.dark, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  grid2: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: 10,
  },
  blockSpacingTop: { marginTop: 10 },
  securityHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
  fieldWrap: { flex: 1, minWidth: Platform.OS === 'web' ? 250 : 0 },
  fieldLabel: { color: colors.dark, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: '#d7e6f3',
    borderRadius: 10,
    backgroundColor: '#f9fcff',
    paddingHorizontal: 12,
    color: colors.dark,
    fontSize: 12,
    fontWeight: '600',
  },
  bloodTypeChevron: {
    position: 'absolute',
    right: 8,
    top: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autocompleteBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#d7e6f3',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  autocompleteItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef4fb',
  },
  autocompleteItemText: {
    color: colors.dark,
    fontSize: 12,
    fontWeight: '700',
  },
  autocompleteEmpty: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  autocompleteEmptyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  inputMultiline: { height: 84, paddingTop: 10, textAlignVertical: 'top' as const },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef4fb',
  },
  switchTitle: { color: colors.dark, fontSize: 14, fontWeight: '700' },
  switchSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  saveButton: {
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eefcf2',
    borderWidth: 1,
    borderColor: '#c8efd4',
    borderRadius: 12,
    padding: 12,
  },
  successText: { color: '#166534', fontSize: 12, fontWeight: '700' },
});

export default PacientePerfilScreen;




