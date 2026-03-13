import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const ViremLogo = require('./assets/imagenes/descarga.png');

// Usa tu logo como avatar default (para no depender de avatar-default.png)
const DefaultAvatar = ViremLogo;

const PatientAvatar: ImageSourcePropType = {
  uri: 'https://i.pravatar.cc/150?img=22',
};

type SideItem = {
  icon: string;
  label: string;
  badge?: { text: string; color: string };
  active?: boolean;
  route?: keyof RootStackParamList;
};

type StatCardProps = {
  title: string;
  value: string;
  icon: string;
  trendText: string;
  trendUp?: boolean;
};

type AgendaItemProps = {
  time: string;
  name: string;
  detail: string;
};

type FileCardProps = {
  name: string;
  id: string;
  lastSeen: string;
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
        name={icon}
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
        <MaterialIcons name={icon} size={20} color={colors.primary} />
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

const AgendaRow: React.FC<AgendaItemProps> = ({ time, name, detail }) => (
  <TouchableOpacity activeOpacity={0.85} style={styles.agendaRow}>
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

const FileCard: React.FC<FileCardProps> = ({ name, id, lastSeen }) => (
  <TouchableOpacity activeOpacity={0.85} style={styles.fileCard}>
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
  const initialMedicoUi = useMemo(() => getInitialMedicoUiFromWeb(), []);
  const [doctorName, setDoctorName] = useState(initialMedicoUi.doctorName);
  const [doctorSpec, setDoctorSpec] = useState(initialMedicoUi.doctorSpec);
  const [doctorAvatar, setDoctorAvatar] = useState<ImageSourcePropType>(initialMedicoUi.doctorAvatar);
  const [dashboardData, setDashboardData] = useState<DashboardPayload>(EMPTY_DASHBOARD);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [profileReady, setProfileReady] = useState(initialMedicoUi.hasSeed);

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
  }, [loadDashboardData]);

  useEffect(() => {
    loadMedicoProfile();
  }, [loadMedicoProfile]);

  useFocusEffect(
    useCallback(() => {
      loadMedicoProfile();
    }, [loadMedicoProfile])
  );

  const handleLogout = async () => {
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

  const sideItems: SideItem[] = [
    { icon: 'dashboard', label: 'Dashboard', active: true, route: 'DashboardMedico' },
    { icon: 'calendar-today', label: 'Agenda' },
    { icon: 'group', label: 'Pacientes' },
    { icon: 'notification-important', label: 'Solicitudes', badge: { text: '5', color: colors.red } },
    { icon: 'chat-bubble', label: 'Mensajes', badge: { text: '3', color: colors.primary } },
    { icon: 'person', label: 'Perfil', route: 'MedicoPerfil' },
    { icon: 'settings', label: 'Configuración' },
  ];

  const handleSideItemPress = (item: SideItem) => {
    if (!item.route) return;
    if (item.route === 'DashboardMedico') return;
    navigation.navigate(item.route);
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
    <View style={styles.container}>
      {/* ===================== SIDEBAR ===================== */}
      <View style={styles.sidebar}>
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
          <View style={styles.nav}>
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
      {/* ===================== MAIN ===================== */}
      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
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
                  <Text style={styles.bannerTitle}>Videollamada con Juan Pérez</Text>
                </View>
                <Text style={styles.bannerSub}>
                  Consulta de Seguimiento Post-Operatorio • Programada 10:30 AM
                </Text>
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.9} style={styles.bannerBtn} onPress={() => {}}>
              <MaterialIcons name="videocam" size={20} color="#fff" />
              <Text style={styles.bannerBtnText}>Iniciar Videollamada</Text>
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
              <TouchableOpacity>
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
              <TouchableOpacity>
                <Text style={styles.sectionLink}>Ver todos</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filesGrid}>
              {dashboardData.expedientesRecientes.length ? (
                dashboardData.expedientesRecientes.map((item) => (
                  <FileCard key={item.id || item.code} name={item.name} id={item.code} lastSeen={item.lastSeenText} />
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
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: colors.bgLight,
  },

  /* Sidebar */
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
    flex: Platform.OS === 'web' ? 1 : 0,
    flexDirection: Platform.OS === 'web' ? 'column' : 'row',
    flexWrap: 'wrap',
  },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: Platform.OS === 'web' ? 0 : 150,
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

