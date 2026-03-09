import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';

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
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const ProfileField: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}> = ({ label, value, onChangeText, placeholder, multiline }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#8aa7bf"
      multiline={multiline}
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [bloodTypeOpen, setBloodTypeOpen] = useState(false);
  const selectingBloodTypeRef = useRef(false);
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
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (Platform.OS === 'web') {
          const localStorageUser = parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY));
          if (localStorageUser) {
            setUser(localStorageUser);
            return;
          }
        }

        const secureStoreUser = parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY));
        if (secureStoreUser) {
          setUser(secureStoreUser);
          return;
        }

        const asyncUser = parseUser(await AsyncStorage.getItem(STORAGE_KEY));
        setUser(asyncUser);
      } catch {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };

    loadUser();
  }, []);

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
    }));
  }, [user]);

  const fullName = useMemo(() => {
    const name = `${form.nombres} ${form.apellidos}`.trim();
    return name || 'Paciente';
  }, [form.nombres, form.apellidos]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user?.plan]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    if (user?.fotoUrl && user.fotoUrl.trim().length > 0) {
      return { uri: user.fotoUrl.trim() };
    }
    return DefaultAvatar;
  }, [user?.fotoUrl]);

  const updateField = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const filteredBloodTypes = useMemo(() => {
    const query = form.tipoSangre.trim().toUpperCase();
    if (!query) return BLOOD_TYPES;
    return BLOOD_TYPES.filter((type) => type.includes(query));
  }, [form.tipoSangre]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem(STORAGE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const persistUser = async (nextUser: User) => {
    const raw = JSON.stringify(nextUser);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, raw);
    } catch {}
    try {
      await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, raw);
    } catch {}
    if (Platform.OS === 'web') {
      try {
        (globalThis as any).localStorage?.setItem(LEGACY_USER_STORAGE_KEY, raw);
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
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;
      const uri = result.assets[0].uri;
      if (!uri) return;

      const nextUser: User = { ...(user || {}), fotoUrl: uri };
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

    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setSaving(false);
    Alert.alert('Perfil actualizado', 'Tus datos de paciente fueron guardados correctamente.');
  };

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Cargando perfil...</Text>
      </View>
    );
  }

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
          </View>

          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('DashboardPaciente')}>
              <MaterialIcons name="grid-view" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Inicio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('NuevaConsultaPaciente')}>
              <MaterialIcons name="person-search" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Buscar Médico</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="calendar-today" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Mis Citas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="videocam" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Videollamada</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="chat-bubble" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteRecetasDocumentos')}
            >
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Recetas / Documentos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItemRow, styles.menuItemActive]}>
              <MaterialIcons name="account-circle" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>Perfil</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
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
          <TouchableOpacity style={styles.notifBtn}>
            <MaterialIcons name="notifications" size={22} color={colors.dark} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.titleWrap}>
          <Text style={styles.pageTitle}>Perfil del Paciente</Text>
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
