import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';
import { apiUrl } from './config/backend';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');
const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';
const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';

type SessionUser = {
  id?: number | string;
  usuarioid?: number | string;
  email?: string;
  nombreCompleto?: string;
  especialidad?: string;
  fotoUrl?: string;
  medico?: {
    nombreCompleto?: string;
    especialidad?: string;
    fotoUrl?: string;
  };
};

type CitaItem = {
  citaid: string;
  fechaHoraInicio: string | null;
  fechaHoraFin: string | null;
  duracionMin: number;
  nota: string;
  precio: number | null;
  estado: string;
  paciente?: {
    pacienteid?: string;
    nombreCompleto?: string;
  };
};

type SideItem = {
  icon: string;
  label: string;
  route?: 'DashboardMedico' | 'MedicoCitas' | 'MedicoPacientes' | 'MedicoChat' | 'MedicoPerfil';
  active?: boolean;
  badge?: { text: string; color: string };
};

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeFotoUrl = (value: unknown) => {
  const clean = normalizeText(value);
  if (!clean) return '';
  if (clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};

const parseDateMs = (value: string | null | undefined) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Sin horario';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin horario';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getAuthToken = async (): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      return (
        localStorage.getItem(AUTH_TOKEN_KEY) ||
        localStorage.getItem(LEGACY_TOKEN_KEY) ||
        ''
      ).trim();
    }

    const secureToken =
      (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
      (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
    if (secureToken && secureToken.trim()) return secureToken.trim();

    const asyncToken =
      (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
      (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    return String(asyncToken || '').trim();
  } catch {
    return '';
  }
};

const MedicoCitasScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [workingCitaId, setWorkingCitaId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [citas, setCitas] = useState<CitaItem[]>([]);

  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    try {
      const rawStorageUser =
        Platform.OS === 'web'
          ? localStorage.getItem(LEGACY_USER_STORAGE_KEY)
          : await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY);
      const rawAsyncUser = await AsyncStorage.getItem(STORAGE_KEY);
      let sessionUser = parseJson<SessionUser>(rawStorageUser) || parseJson<SessionUser>(rawAsyncUser);

      const token = await getAuthToken();
      if (token) {
        const dashboardResponse = await fetch(apiUrl('/api/users/me/dashboard-medico'), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const dashboardPayload = await dashboardResponse.json().catch(() => null);
        if (dashboardResponse.ok && dashboardPayload?.success && dashboardPayload?.dashboard?.profile) {
          const profile = dashboardPayload.dashboard.profile;
          sessionUser = {
            ...(sessionUser || {}),
            nombreCompleto:
              normalizeText(profile?.nombreCompleto || sessionUser?.nombreCompleto || sessionUser?.medico?.nombreCompleto),
            especialidad:
              normalizeText(profile?.especialidad || sessionUser?.especialidad || sessionUser?.medico?.especialidad),
            fotoUrl: sanitizeFotoUrl(profile?.fotoUrl || sessionUser?.fotoUrl || sessionUser?.medico?.fotoUrl),
          };
        }
      }

      setUser(sessionUser);
      if (sessionUser) {
        const raw = JSON.stringify(sessionUser);
        try {
          await AsyncStorage.setItem(STORAGE_KEY, raw);
          await AsyncStorage.setItem(LEGACY_USER_STORAGE_KEY, raw);
        } catch {}
        try {
          if (Platform.OS === 'web') {
            localStorage.setItem(STORAGE_KEY, raw);
            localStorage.setItem(LEGACY_USER_STORAGE_KEY, raw);
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
  }, []);

  const loadCitas = useCallback(async () => {
    setLoadingCitas(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setCitas([]);
        return;
      }

      const response = await fetch(apiUrl('/api/users/me/citas?scope=all&limit=120'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.success && Array.isArray(payload?.citas)) {
        setCitas(payload.citas as CitaItem[]);
      } else {
        setCitas([]);
      }
    } catch {
      setCitas([]);
    } finally {
      setLoadingCitas(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadCitas();
    }, [loadCitas, loadUser])
  );

  const doctorName = useMemo(() => {
    const base = normalizeText(user?.nombreCompleto || user?.medico?.nombreCompleto);
    if (!base) return 'Doctor';
    const lowered = base.toLowerCase();
    if (lowered.startsWith('dr ') || lowered.startsWith('dr.')) return base;
    return `Dr. ${base}`;
  }, [user?.medico?.nombreCompleto, user?.nombreCompleto]);

  const doctorSpec = useMemo(
    () => normalizeText(user?.especialidad || user?.medico?.especialidad) || 'Especialidad no definida',
    [user?.especialidad, user?.medico?.especialidad]
  );

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    const foto = sanitizeFotoUrl(user?.fotoUrl || user?.medico?.fotoUrl);
    if (foto) return { uri: foto };
    return DefaultAvatar;
  }, [user?.fotoUrl, user?.medico?.fotoUrl]);

  const filteredCitas = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();
    if (!q) return citas;
    return citas.filter((item) => {
      const patient = normalizeText(item?.paciente?.nombreCompleto).toLowerCase();
      const estado = normalizeText(item?.estado).toLowerCase();
      const nota = normalizeText(item?.nota).toLowerCase();
      return patient.includes(q) || estado.includes(q) || nota.includes(q);
    });
  }, [citas, searchText]);

  const upcomingCitas = useMemo(() => {
    const now = Date.now();
    return filteredCitas
      .filter((item) => parseDateMs(item?.fechaHoraInicio) >= now)
      .sort((a, b) => parseDateMs(a?.fechaHoraInicio) - parseDateMs(b?.fechaHoraInicio));
  }, [filteredCitas]);

  const historyCitas = useMemo(() => {
    const now = Date.now();
    return filteredCitas
      .filter((item) => parseDateMs(item?.fechaHoraInicio) < now)
      .sort((a, b) => parseDateMs(b?.fechaHoraInicio) - parseDateMs(a?.fechaHoraInicio));
  }, [filteredCitas]);

  const dateText = useMemo(
    () =>
      new Intl.DateTimeFormat('es-DO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date()),
    []
  );

  const timeText = useMemo(
    () =>
      new Intl.DateTimeFormat('es-DO', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
    []
  );

  const manageCita = useCallback(
    async (cita: CitaItem, action: 'complete' | 'cancel' | 'reschedule') => {
      setWorkingCitaId(cita.citaid);
      try {
        const token = await getAuthToken();
        if (!token) {
          Alert.alert('Sesion expirada', 'Inicia sesion nuevamente.');
          return;
        }

        const response = await fetch(apiUrl(`/api/users/me/citas/${cita.citaid}/manage`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          Alert.alert('No se pudo actualizar', payload?.message || 'Ocurrio un error.');
          return;
        }

        await loadCitas();
      } catch {
        Alert.alert('Error', 'No se pudo completar la accion.');
      } finally {
        setWorkingCitaId('');
      }
    },
    [loadCitas]
  );

  const showDetails = (cita: CitaItem) => {
    Alert.alert(
      'Detalle de cita',
      `Paciente: ${normalizeText(cita?.paciente?.nombreCompleto || 'Paciente')}\nEstado: ${normalizeText(
        cita?.estado || 'Pendiente'
      )}\nHora: ${formatDateTime(cita?.fechaHoraInicio)}\nNota: ${normalizeText(cita?.nota || 'Sin nota')}`
    );
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
      } else {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_USER_STORAGE_KEY);
      }
    } catch {}
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const sideItems: SideItem[] = [
    { icon: 'dashboard', label: 'Dashboard', route: 'DashboardMedico' },
    { icon: 'calendar-today', label: 'Agenda', route: 'MedicoCitas', active: true },
    { icon: 'group', label: 'Pacientes', route: 'MedicoPacientes' },
    { icon: 'notification-important', label: 'Solicitudes', badge: { text: '5', color: '#ef4444' } },
    { icon: 'chat-bubble', label: 'Mensajes', route: 'MedicoChat', badge: { text: '3', color: colors.primary } },
    { icon: 'person', label: 'Perfil', route: 'MedicoPerfil' },
    { icon: 'settings', label: 'Configuracion', route: 'MedicoPerfil' },
  ];

  const handleSideItemPress = (item: SideItem) => {
    if (!item.route) {
      Alert.alert('Solicitudes', 'Las solicitudes pendientes se integraran en un modulo dedicado.');
      return;
    }
    if (item.route === 'MedicoCitas') return;
    navigation.navigate(item.route);
  };

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Cargando agenda del medico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <View>
          <View style={styles.logoWrap}>
            <Image source={ViremLogo} style={styles.logo} />
            <View>
              <Text style={styles.logoTitle}>VIREM</Text>
              <Text style={styles.logoSub}>Portal Medico</Text>
            </View>
          </View>

          <View style={styles.userCard}>
            <Image source={userAvatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{doctorName}</Text>
            <Text style={styles.userSpec}>{doctorSpec}</Text>
          </View>

          <View style={styles.menu}>
            {sideItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, item.active ? styles.menuItemActive : null]}
                onPress={() => handleSideItemPress(item)}
              >
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={item.active ? colors.primary : colors.muted}
                />
                <Text style={[styles.menuText, item.active ? styles.menuTextActive : null]}>
                  {item.label}
                </Text>
                {item.badge ? (
                  <View style={[styles.badge, { backgroundColor: item.badge.color }]}>
                    <Text style={styles.badgeText}>{item.badge.text}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Agenda Medica</Text>
              <Text style={styles.pageSubtitle}>Administra tus citas y acciones de seguimiento.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerDate}>{dateText}</Text>
              <Text style={styles.headerTime}>{timeText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={19} color={colors.muted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
            placeholder="Buscar por paciente, estado o nota"
            placeholderTextColor="#8ca7bd"
          />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Proximas citas</Text>
          <Text style={styles.sectionCount}>{upcomingCitas.length}</Text>
        </View>
        <View style={styles.sectionCard}>
          {loadingCitas ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : upcomingCitas.length ? (
            upcomingCitas.map((cita) => (
              <View key={cita.citaid} style={styles.citaCard}>
                <View style={styles.citaTop}>
                  <View style={styles.citaMeta}>
                    <Text style={styles.citaPatient}>{normalizeText(cita?.paciente?.nombreCompleto || 'Paciente')}</Text>
                    <Text style={styles.citaSub}>
                      {normalizeText(cita?.estado || 'Pendiente')} · {formatDateTime(cita?.fechaHoraInicio)}
                    </Text>
                    <Text style={styles.citaNote}>
                      {normalizeText(cita?.nota || 'Consulta programada sin nota adicional.')}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() =>
                      Alert.alert(
                        'Videollamada',
                        `Paciente: ${normalizeText(cita?.paciente?.nombreCompleto || 'Paciente')}\nHora: ${formatDateTime(
                          cita?.fechaHoraInicio
                        )}`
                      )
                    }
                  >
                    <MaterialIcons name="videocam" size={16} color="#fff" />
                    <Text style={styles.primaryActionText}>Iniciar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    disabled={workingCitaId === cita.citaid}
                    onPress={() => manageCita(cita, 'reschedule')}
                  >
                    <Text style={styles.secondaryActionText}>Reprogramar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    disabled={workingCitaId === cita.citaid}
                    onPress={() => manageCita(cita, 'complete')}
                  >
                    <Text style={styles.secondaryActionText}>Completar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    disabled={workingCitaId === cita.citaid}
                    onPress={() => manageCita(cita, 'cancel')}
                  >
                    <Text style={styles.secondaryActionText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() =>
                      navigation.navigate('MedicoChat', {
                        patientId: String(cita?.paciente?.pacienteid || ''),
                        patientName: normalizeText(cita?.paciente?.nombreCompleto || 'Paciente'),
                      })
                    }
                  >
                    <Text style={styles.secondaryActionText}>Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryAction} onPress={() => showDetails(cita)}>
                    <Text style={styles.secondaryActionText}>Detalles</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No tienes citas proximas.</Text>
          )}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Historial reciente</Text>
          <Text style={styles.sectionCount}>{historyCitas.length}</Text>
        </View>
        <View style={styles.sectionCard}>
          {historyCitas.length ? (
            historyCitas.slice(0, 25).map((cita) => (
              <View key={`history-${cita.citaid}`} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{normalizeText(cita?.paciente?.nombreCompleto || 'Paciente')}</Text>
                  <Text style={styles.historySub}>
                    {normalizeText(cita?.estado || 'Pendiente')} · {formatDateTime(cita?.fechaHoraInicio)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smallAction}
                  onPress={() =>
                    navigation.navigate('MedicoChat', {
                      patientId: String(cita?.paciente?.pacienteid || ''),
                      patientName: normalizeText(cita?.paciente?.nombreCompleto || 'Paciente'),
                    })
                  }
                >
                  <Text style={styles.smallActionText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallAction} onPress={() => showDetails(cita)}>
                  <Text style={styles.smallActionText}>Ver</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No hay historial para mostrar.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  light: '#B3CFE5',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: 10,
  },
  loaderText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  container: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: colors.bg,
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
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, resizeMode: 'contain' },
  logoTitle: { color: colors.dark, fontSize: 20, fontWeight: '800' },
  logoSub: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  userCard: { alignItems: 'center', marginTop: 18, marginBottom: 10 },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: '#f0f4f9',
    marginBottom: 10,
  },
  userName: { color: colors.dark, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  userSpec: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  menu: { marginTop: 12, gap: 6 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  menuItemActive: { backgroundColor: 'rgba(19,127,236,0.12)' },
  menuText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  menuTextActive: { color: colors.primary, fontWeight: '800' },
  badge: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  logoutBtn: {
    marginTop: 16,
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutText: { color: '#fff', fontWeight: '800' },
  main: { flex: 1 },
  headerWrap: {
    paddingHorizontal: Platform.OS === 'web' ? 32 : 14,
    paddingTop: Platform.OS === 'web' ? 32 : 14,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start',
    gap: 12,
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start' },
  headerDate: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  headerTime: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pageTitle: { color: colors.dark, fontSize: 30, fontWeight: '900' },
  pageSubtitle: { color: colors.muted, fontSize: 16, marginTop: 4, fontWeight: '500' },
  searchWrap: {
    marginHorizontal: Platform.OS === 'web' ? 32 : 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d6e4f3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: colors.dark, fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  sectionHead: {
    marginHorizontal: Platform.OS === 'web' ? 32 : 14,
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: colors.dark, fontSize: 20, fontWeight: '900' },
  sectionCount: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  sectionCard: {
    marginHorizontal: Platform.OS === 'web' ? 32 : 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4edf7',
    padding: 12,
    gap: 10,
  },
  citaCard: {
    borderWidth: 1,
    borderColor: '#e8eff8',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  citaTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  citaMeta: { flex: 1 },
  citaPatient: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  citaSub: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 1 },
  citaNote: { color: colors.muted, fontSize: 12, marginTop: 3, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  secondaryAction: {
    borderWidth: 1,
    borderColor: '#d6e2f0',
    backgroundColor: '#f6f9fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondaryActionText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  historyRow: {
    borderWidth: 1,
    borderColor: '#e8eff8',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyName: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  historySub: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  smallAction: {
    borderWidth: 1,
    borderColor: '#d8e5f3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f7fafe',
  },
  smallActionText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700', paddingVertical: 12 },
});

export default MedicoCitasScreen;
