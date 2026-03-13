import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';
import { apiUrl } from './config/backend';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const LEGACY_USER_STORAGE_KEY = 'userProfile';
const MEDICO_CACHE_BY_EMAIL_KEY = 'medicoProfileByEmail';
const ASYNC_USER_KEY = 'user';
const ASYNC_TOKEN_KEY = 'token';
const AUTH_TOKEN_KEY = 'authToken';

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

type SessionUser = {
  email?: string;
  nombreCompleto?: string;
  especialidad?: string;
  fechanacimiento?: string;
  genero?: string;
  cedula?: string;
  telefono?: string;
  fotoUrl?: string;
  medico?: {
    nombreCompleto?: string;
    especialidad?: string;
    fechanacimiento?: string;
    genero?: string;
    cedula?: string;
    telefono?: string;
    fotoUrl?: string;
  };
};

type CachedMedicoProfile = {
  nombreCompleto?: string;
  especialidad?: string;
  fechanacimiento?: string;
  genero?: string;
  cedula?: string;
  telefono?: string;
  fotoUrl?: string;
};

type MedicoProfile = {
  email: string;
  nombreCompleto: string;
  especialidad: string;
  fechanacimiento: string;
  genero: string;
  cedula: string;
  telefono: string;
  fotoUrl: string;
};

type SideItem = {
  icon: string;
  label: string;
  route?: keyof RootStackParamList;
  active?: boolean;
  badge?: { text: string; color: string };
};

const EMPTY_PROFILE: MedicoProfile = {
  email: '',
  nombreCompleto: '',
  especialidad: '',
  fechanacimiento: '',
  genero: '',
  cedula: '',
  telefono: '',
  fotoUrl: '',
};

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const normalizeValue = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

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

const prettyValue = (value: string) => (value ? value : 'No disponible');

const formatCedula = (value: string) => {
  const digits = normalizeValue(value).replace(/\D/g, '');
  if (digits.length !== 11) return normalizeValue(value);
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
};

