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
import { MaterialIcons } from '@expo/vector-icons';
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
  estado: string;
  paciente?: {
    pacienteid?: string;
    nombreCompleto?: string;
  };
};

type PatientRow = {
  id: string;
  name: string;
  totalCitas: number;
  upcomingCitas: number;
  lastEstado: string;
  nextDateMs: number;
  nextDateLabel: string;
  lastDateMs: number;
  lastDateLabel: string;
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
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
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

const MedicoPacientesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [patients, setPatients] = useState<PatientRow[]>([]);

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

  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setPatients([]);
        return;
      }

      const response = await fetch(apiUrl('/api/agenda/me/citas?scope=all&limit=400'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!(response.ok && payload?.success && Array.isArray(payload?.citas))) {
        setPatients([]);
        return;
      }

      const map = new Map<string, PatientRow>();
      const now = Date.now();
      for (const cita of payload.citas as CitaItem[]) {
        const patientId = normalizeText(cita?.paciente?.pacienteid);
        const patientName = normalizeText(cita?.paciente?.nombreCompleto || 'Paciente');
        const key = patientId || `patient:${patientName.toLowerCase()}`;
        const dateMs = parseDateMs(cita?.fechaHoraInicio);
        const estado = normalizeText(cita?.estado || 'Pendiente') || 'Pendiente';

        const current = map.get(key) || {
          id: key,
          name: patientName,
          totalCitas: 0,
          upcomingCitas: 0,
          lastEstado: estado,
          nextDateMs: Number.POSITIVE_INFINITY,
          nextDateLabel: 'Sin cita proxima',
          lastDateMs: Number.NEGATIVE_INFINITY,
          lastDateLabel: 'Sin historial',
        };

        current.totalCitas += 1;
        current.lastEstado = estado;

        if (dateMs >= now && dateMs < current.nextDateMs) {
          current.nextDateMs = dateMs;
          current.nextDateLabel = formatDateTime(cita?.fechaHoraInicio);
        }
        if (dateMs >= now) {
          current.upcomingCitas += 1;
        }
        if (dateMs < now && dateMs > current.lastDateMs) {
          current.lastDateMs = dateMs;
          current.lastDateLabel = formatDateTime(cita?.fechaHoraInicio);
        }

        map.set(key, current);
      }

      const rows = [...map.values()].sort((a, b) => {
        if (a.upcomingCitas !== b.upcomingCitas) return b.upcomingCitas - a.upcomingCitas;
        if (a.nextDateMs !== b.nextDateMs) return a.nextDateMs - b.nextDateMs;
        return a.name.localeCompare(b.name);
      });
      setPatients(rows);
    } catch {
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadPatients();
    }, [loadPatients, loadUser])
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

  const filteredPatients = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();
    if (!q) return patients;
    return patients.filter((item) => {
      const name = normalizeText(item.name).toLowerCase();
      const estado = normalizeText(item.lastEstado).toLowerCase();
      return name.includes(q) || estado.includes(q);
    });
  }, [patients, searchText]);

  const kpis = useMemo(() => {
    const total = patients.length;
    const withUpcoming = patients.filter((item) => item.upcomingCitas > 0).length;
    const withoutUpcoming = Math.max(0, total - withUpcoming);
    return { total, withUpcoming, withoutUpcoming };
  }, [patients]);

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
    { icon: 'calendar-today', label: 'Agenda', route: 'MedicoCitas' },
    { icon: 'group', label: 'Pacientes', route: 'MedicoPacientes', active: true },
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
    if (item.route === 'MedicoPacientes') return;
    navigation.navigate(item.route);
  };

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Cargando pacientes del medico...</Text>
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
                  name={item.icon as any}
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
              <Text style={styles.pageTitle}>Pacientes</Text>
              <Text style={styles.pageSubtitle}>Visualiza y da seguimiento a tus pacientes activos.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerDate}>{dateText}</Text>
              <Text style={styles.headerTime}>{timeText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pacientes totales</Text>
            <Text style={styles.kpiValue}>{kpis.total}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Con cita proxima</Text>
            <Text style={styles.kpiValue}>{kpis.withUpcoming}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Sin cita proxima</Text>
            <Text style={styles.kpiValue}>{kpis.withoutUpcoming}</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={19} color={colors.muted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
            placeholder="Buscar por nombre o estado"
            placeholderTextColor="#8ca7bd"
          />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Listado de pacientes</Text>
          <Text style={styles.sectionCount}>{filteredPatients.length}</Text>
        </View>

        <View style={styles.sectionCard}>
          {loadingPatients ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : filteredPatients.length ? (
            filteredPatients.map((patient) => (
              <View key={patient.id} style={styles.patientCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <Text style={styles.patientSub}>
                    Estado reciente: {patient.lastEstado || 'Pendiente'} · Total citas: {patient.totalCitas}
                  </Text>
                  <Text style={styles.patientSub}>
                    Proxima: {patient.nextDateLabel} · Ultima: {patient.lastDateLabel}
                  </Text>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() =>
                      navigation.navigate('MedicoChat', {
                        patientId: patient.id,
                        patientName: patient.name,
                      })
                    }
                  >
                    <Text style={styles.secondaryActionText}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() => navigation.navigate('MedicoCitas')}
                  >
                    <Text style={styles.secondaryActionText}>Agenda</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() =>
                      Alert.alert(
                        patient.name,
                        `Citas totales: ${patient.totalCitas}\nCitas proximas: ${patient.upcomingCitas}\nEstado reciente: ${
                          patient.lastEstado || 'Pendiente'
                        }\nProxima cita: ${patient.nextDateLabel}\nUltima cita: ${patient.lastDateLabel}`
                      )
                    }
                  >
                    <Text style={styles.secondaryActionText}>Detalles</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No se encontraron pacientes para mostrar.</Text>
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
  kpiGrid: {
    paddingHorizontal: Platform.OS === 'web' ? 32 : 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 180,
  },
  kpiLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  kpiValue: { color: colors.dark, fontSize: 28, fontWeight: '900', marginTop: 2 },
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
  patientCard: {
    borderWidth: 1,
    borderColor: '#e8eff8',
    borderRadius: 12,
    padding: 10,
    gap: 9,
  },
  patientName: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  patientSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryAction: {
    borderWidth: 1,
    borderColor: '#d6e2f0',
    backgroundColor: '#f6f9fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondaryActionText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700', paddingVertical: 12 },
});

export default MedicoPacientesScreen;
