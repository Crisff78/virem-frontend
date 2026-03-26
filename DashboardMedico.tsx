import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation/types';
import { apiUrl } from './config/backend';

// ✅ Expo:
// import { MaterialIcons } from '@expo/vector-icons';

// ✅ RN vector icons:
import { MaterialIcons } from '@expo/vector-icons';

const ViremLogo = require('./assets/imagenes/descarga.png');
type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');
const PatientAvatar: ImageSourcePropType = DefaultAvatar;

type SideItem = {
  icon: MaterialIconName;
  label: string;
  badge?: { text: string; color: string };
  active?: boolean;
  route?: 'DashboardMedico' | 'MedicoPerfil' | 'MedicoCitas' | 'MedicoPacientes' | 'MedicoChat';
};

type StatCardProps = {
  title: string;
  value: string;
  icon: MaterialIconName;
  trendText: string;
  trendUp?: boolean;
};

type AgendaItemProps = {
  time: string;
  name: string;
  detail: string;
  onPress?: () => void;
};

type FileCardProps = {
  name: string;
  id: string;
  lastSeen: string;
  onPress?: () => void;
};

type SessionUser = {
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

type CachedMedicoProfile = {
  nombreCompleto?: string;
  especialidad?: string;
  fotoUrl?: string;
};

type InitialMedicoUi = {
  doctorName: string;
  doctorSpec: string;
  doctorAvatar: ImageSourcePropType;
  hasSeed: boolean;
};

type DashboardStats = {
  citasCompletadas: number;
  citasHoy: number;
  nuevosPacientesMes: number;
  mensajesPendientes: number;
};

type DashboardAgendaItem = {
  id: string;
  time: string;
  name: string;
  detail: string;
  patientId?: string;
  patientCode?: string;
  fechaHoraInicio?: string | null;
};

type DashboardExpedienteItem = {
  id: string;
  name: string;
  code: string;
  lastSeenText: string;
  lastSeenAt?: string | null;
};

type DashboardPayload = {
  stats: DashboardStats;
  agendaHoy: DashboardAgendaItem[];
  expedientesRecientes: DashboardExpedienteItem[];
};

type MedicoUpcomingCita = {
  citaid: string;
  fechaHoraInicio: string | null;
  estado: string;
  paciente: {
    pacienteid: string;
    nombreCompleto: string;
  };
};

const LEGACY_USER_STORAGE_KEY = 'userProfile';
const MEDICO_CACHE_BY_EMAIL_KEY = 'medicoProfileByEmail';
const ASYNC_USER_KEY = 'user';
const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';
const EMPTY_DASHBOARD: DashboardPayload = {
  stats: {
    citasCompletadas: 0,
    citasHoy: 0,
    nuevosPacientesMes: 0,
    mensajesPendientes: 0,
  },
  agendaHoy: [],
  expedientesRecientes: [],
};
const MIN_REFRESH_INTERVAL_MS = 12000;

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const addDoctorPrefix = (rawName: string): string => {
  const clean = String(rawName || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Doctor';

  const normalized = clean.toLowerCase();
  if (normalized.startsWith('dr ') || normalized.startsWith('dr.')) return clean;
  return `Dr. ${clean}`;
};

const sanitizeFotoUrl = (value: unknown): string => {
  const clean = String(value || '').trim();
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

const getInitialMedicoUiFromWeb = (): InitialMedicoUi => {
  if (Platform.OS !== 'web') {
    return {
      doctorName: 'Doctor',
      doctorSpec: 'Especialidad no definida',
      doctorAvatar: DefaultAvatar,
      hasSeed: false,
    };
  }

  try {
    const rawUser = localStorage.getItem(LEGACY_USER_STORAGE_KEY);
    const sessionUser = parseJson<SessionUser>(rawUser);
    const email = String(sessionUser?.email || '').trim().toLowerCase();
    const rawCache = localStorage.getItem(MEDICO_CACHE_BY_EMAIL_KEY);
    const cacheMap = parseJson<Record<string, CachedMedicoProfile>>(rawCache) || {};
    const cached = email ? cacheMap[email] || null : null;

    const nameBase = String(
      sessionUser?.nombreCompleto || sessionUser?.medico?.nombreCompleto || cached?.nombreCompleto || ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    const specBase = String(
      sessionUser?.especialidad || sessionUser?.medico?.especialidad || cached?.especialidad || ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    const fotoBase = sanitizeFotoUrl(
      sessionUser?.fotoUrl || sessionUser?.medico?.fotoUrl || cached?.fotoUrl || ''
    );

    return {
      doctorName: nameBase ? addDoctorPrefix(nameBase) : 'Doctor',
      doctorSpec: specBase || 'Especialidad no definida',
      doctorAvatar: fotoBase ? { uri: fotoBase } : DefaultAvatar,
      hasSeed: Boolean(nameBase || specBase || fotoBase),
    };
  } catch {
    return {
      doctorName: 'Doctor',
      doctorSpec: 'Especialidad no definida',
      doctorAvatar: DefaultAvatar,
      hasSeed: false,
    };
  }
};

const colors = {
  primary: '#137fec',
  viremDark: '#0A1931',
  viremLight: '#B3CFE5',
  viremMuted: '#4A7FA7',
  viremDeep: '#1A3D63',
  bgLight: '#F6FAFD',
  white: '#FFFFFF',
  green: '#16a34a',
  red: '#ef4444',
};

const SidebarItem: React.FC<SideItem & { onPress?: () => void }> = ({
  icon,
  label,
  badge,
  active,
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.sideItem, active ? styles.sideItemActive : null]}
      activeOpacity={0.85}
    >
      <MaterialIcons
        name={icon as any}
        size={20}
        color={active ? colors.primary : colors.viremMuted}
      />
      <Text style={[styles.sideItemText, active ? styles.sideItemTextActive : null]}>
        {label}
      </Text>

      {badge ? (
        <View style={[styles.badge, { backgroundColor: badge.color }]}>
          <Text style={styles.badgeText}>{badge.text}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trendText, trendUp = true }) => {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTopRow}>
        <Text style={styles.statTitle}>{title}</Text>
        <MaterialIcons name={icon as any} size={20} color={colors.primary} />
      </View>

      <View style={styles.statBottomRow}>
        <Text style={styles.statValue}>{value}</Text>
        <View style={styles.trendRow}>
          <MaterialIcons
            name={trendUp ? 'trending-up' : 'trending-down'}
            size={16}
            color={trendUp ? colors.green : colors.red}
          />
          <Text style={[styles.trendText, { color: trendUp ? colors.green : colors.red }]}>
            {trendText}
          </Text>
        </View>
      </View>
    </View>
  );
};

const AgendaRow: React.FC<AgendaItemProps> = ({ time, name, detail, onPress }) => (
  <TouchableOpacity activeOpacity={0.85} style={styles.agendaRow} onPress={onPress}>
    <View style={styles.agendaLeft}>
      <Text style={styles.agendaTime}>{time}</Text>
      <View style={styles.agendaTexts}>
        <Text style={styles.agendaName}>{name}</Text>
        <Text style={styles.agendaDetail}>{detail}</Text>
      </View>
    </View>
    <MaterialIcons name="chevron-right" size={22} color={colors.viremLight} />
  </TouchableOpacity>
);

const FileCard: React.FC<FileCardProps> = ({ name, id, lastSeen, onPress }) => (
  <TouchableOpacity activeOpacity={0.85} style={styles.fileCard} onPress={onPress}>
    <View style={styles.fileTop}>
      <View style={styles.fileIconBox}>
        <MaterialIcons name="folder-shared" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fileName}>{name}</Text>
        <Text style={styles.fileId}>{id}</Text>
      </View>
    </View>
    <Text style={styles.fileLastSeen}>{lastSeen}</Text>
  </TouchableOpacity>
);

const DashboardMedico: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const initialMedicoUi = useMemo(() => getInitialMedicoUiFromWeb(), []);
  const [doctorName, setDoctorName] = useState(initialMedicoUi.doctorName);
  const [doctorSpec, setDoctorSpec] = useState(initialMedicoUi.doctorSpec);
  const [doctorAvatar, setDoctorAvatar] = useState<ImageSourcePropType>(initialMedicoUi.doctorAvatar);
  const [dashboardData, setDashboardData] = useState<DashboardPayload>(EMPTY_DASHBOARD);
  const [upcomingCitas, setUpcomingCitas] = useState<MedicoUpcomingCita[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [profileReady, setProfileReady] = useState(initialMedicoUi.hasSeed);
  const lastRefreshRef = useRef(0);

  const loadDashboardData = useCallback(async (authToken: string) => {
    if (!authToken) {
      setDashboardData(EMPTY_DASHBOARD);
      return;
    }

    setLoadingDashboard(true);
    try {
      const response = await fetch(apiUrl('/api/users/me/dashboard-medico'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const payload = await response.json().catch(() => null);

      if (!(response.ok && payload?.success && payload?.dashboard)) {
        setDashboardData(EMPTY_DASHBOARD);
        return;
      }

      const dashboard = payload.dashboard;
      const profile = dashboard?.profile || {};

      const nextStats: DashboardStats = {
        citasCompletadas: Number(dashboard?.stats?.citasCompletadas || 0),
        citasHoy: Number(dashboard?.stats?.citasHoy || 0),
        nuevosPacientesMes: Number(dashboard?.stats?.nuevosPacientesMes || 0),
        mensajesPendientes: Number(dashboard?.stats?.mensajesPendientes || 0),
      };

      const nextAgenda: DashboardAgendaItem[] = Array.isArray(dashboard?.agendaHoy)
        ? dashboard.agendaHoy.map((item: any) => ({
            id: String(item?.id || ''),
            time: String(item?.time || ''),
            name: String(item?.name || 'Paciente'),
            detail: String(item?.detail || 'Consulta programada'),
            patientId: String(item?.patientId || ''),
            patientCode: String(item?.patientCode || ''),
            fechaHoraInicio: item?.fechaHoraInicio || null,
          }))
        : [];

      const nextExpedientes: DashboardExpedienteItem[] = Array.isArray(dashboard?.expedientesRecientes)
        ? dashboard.expedientesRecientes.map((item: any) => ({
            id: String(item?.id || ''),
            name: String(item?.name || 'Paciente'),
            code: String(item?.code || ''),
            lastSeenText: String(item?.lastSeenText || 'Sin historial'),
            lastSeenAt: item?.lastSeenAt || null,
          }))
        : [];

      setDashboardData({
        stats: nextStats,
        agendaHoy: nextAgenda,
        expedientesRecientes: nextExpedientes,
      });

      const backendName = String(profile?.nombreCompleto || '').replace(/\s+/g, ' ').trim();
      const backendSpec = String(profile?.especialidad || '').replace(/\s+/g, ' ').trim();
      const backendFoto = sanitizeFotoUrl(profile?.fotoUrl);

      if (backendName) setDoctorName(addDoctorPrefix(backendName));
      if (backendSpec) setDoctorSpec(backendSpec);
      if (backendFoto) setDoctorAvatar({ uri: backendFoto });
    } catch {
      setDashboardData(EMPTY_DASHBOARD);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const loadUpcomingCitas = useCallback(async (authToken: string) => {
    if (!authToken) {
      setUpcomingCitas([]);
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/agenda/me/citas?scope=upcoming&limit=20'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const payload = await response.json().catch(() => null);
      if (!(response.ok && payload?.success && Array.isArray(payload?.citas))) {
        setUpcomingCitas([]);
        return;
      }

      const mapped = (payload.citas as any[]).map((item) => ({
        citaid: String(item?.citaid || ''),
        fechaHoraInicio: item?.fechaHoraInicio || null,
        estado: String(item?.estado || 'Pendiente'),
        paciente: {
          pacienteid: String(item?.paciente?.pacienteid || ''),
          nombreCompleto: String(item?.paciente?.nombreCompleto || 'Paciente'),
        },
      }));

      mapped.sort((a, b) => parseDateMs(a?.fechaHoraInicio) - parseDateMs(b?.fechaHoraInicio));
      setUpcomingCitas(mapped);
    } catch {
      setUpcomingCitas([]);
    }
  }, []);

  const loadMedicoProfile = useCallback(async () => {
    try {
      const rawUserFromStorage =
        Platform.OS === 'web'
          ? localStorage.getItem(LEGACY_USER_STORAGE_KEY)
          : await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY);
      const rawUserFromAsync = await AsyncStorage.getItem(ASYNC_USER_KEY);

      const rawTokenFromStorage =
        Platform.OS === 'web'
          ? localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
          : (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
            (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
      const rawTokenFromAsync = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);

      let sessionUser =
        parseJson<SessionUser>(rawUserFromStorage) || parseJson<SessionUser>(rawUserFromAsync);
      const authToken = String(rawTokenFromStorage || rawTokenFromAsync || '').trim();

      await loadDashboardData(authToken);
      await loadUpcomingCitas(authToken);

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
            sessionUser = {
              ...(sessionUser || {}),
              ...(payload.user as SessionUser),
            };
            const rawNextUser = JSON.stringify(sessionUser);

            try {
              await AsyncStorage.setItem(ASYNC_USER_KEY, rawNextUser);
            } catch {}

            try {
              if (Platform.OS === 'web') {
                localStorage.setItem(LEGACY_USER_STORAGE_KEY, rawNextUser);
                localStorage.setItem(ASYNC_USER_KEY, rawNextUser);
              } else {
                await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, rawNextUser);
              }
            } catch {}
          }
        } catch {
          // Non-blocking: fallback to cached data
        }

        try {
          const profileResponse = await fetch(apiUrl('/api/users/me/profile'), {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
          const profilePayload = await profileResponse.json().catch(() => null);
          const serverFoto = sanitizeFotoUrl(profilePayload?.profile?.fotoUrl || '');
          if (serverFoto) {
            sessionUser = {
              ...(sessionUser || {}),
              fotoUrl: serverFoto,
            };
            const rawUserWithServerFoto = JSON.stringify(sessionUser);
            try {
              await AsyncStorage.setItem(ASYNC_USER_KEY, rawUserWithServerFoto);
            } catch {}
            try {
              if (Platform.OS === 'web') {
                localStorage.setItem(LEGACY_USER_STORAGE_KEY, rawUserWithServerFoto);
                localStorage.setItem(ASYNC_USER_KEY, rawUserWithServerFoto);
              } else {
                await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, rawUserWithServerFoto);
              }
            } catch {}
          }
        } catch {
          // Non-blocking: keep current cached photo.
        }
      }

      if (!sessionUser) {
        setDoctorName('Doctor');
        setDoctorSpec('Especialidad no definida');
        setDoctorAvatar(DefaultAvatar);
        return;
      }

      const email = String(sessionUser.email || '').trim().toLowerCase();
      const cacheRaw =
        Platform.OS === 'web'
          ? localStorage.getItem(MEDICO_CACHE_BY_EMAIL_KEY)
          : await SecureStore.getItemAsync(MEDICO_CACHE_BY_EMAIL_KEY);
      const cacheMap = parseJson<Record<string, CachedMedicoProfile>>(cacheRaw) || {};

      if (email) {
        const previous = cacheMap[email] || {};
        cacheMap[email] = {
          ...previous,
          nombreCompleto: String(
            sessionUser.nombreCompleto || sessionUser.medico?.nombreCompleto || previous.nombreCompleto || ''
          )
            .replace(/\s+/g, ' ')
            .trim(),
          especialidad: String(
            sessionUser.especialidad || sessionUser.medico?.especialidad || previous.especialidad || ''
          )
            .replace(/\s+/g, ' ')
            .trim(),
          fotoUrl: sanitizeFotoUrl(
            sessionUser.fotoUrl || sessionUser.medico?.fotoUrl || previous.fotoUrl || ''
          ),
        };

        const rawNextCache = JSON.stringify(cacheMap);
        try {
          if (Platform.OS === 'web') {
            localStorage.setItem(MEDICO_CACHE_BY_EMAIL_KEY, rawNextCache);
          } else {
            await SecureStore.setItemAsync(MEDICO_CACHE_BY_EMAIL_KEY, rawNextCache);
          }
        } catch {}
      }

      const cached = email ? cacheMap[email] : null;
      const cachedFoto = sanitizeFotoUrl(cached?.fotoUrl || '');
      const currentFoto = sanitizeFotoUrl(sessionUser.fotoUrl || sessionUser.medico?.fotoUrl || '');

      if (authToken && email && !currentFoto && cachedFoto) {
        try {
          const syncResponse = await fetch(apiUrl('/api/users/me/profile'), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ fotoUrl: cachedFoto }),
          });
          const syncPayload = await syncResponse.json().catch(() => null);
          if (syncResponse.ok && syncPayload?.success) {
            const syncedFoto = sanitizeFotoUrl(syncPayload?.profile?.fotoUrl || cachedFoto);
            sessionUser = {
              ...sessionUser,
              fotoUrl: syncedFoto,
            };

            const rawSyncedUser = JSON.stringify(sessionUser);
            try {
              await AsyncStorage.setItem(ASYNC_USER_KEY, rawSyncedUser);
            } catch {}
            try {
              if (Platform.OS === 'web') {
                localStorage.setItem(LEGACY_USER_STORAGE_KEY, rawSyncedUser);
                localStorage.setItem(ASYNC_USER_KEY, rawSyncedUser);
              } else {
                await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, rawSyncedUser);
              }
            } catch {}

            cacheMap[email] = {
              ...cacheMap[email],
              fotoUrl: syncedFoto,
            };
            const rawSyncedCache = JSON.stringify(cacheMap);
            try {
              if (Platform.OS === 'web') {
                localStorage.setItem(MEDICO_CACHE_BY_EMAIL_KEY, rawSyncedCache);
              } else {
                await SecureStore.setItemAsync(MEDICO_CACHE_BY_EMAIL_KEY, rawSyncedCache);
              }
            } catch {}
          }
        } catch {
          // Non-blocking: keep local cached photo and retry on next load.
        }
      }

      const nombreBase = String(
        sessionUser.nombreCompleto || sessionUser.medico?.nombreCompleto || cached?.nombreCompleto || ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const especialidadBase = String(
        sessionUser.especialidad || sessionUser.medico?.especialidad || cached?.especialidad || ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const fotoBase = sanitizeFotoUrl(
        sessionUser.fotoUrl || sessionUser.medico?.fotoUrl || cached?.fotoUrl || ''
      );

      setDoctorName(nombreBase ? addDoctorPrefix(nombreBase) : 'Doctor');
      setDoctorSpec(especialidadBase || 'Especialidad no definida');
      setDoctorAvatar(fotoBase ? { uri: fotoBase } : DefaultAvatar);
    } catch {
      // Keep defaults if storage is unavailable
      setDoctorName('Doctor');
      setDoctorSpec('Especialidad no definida');
      setDoctorAvatar(DefaultAvatar);
      setDashboardData(EMPTY_DASHBOARD);
    } finally {
      setProfileReady(true);
    }
  }, [loadDashboardData, loadUpcomingCitas]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshRef.current = now;
      loadMedicoProfile();
    }, [loadMedicoProfile])
  );

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    try {
      await AsyncStorage.removeItem(ASYNC_USER_KEY);
      await AsyncStorage.removeItem(LEGACY_USER_STORAGE_KEY);
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);

      if (Platform.OS === 'web') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
        localStorage.removeItem(ASYNC_USER_KEY);
      } else {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_USER_STORAGE_KEY);
        await SecureStore.deleteItemAsync(ASYNC_USER_KEY);
      }

      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch {
      Alert.alert('Error', 'No se pudo cerrar la sesión. Intenta nuevamente.');
    }
  };

  const dateText = useMemo(
    () =>
      new Intl.DateTimeFormat('es-DO', {
        weekday: 'long',
        day: '2-digit',
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
  const nextCita = upcomingCitas[0] || null;
  const bannerPatientName = String(nextCita?.paciente?.nombreCompleto || '').trim() || 'Paciente';
  const bannerCitaText = nextCita
    ? `${formatDateTime(nextCita.fechaHoraInicio)} · ${String(nextCita.estado || 'Pendiente').trim() || 'Pendiente'}`
    : 'No tienes videoconsultas pendientes';

  const sideItems: SideItem[] = [
    { icon: 'dashboard', label: 'Dashboard', active: true, route: 'DashboardMedico' },
    { icon: 'calendar-today', label: 'Agenda', route: 'MedicoCitas' },
    { icon: 'group', label: 'Pacientes', route: 'MedicoPacientes' },
    { icon: 'notification-important', label: 'Solicitudes', badge: { text: '5', color: colors.red } },
    { icon: 'chat-bubble', label: 'Mensajes', badge: { text: '3', color: colors.primary }, route: 'MedicoChat' },
    { icon: 'person', label: 'Perfil', route: 'MedicoPerfil' },
    { icon: 'settings', label: 'Configuracion', route: 'MedicoPerfil' },
  ];

  const handleSideItemPress = (item: SideItem) => {
    setIsMobileMenuOpen(false);
    if (!item.route) {
      Alert.alert('Solicitudes', 'Las solicitudes pendientes se integraran en un modulo dedicado.');
      return;
    }
    if (item.route === 'DashboardMedico') return;
    navigation.navigate(item.route);
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  const handleVideoCall = () => {
    const nextAgenda = upcomingCitas[0] || null;
    if (!nextAgenda) {
      Alert.alert('Videollamada', 'No tienes citas disponibles para iniciar en este momento.');
      return;
    }

    Alert.alert(
      'Videollamada lista',
      `Paciente: ${nextAgenda.paciente?.nombreCompleto || 'Paciente'}\nHora: ${formatDateTime(
        nextAgenda.fechaHoraInicio
      )}\nEstado: ${nextAgenda.estado}`
    );
  };

  if (!profileReady) {
    return (
      <View style={styles.initialLoaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.initialLoaderText}>Cargando perfil medico...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDesktopLayout ? styles.containerDesktop : styles.containerMobile]}>
      {!isDesktopLayout ? (
        <View style={styles.mobileMenuBar}>
          <TouchableOpacity style={styles.mobileMenuButton} onPress={toggleMobileMenu}>
            <MaterialIcons name={isMobileMenuOpen ? 'close' : 'menu'} size={22} color={colors.viremDark} />
            <Text style={styles.mobileMenuButtonText}>
              {isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ===================== SIDEBAR ===================== */}
      {(isDesktopLayout || isMobileMenuOpen) && (
      <View style={[styles.sidebar, isDesktopLayout ? styles.sidebarDesktop : styles.sidebarMobile]}>
        <View>
          {/* Logo */}
          <View style={styles.logoBox}>
            <Image source={ViremLogo} style={styles.logo} />
            <View>
              <Text style={styles.logoTitle}>VIREM</Text>
              <Text style={styles.logoSubtitle}>Portal Medico</Text>
            </View>
          </View>

          {/* Perfil mini */}
          <View style={styles.userBox}>
            <Image source={doctorAvatar} style={styles.userAvatar} />
            <Text numberOfLines={1} style={styles.userName}>
              {doctorName}
            </Text>
            <Text numberOfLines={1} style={styles.userSpec}>
              {doctorSpec}
            </Text>
          </View>

          {/* Nav */}
          <View style={[styles.nav, isDesktopLayout ? styles.navDesktop : styles.navMobile]}>
            {sideItems.map((it) => (
              <SidebarItem
                key={it.label}
                icon={it.icon}
                label={it.label}
                badge={it.badge}
                active={it.active}
                onPress={() => handleSideItemPress(it)}
              />
            ))}
          </View>
        </View>

        {/* Cerrar sesion */}
        <TouchableOpacity activeOpacity={0.88} style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Cerrar sesion</Text>
        </TouchableOpacity>
      </View>
      )}
      {/* ===================== MAIN ===================== */}
      <ScrollView style={[styles.main, !isDesktopLayout ? styles.mainMobile : null]} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* Header */}
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.h1}>Dashboard del Médico</Text>
              <Text style={styles.hSub}>
                Bienvenido de nuevo, {doctorName}. Aquí está el resumen de su jornada para hoy.
              </Text>
            </View>

            <View style={styles.headerRight}>
              <Text style={styles.headerDate}>{dateText}</Text>
              <Text style={styles.headerTime}>{timeText}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Citas Completadas"
            value={String(dashboardData.stats.citasCompletadas)}
            icon="check-circle"
            trendText={`${dashboardData.stats.citasHoy} hoy`}
            trendUp
          />
          <StatCard
            title="Nuevos Pacientes"
            value={String(dashboardData.stats.nuevosPacientesMes)}
            icon="person-add"
            trendText="Este mes"
            trendUp
          />
          <StatCard
            title="Mensajes Pendientes"
            value={String(dashboardData.stats.mensajesPendientes)}
            icon="mail"
            trendText={loadingDashboard ? 'Cargando...' : 'Sincronizado'}
            trendUp={dashboardData.stats.mensajesPendientes === 0}
          />
        </View>

        {/* Banner call */}
        <View style={styles.banner}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerLeft}>
              <View style={styles.patientRing}>
                <Image source={PatientAvatar} style={styles.patientAvatar} />
              </View>

              <View style={styles.bannerTexts}>
                <View style={styles.bannerTitleRow}>
                  <View style={styles.nowPill}>
                    <Text style={styles.nowPillText}>AHORA</Text>
                  </View>
                  <Text style={styles.bannerTitle}>
                    {nextCita ? `Videollamada con ${bannerPatientName}` : 'Sin videoconsultas activas'}
                  </Text>
                </View>
                <Text style={styles.bannerSub}>{bannerCitaText}</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.bannerBtn, !nextCita ? styles.bannerBtnDisabled : null]}
              onPress={handleVideoCall}
            >
              <MaterialIcons name="videocam" size={20} color="#fff" />
              <Text style={styles.bannerBtnText}>{nextCita ? 'Iniciar Videollamada' : 'Sin cita activa'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bannerIconGhost}>
            <MaterialIcons name="video-call" size={160} color="#fff" />
          </View>
        </View>

        {/* Bottom grid */}
        <View style={styles.bottomGrid}>
          {/* Agenda */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Agenda de hoy</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MedicoCitas')}>
                <Text style={styles.sectionLink}>Ver calendario</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.boxCard}>
              {dashboardData.agendaHoy.length ? (
                dashboardData.agendaHoy.map((item) => (
                  <AgendaRow
                    key={item.id || `${item.time}-${item.name}`}
                    time={item.time}
                    name={item.name}
                    detail={item.detail}
                    onPress={() =>
                      navigation.navigate('MedicoChat', {
                        patientId: String(item.patientId || ''),
                        patientName: item.name,
                      })
                    }
                  />
                ))
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateText}>
                    {loadingDashboard ? 'Cargando agenda...' : 'No tienes citas agendadas para hoy.'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Expedientes */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Expedientes Recientes</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Expedientes',
                    `Expedientes recientes disponibles: ${dashboardData.expedientesRecientes.length}`
                  )
                }
              >
                <Text style={styles.sectionLink}>Ver todos</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filesGrid}>
              {dashboardData.expedientesRecientes.length ? (
                dashboardData.expedientesRecientes.map((item) => (
                  <FileCard
                    key={item.id || item.code}
                    name={item.name}
                    id={item.code}
                    lastSeen={item.lastSeenText}
                    onPress={() =>
                      navigation.navigate('MedicoChat', {
                        patientId: item.id,
                        patientName: item.name,
                      })
                    }
                  />
                ))
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateText}>
                    {loadingDashboard ? 'Cargando expedientes...' : 'Sin expedientes recientes.'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.searchWrap}>
              <View style={styles.searchBox}>
                <MaterialIcons name="search" size={18} color={colors.viremMuted} />
                <TextInput
                  placeholder="Buscar paciente por nombre o ID..."
                  placeholderTextColor={colors.viremMuted}
                  style={styles.searchInput}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default DashboardMedico;

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  initialLoaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgLight,
    gap: 10,
  },
  initialLoaderText: {
    color: colors.viremMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: colors.bgLight,
  },
  containerDesktop: { flexDirection: 'row' },
  containerMobile: { flexDirection: 'column' },
  mobileMenuBar: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.bgLight,
  },
  mobileMenuButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8e4f0',
    backgroundColor: colors.white,
  },
  mobileMenuButtonText: {
    color: colors.viremDark,
    fontWeight: '700',
    fontSize: 13,
  },

  /* Sidebar */
  sidebar: {
    backgroundColor: colors.white,
    justifyContent: 'space-between',
  },
  sidebarDesktop: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    padding: 20,
  },
  sidebarMobile: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    padding: 14,
  },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, resizeMode: 'contain' },
  logoTitle: {
    color: colors.viremDark,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logoSubtitle: {
    color: colors.viremMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  userBox: { marginTop: 18, alignItems: 'center', paddingVertical: 12 },
  userAvatar: {
    width: 76,
    height: 76,
    borderRadius: 76,
    marginBottom: 10,
    borderWidth: 4,
    borderColor: '#f5f7fb',
  },
  userName: { fontWeight: '800', color: colors.viremDark, fontSize: 14, textAlign: 'center' },
  userSpec: { color: colors.viremMuted, fontSize: 11, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  nav: {
    marginTop: 10,
    gap: 6,
  },
  navDesktop: { flex: 1 },
  navMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 150,
  },
  sideItemActive: {
    backgroundColor: 'rgba(19,127,236,0.10)',
  },
  sideItemText: {
    color: colors.viremMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  sideItemTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
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
    backgroundColor: colors.viremDeep,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutButtonText: { color: '#fff', fontWeight: '800' },

  /* Main */
  main: { flex: 1 },
  mainMobile: { paddingTop: 2 },

  headerWrap: {
    paddingHorizontal: Platform.OS === 'web' ? 32 : 14,
    paddingTop: Platform.OS === 'web' ? 32 : 14,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start',
    gap: 14,
  },
  headerLeft: { flex: 1 },
  h1: {
    color: colors.viremDark,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  hSub: {
    color: colors.viremMuted,
    fontSize: 16,
    marginTop: 6,
    fontWeight: '500',
  },
  headerRight: { alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start' },
  headerDate: { color: colors.viremDark, fontSize: 14, fontWeight: '800' },
  headerTime: { color: colors.viremMuted, fontSize: 12, marginTop: 2 },

  /* Stats */
  statsGrid: {
    paddingHorizontal: Platform.OS === 'web' ? 32 : 14,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.viremLight,
    borderRadius: 14,
    padding: 18,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' as any }
      : {
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }),
  },
  statTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statTitle: {
    color: colors.viremMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statBottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 },
  statValue: { color: colors.viremDark, fontSize: 30, fontWeight: '900' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 2 },
  trendText: { fontSize: 13, fontWeight: '800' },

  /* Banner */
  banner: {
    marginHorizontal: Platform.OS === 'web' ? 32 : 14,
    marginVertical: 16,
    backgroundColor: colors.viremDeep,
    borderRadius: 14,
    padding: 18,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 8px 16px rgba(10,25,49,0.18)' as any }
      : {
          shadowColor: '#0A1931',
          shadowOpacity: 0.18,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }),
  },
  bannerRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
    gap: 16,
    zIndex: 2,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  patientRing: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(19,127,236,0.30)',
    padding: 4,
  },
  patientAvatar: { width: '100%', height: '100%', borderRadius: 999 },
  bannerTexts: { flex: 1 },
  bannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  nowPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nowPillText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  bannerSub: { color: colors.viremLight, fontSize: 13, marginTop: 4, fontWeight: '600' },

  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  bannerBtnDisabled: {
    backgroundColor: '#7aa8d8',
  },
  bannerBtnText: { color: '#fff', fontWeight: '900' },

  bannerIconGhost: {
    position: 'absolute',
    right: -10,
    top: -10,
    opacity: 0.1,
    zIndex: 1,
  },

  /* Bottom grid */
  bottomGrid: {
    paddingHorizontal: Platform.OS === 'web' ? 32 : 14,
    paddingTop: 8,
    paddingBottom: 24,
    flexDirection: 'row',
    gap: 18,
    flexWrap: 'wrap',
  },
  section: {
    flexGrow: 1,
    flexBasis: 420,
    gap: 12,
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.viremDark, fontSize: 18, fontWeight: '900' },
  sectionLink: { color: colors.primary, fontSize: 13, fontWeight: '900' },

  boxCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.viremLight,
    borderRadius: 14,
    overflow: 'hidden',
  },
  emptyStateCard: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyStateText: {
    color: colors.viremMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  agendaRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.viremLight,
  },
  agendaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  agendaTime: { width: 72, color: colors.viremMuted, fontSize: 13, fontWeight: '900' },
  agendaTexts: { flex: 1 },
  agendaName: { color: colors.viremDark, fontSize: 13, fontWeight: '900' },
  agendaDetail: { color: colors.viremMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },

  filesGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  fileCard: {
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.viremLight,
    borderRadius: 14,
    padding: 14,
  },
  fileTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(179,207,229,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { color: colors.viremDark, fontSize: 13, fontWeight: '900' },
  fileId: { color: colors.viremMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  fileLastSeen: { color: colors.viremMuted, fontSize: 12, fontStyle: 'italic' },

  searchWrap: { marginTop: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.viremLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.viremDark, fontWeight: '600' },
});