const formatPhone = (value: string) => {
  const digits = normalizeValue(value).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length > 10) {
    const country = digits.slice(0, digits.length - 10);
    const local = digits.slice(-10);
    return `+${country} ${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }

  return normalizeValue(value);
};

const getInitialProfileFromWeb = (): { user: SessionUser | null; profile: MedicoProfile } => {
  if (Platform.OS !== 'web') {
    return { user: null, profile: EMPTY_PROFILE };
  }

  try {
    const rawUser = localStorage.getItem(LEGACY_USER_STORAGE_KEY);
    const sessionUser = parseJson<SessionUser>(rawUser);
    const email = normalizeValue(sessionUser?.email).toLowerCase();
    const rawCache = localStorage.getItem(MEDICO_CACHE_BY_EMAIL_KEY);
    const cacheMap = parseJson<Record<string, CachedMedicoProfile>>(rawCache) || {};
    const cached = email ? cacheMap[email] || null : null;
    return { user: sessionUser, profile: buildProfile(sessionUser, cached) };
  } catch {
    return { user: null, profile: EMPTY_PROFILE };
  }
};

const buildProfile = (
  user: SessionUser | null,
  cached: CachedMedicoProfile | null
): MedicoProfile => ({
  email: normalizeValue(user?.email),
  nombreCompleto: normalizeValue(
    user?.nombreCompleto || user?.medico?.nombreCompleto || cached?.nombreCompleto
  ),
  especialidad: normalizeValue(
    user?.especialidad || user?.medico?.especialidad || cached?.especialidad
  ),
  fechanacimiento: normalizeValue(
    user?.fechanacimiento || user?.medico?.fechanacimiento || cached?.fechanacimiento
  ),
  genero: normalizeValue(user?.genero || user?.medico?.genero || cached?.genero),
  cedula: normalizeValue(user?.cedula || user?.medico?.cedula || cached?.cedula),
  telefono: normalizeValue(user?.telefono || user?.medico?.telefono || cached?.telefono),
  fotoUrl: sanitizeFotoUrl(user?.fotoUrl || user?.medico?.fotoUrl || cached?.fotoUrl),
});

const VerifiedField: React.FC<{
  label: string;
  value: string;
  formatter?: (value: string) => string;
}> = ({ label, value, formatter }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.readonlyBox}>
      <Text style={styles.readonlyText}>{prettyValue(formatter ? formatter(value) : value)}</Text>
    </View>
  </View>
);

const MedicoPerfilScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const initialWebData = useMemo(() => getInitialProfileFromWeb(), []);
  const [loading, setLoading] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [rawUser, setRawUser] = useState<SessionUser | null>(initialWebData.user);
  const [profile, setProfile] = useState<MedicoProfile>(initialWebData.profile);

  const avatarSource: ImageSourcePropType = useMemo(() => {
    if (profile.fotoUrl) return { uri: profile.fotoUrl };
    return DefaultAvatar;
  }, [profile.fotoUrl]);

  const loadProfile = useCallback(async () => {
    setLoading(true);

    try {
      const rawUserFromStorage =
        Platform.OS === 'web'
          ? localStorage.getItem(LEGACY_USER_STORAGE_KEY)
          : await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY);
      const authTokenFromStorage =
        Platform.OS === 'web'
          ? localStorage.getItem(AUTH_TOKEN_KEY)
          : await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

      const fallbackUserRaw = parseJson<SessionUser>(await AsyncStorage.getItem(ASYNC_USER_KEY));
      let sessionUser = parseJson<SessionUser>(rawUserFromStorage) || fallbackUserRaw;
      const authToken = normalizeValue(authTokenFromStorage || (await AsyncStorage.getItem(ASYNC_TOKEN_KEY)));
      let email = normalizeValue(sessionUser?.email).toLowerCase();

      const rawCache =
        Platform.OS === 'web'
          ? localStorage.getItem(MEDICO_CACHE_BY_EMAIL_KEY)
          : await SecureStore.getItemAsync(MEDICO_CACHE_BY_EMAIL_KEY);
      const cacheMap = parseJson<Record<string, CachedMedicoProfile>>(rawCache) || {};
      let cached = email ? cacheMap[email] || null : null;

      if (authToken) {
        try {
          const response = await fetch(apiUrl('/api/auth/me'), {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });

          const payload = await response.json().catch(() => null);
          if (response.ok && payload?.success && payload?.user) {
            const apiUser = payload.user as SessionUser;
            const apiHasFotoUrl = Object.prototype.hasOwnProperty.call(apiUser || {}, 'fotoUrl');
            sessionUser = {
              ...(sessionUser || {}),
              ...apiUser,
              fotoUrl: apiHasFotoUrl
                ? sanitizeFotoUrl((apiUser as any)?.fotoUrl)
                : sanitizeFotoUrl(sessionUser?.fotoUrl),
            };
            email = normalizeValue(sessionUser?.email).toLowerCase();

            const rawNextUser = JSON.stringify(sessionUser);
            try {
              await AsyncStorage.setItem(ASYNC_USER_KEY, rawNextUser);
            } catch {}

            try {
              if (Platform.OS === 'web') {
                localStorage.setItem(LEGACY_USER_STORAGE_KEY, rawNextUser);
              } else {
                await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, rawNextUser);
              }
            } catch {}

            if (email) {
              const mergedCache: CachedMedicoProfile = {
                ...(cacheMap[email] || {}),
                nombreCompleto: normalizeValue(
                  sessionUser?.nombreCompleto || sessionUser?.medico?.nombreCompleto || cacheMap[email]?.nombreCompleto
                ),
                especialidad: normalizeValue(
                  sessionUser?.especialidad || sessionUser?.medico?.especialidad || cacheMap[email]?.especialidad
                ),
                fechanacimiento: normalizeValue(
                  sessionUser?.fechanacimiento || sessionUser?.medico?.fechanacimiento || cacheMap[email]?.fechanacimiento
                ),
                genero: normalizeValue(
                  sessionUser?.genero || sessionUser?.medico?.genero || cacheMap[email]?.genero
                ),
                cedula: normalizeValue(
                  sessionUser?.cedula || sessionUser?.medico?.cedula || cacheMap[email]?.cedula
                ),
                telefono: normalizeValue(
                  sessionUser?.telefono || sessionUser?.medico?.telefono || cacheMap[email]?.telefono
                ),
                fotoUrl: normalizeValue(
                  sanitizeFotoUrl(
                  sessionUser?.fotoUrl || sessionUser?.medico?.fotoUrl || cacheMap[email]?.fotoUrl
                  )
                ),
              };
              cacheMap[email] = mergedCache;
              cached = mergedCache;

              const rawCacheNext = JSON.stringify(cacheMap);
              try {
                if (Platform.OS === 'web') {
                  localStorage.setItem(MEDICO_CACHE_BY_EMAIL_KEY, rawCacheNext);
                } else {
                  await SecureStore.setItemAsync(MEDICO_CACHE_BY_EMAIL_KEY, rawCacheNext);
                }
              } catch {}
            }
          }
        } catch {}
      }

      setRawUser(sessionUser);
      setProfile(buildProfile(sessionUser, cached));
    } catch {
      setRawUser(null);
      setProfile(buildProfile(null, null));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const getAuthToken = useCallback(async () => {
    const storageToken =
      Platform.OS === 'web'
        ? localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(ASYNC_TOKEN_KEY)
        : (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
          (await SecureStore.getItemAsync(ASYNC_TOKEN_KEY));
    const asyncToken = await AsyncStorage.getItem(ASYNC_TOKEN_KEY);
    return normalizeValue(storageToken || asyncToken);
  }, []);

  const persistProfilePhoto = useCallback(
    async (uri: string) => {
      const cleanUri = normalizeValue(uri);
      const token = await getAuthToken();
      let savedOnServer = false;
      let finalUri = sanitizeFotoUrl(cleanUri);

      if (token) {
        try {
          const response = await fetch(apiUrl('/api/users/me/profile'), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fotoUrl: cleanUri }),
          });
          const payload = await response.json().catch(() => null);
          if (response.ok && payload?.success) {
            savedOnServer = true;
            finalUri = sanitizeFotoUrl(payload?.profile?.fotoUrl || cleanUri);
          }
        } catch {
          // Non-blocking: keep local save as fallback
        }
      }

      const email = normalizeValue(rawUser?.email).toLowerCase();
      const nextUser: SessionUser = {
        ...(rawUser || {}),
        fotoUrl: finalUri,
      };

      const rawNextUser = JSON.stringify(nextUser);
      try {
        await AsyncStorage.setItem(ASYNC_USER_KEY, rawNextUser);
      } catch {}

      try {
        if (Platform.OS === 'web') {
          localStorage.setItem(LEGACY_USER_STORAGE_KEY, rawNextUser);
        } else {
          await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, rawNextUser);
        }
      } catch {}

      if (email) {
        try {
          const rawCache =
            Platform.OS === 'web'
              ? localStorage.getItem(MEDICO_CACHE_BY_EMAIL_KEY)
              : await SecureStore.getItemAsync(MEDICO_CACHE_BY_EMAIL_KEY);
          const cacheMap = parseJson<Record<string, CachedMedicoProfile>>(rawCache) || {};
          const prev = cacheMap[email] || {};

          cacheMap[email] = {
            ...prev,
            nombreCompleto: profile.nombreCompleto || prev.nombreCompleto,
            especialidad: profile.especialidad || prev.especialidad,
            fechanacimiento: profile.fechanacimiento || prev.fechanacimiento,
            genero: profile.genero || prev.genero,
            cedula: profile.cedula || prev.cedula,
            telefono: profile.telefono || prev.telefono,
            fotoUrl: finalUri,
          };

          const rawCacheNext = JSON.stringify(cacheMap);
          if (Platform.OS === 'web') {
            localStorage.setItem(MEDICO_CACHE_BY_EMAIL_KEY, rawCacheNext);
          } else {
            await SecureStore.setItemAsync(MEDICO_CACHE_BY_EMAIL_KEY, rawCacheNext);
          }
        } catch {}
      }

      setRawUser(nextUser);
      setProfile((prev) => ({ ...prev, fotoUrl: finalUri }));
      return { savedOnServer };
    },
    [getAuthToken, profile, rawUser]
  );

  const handlePickPhoto = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
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

      setSavingPhoto(true);
      const resultSave = await persistProfilePhoto(uri);
      if (resultSave?.savedOnServer) {
        Alert.alert('Foto actualizada', 'La foto del perfil medico se guardo en el servidor.');
      } else {
        Alert.alert(
          'Foto actualizada',
          'La foto se guardo localmente. Revisa la conexion al backend para sincronizarla en todos los dispositivos.'
        );
      }
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la foto del perfil.');
    } finally {
      setSavingPhoto(false);
    }
  }, [persistProfilePhoto]);

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(ASYNC_TOKEN_KEY);
      await AsyncStorage.removeItem(ASYNC_USER_KEY);
      await AsyncStorage.removeItem(LEGACY_USER_STORAGE_KEY);

      if (Platform.OS === 'web') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(ASYNC_TOKEN_KEY);
        localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
        localStorage.removeItem(ASYNC_USER_KEY);
      } else {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(ASYNC_TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_USER_STORAGE_KEY);
        await SecureStore.deleteItemAsync(ASYNC_USER_KEY);
      }
    } catch {}

    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [navigation]);

  const sideItems: SideItem[] = [
    { icon: 'dashboard', label: 'Dashboard', route: 'DashboardMedico' },
    { icon: 'calendar-today', label: 'Agenda' },
    { icon: 'group', label: 'Pacientes' },
    { icon: 'notification-important', label: 'Solicitudes', badge: { text: '5', color: '#ef4444' } },
    { icon: 'chat-bubble', label: 'Mensajes', badge: { text: '3', color: colors.primary } },
    { icon: 'person', label: 'Perfil', route: 'MedicoPerfil', active: true },
    { icon: 'settings', label: 'Configuracion' },
  ];

  const handleSideItemPress = (item: SideItem) => {
    if (!item.route || item.route === 'MedicoPerfil') return;
    navigation.navigate(item.route);
  };

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <View>
          <View style={styles.logoBox}>
            <Image source={ViremLogo} style={styles.logo} />
            <View>
              <Text style={styles.logoTitle}>VIREM</Text>
              <Text style={styles.logoSubtitle}>Portal Medico</Text>
            </View>
          </View>

          <View style={styles.userBox}>
            <Image source={avatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{prettyValue(profile.nombreCompleto)}</Text>
            <Text style={styles.userPlan}>{prettyValue(profile.especialidad)}</Text>
          </View>

          <View style={styles.menu}>
            {sideItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItemRow, item.active ? styles.menuItemActive : null]}
                onPress={() => handleSideItemPress(item)}
                activeOpacity={0.85}
              >
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={item.active ? colors.primary : colors.muted}
                />
                <Text style={[styles.menuText, item.active ? styles.menuTextActive : null]}>{item.label}</Text>
                {item.badge ? (
                  <View style={[styles.badge, { backgroundColor: item.badge.color }]}>
                    <Text style={styles.badgeText}>{item.badge.text}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 26 }}>
        <View style={styles.titleWrap}>
          <Text style={styles.pageTitle}>Perfil del Medico</Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.pageSubtitle}>
              Aqui puedes ver tus datos verificados y actualizar tu foto de perfil.
            </Text>
            {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Foto de perfil</Text>
          <View style={styles.photoRow}>
            <Image source={avatarSource} style={styles.profilePhoto} />
            <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickPhoto} disabled={savingPhoto}>
              {savingPhoto ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <MaterialIcons name="photo-camera" size={16} color={colors.primary} />
                  <Text style={styles.photoActionBtnText}>
                    {profile.fotoUrl ? 'Cambiar foto' : 'Agregar foto'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos verificados del registro</Text>
          <View style={styles.grid2}>
            <VerifiedField label="Nombre completo" value={profile.nombreCompleto} />
            <VerifiedField label="Especialidad" value={profile.especialidad} />
            <VerifiedField label="Cedula" value={profile.cedula} formatter={formatCedula} />
            <VerifiedField label="Fecha de nacimiento" value={profile.fechanacimiento} />
            <VerifiedField label="Genero" value={profile.genero} />
            <VerifiedField label="Telefono" value={profile.telefono} formatter={formatPhone} />
            <VerifiedField label="Correo electronico" value={profile.email} />
          </View>
        </View>

        <View style={styles.successBanner}>
          <MaterialIcons name="verified-user" size={18} color={colors.success} />
          <Text style={styles.successText}>
            Tus datos profesionales se validan en el flujo de registro medico.
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
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  loaderText: {
    marginTop: 10,
    color: colors.muted,
    fontWeight: '700',
  },
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
  userAvatar: {
    width: 76,
    height: 76,
    borderRadius: 76,
    marginBottom: 10,
    borderWidth: 4,
    borderColor: '#f5f7fb',
  },
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14, textAlign: 'center' },
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
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
  badge: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
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
  titleWrap: { marginBottom: 14 },
  pageTitle: { color: colors.dark, fontSize: 28, fontWeight: '900' },
  subtitleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pageSubtitle: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe8f4',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: colors.dark, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  profilePhoto: {
    width: 88,
    height: 88,
    borderRadius: 88,
    borderWidth: 3,
    borderColor: '#dceafb',
    backgroundColor: '#f5f8fc',
  },
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
    minHeight: 38,
  },
  photoActionBtnText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  grid2: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldWrap: { flex: 1, minWidth: Platform.OS === 'web' ? 250 : 0 },
  fieldLabel: { color: colors.dark, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  readonlyBox: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#d7e6f3',
    borderRadius: 10,
    backgroundColor: '#f9fcff',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readonlyText: {
    color: colors.dark,
    fontSize: 12,
    fontWeight: '700',
  },
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

export default MedicoPerfilScreen;

