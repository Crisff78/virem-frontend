import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Easing,
  Platform,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation/types';
import { apiUrl } from './config/backend';

// Nota: si usas Expo, comenta los imports de abajo y usa:
// import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLanguage } from './localization/LanguageContext';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

const ViremLogo = require('./assets/imagenes/descarga.png');

// Avatar default (local) -> crea una imagen en tu proyecto:
// ./assets/imagenes/avatar-default.png
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';
const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeString = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeFotoUrl = (value: unknown) => {
  const clean = normalizeString(value);
  if (!clean) return '';
  if (clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};

const extractUserId = (value: unknown) => {
  const source = (value || {}) as Record<string, unknown>;
  return normalizeString(source.usuarioid || source.id);
};

const resolveAvatarSource = (value: unknown): ImageSourcePropType => {
  const clean = sanitizeFotoUrl(value);
  if (clean) {
    return { uri: clean };
  }
  return DefaultAvatar;
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

const formatDateTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatRelativeIn = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= 0) return 'Inicia pronto';
  if (diffMin < 60) return `en ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `en ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  return `en ${diffDay} dia(s)`;
};

const parseDateMs = (value: string | null | undefined) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

const sortCitasByStartAsc = (items: CitaItem[]) =>
  [...items].sort((a, b) => parseDateMs(a?.fechaHoraInicio) - parseDateMs(b?.fechaHoraInicio));

/* ===================== TIPOS ===================== */
type User = {
  id?: number | string;
  usuarioid?: number | string;
  nombres?: string;
  apellidos?: string;
  nombre?: string;
  apellido?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  plan?: string;        // "Premium" / "Básico"
  fotoUrl?: string;     // URL de la foto si la subió
  telefono?: string;
  cedula?: string;
  genero?: string;
  fechanacimiento?: string;
};

type CitaItem = {
  citaid: string;
  fechaHoraInicio: string | null;
  fechaHoraFin: string | null;
  duracionMin: number;
  nota: string;
  precio: number | null;
  estado: string;
  medico?: {
    medicoid?: string;
    nombreCompleto?: string;
    especialidad?: string;
    fotoUrl?: string | null;
  };
};

type QuickActionProps = {
  icon: string;
  label: string;
  color: string;
  bg: string;
  onPress?: () => void;
};

type AppointmentCardProps = {
  doctor: string;
  detail: string;
  avatar: ImageSourcePropType;
  simple?: boolean;
  onPostpone?: () => void;
  onDetails?: () => void;
};

type DocRowProps = {
  icon: string;
  title: string;
  sub: string;
  onDownload?: () => void;
};

type DoctorCardProps = {
  name: string;
  spec: string;
  avatar: ImageSourcePropType;
  onReserve?: () => void;
};

type NotificationItem = {
  id: string;
  title: string;
  text: string;
  time: string;
  icon: string;
  color: string;
  unread: boolean;
};

/* ===================== COMPONENTES ===================== */
const QuickAction: React.FC<QuickActionProps> = ({ icon, label, color, bg, onPress }) => (
  <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.88}>
    <View style={[styles.quickIconBox, { backgroundColor: bg }]}>
      <MaterialIcons name={icon} size={26} color={color} />
    </View>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  doctor,
  detail,
  avatar,
  simple = false,
  onPostpone,
  onDetails,
}) => (
  <View style={styles.apptCard}>
    <Image source={avatar} style={styles.apptAvatar} />
    <View style={{ flex: 1 }}>
      <Text style={styles.apptDoctor}>{doctor}</Text>
      <Text style={styles.apptDetail}>{detail}</Text>
    </View>

    <View style={styles.apptBtns}>
      {!simple && (
        <TouchableOpacity style={styles.smallBtnGray} onPress={onPostpone}>
          <Text style={styles.smallBtnGrayText}>Posponer</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.smallBtnBlue} onPress={onDetails}>
        <Text style={styles.smallBtnBlueText}>Detalles</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const DocRow: React.FC<DocRowProps> = ({ icon, title, sub, onDownload }) => (
  <View style={styles.docRow}>
    <View style={styles.docLeft}>
      <View style={styles.docIconBox}>
        <MaterialIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.docSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </View>
    <TouchableOpacity onPress={onDownload}>
      <MaterialIcons name="download" size={20} color={colors.muted} />
    </TouchableOpacity>
  </View>
);

const DoctorCard: React.FC<DoctorCardProps> = ({ name, spec, avatar, onReserve }) => (
  <View style={styles.doctorCard}>
    <Image source={avatar} style={styles.doctorAvatar} />
    <Text style={styles.doctorName} numberOfLines={1}>
      {name}
    </Text>
    <Text style={styles.doctorSpec} numberOfLines={1}>
      {spec}
    </Text>
    <TouchableOpacity style={styles.reserveBtn} onPress={onReserve}>
      <Text style={styles.reserveText}>RESERVAR</Text>
    </TouchableOpacity>
  </View>
);

/* ===================== PANTALLA ===================== */
const DashboardPacienteScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, tx } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n1',
      title: 'Tu consulta empieza en 15 min',
      text: 'Prepárate para la videollamada programada con el especialista.',
      time: '15m',
      icon: 'videocam',
      color: '#137fec',
      unread: true,
    },
    {
      id: 'n2',
      title: 'Nueva receta disponible',
      text: 'El Dr. Gómez ha emitido tu receta digital para el tratamiento.',
      time: '1h',
      icon: 'description',
      color: '#22c55e',
      unread: true,
    },
    {
      id: 'n3',
      title: 'Mensaje del Dr. Ruiz',
      text: '"Hola, he revisado tus últimos análisis. Todo parece estar en orden..."',
      time: '3h',
      icon: 'chat-bubble-outline',
      color: '#4A7FA7',
      unread: true,
    },
    {
      id: 'n4',
      title: 'Cita confirmada',
      text: 'Tu cita con Dermatología ha sido confirmada para el 25 de Octubre.',
      time: 'Ayer',
      icon: 'calendar-today',
      color: '#94a3b8',
      unread: false,
    },
  ]);
  const [upcomingCitas, setUpcomingCitas] = useState<CitaItem[]>([]);
  const [historyCitas, setHistoryCitas] = useState<CitaItem[]>([]);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [prepItems, setPrepItems] = useState([false, false, false, false]);
  const [testProgress, setTestProgress] = useState(0);
  const [testRunning, setTestRunning] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testStatusText, setTestStatusText] = useState('Aún no se ha realizado la prueba.');
  const [chatReply, setChatReply] = useState('');
  const chatAnim = useRef(new Animated.Value(0)).current;

  // Cargar y sincronizar usuario paciente desde storage + backend.
  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    try {
      const rawUserFromStorage =
        Platform.OS === 'web'
          ? localStorage.getItem(LEGACY_USER_STORAGE_KEY)
          : await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY);
      const rawUserFromAsync = await AsyncStorage.getItem(STORAGE_KEY);
      let sessionUser = ensurePatientSessionUser(parseUser(rawUserFromStorage) || parseUser(rawUserFromAsync));

      const rawTokenFromStorage =
        Platform.OS === 'web'
          ? localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
          : (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
            (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
      const rawTokenFromAsync = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
      const authToken = normalizeString(rawTokenFromStorage || rawTokenFromAsync);

      if (authToken) {
        try {
          const profileResponse = await fetch(apiUrl('/api/users/me/paciente-profile'), {
            method: 'GET',
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const profilePayload = await profileResponse.json().catch(() => null);
          if (profileResponse.ok && profilePayload?.success && profilePayload?.profile) {
            const profileUser = profilePayload.profile as User;
            const cachedUserId = extractUserId(sessionUser);
            const profileUserId = extractUserId(profileUser);
            const safeSessionUser =
              cachedUserId && profileUserId && cachedUserId !== profileUserId ? null : sessionUser;

            const mergedUser: User = {
              ...(safeSessionUser || {}),
              ...profileUser,
              nombres: normalizeString(
                (profileUser as any)?.nombres ||
                  safeSessionUser?.nombres ||
                  safeSessionUser?.nombre ||
                  (profileUser as any)?.nombre
              ),
              apellidos: normalizeString(
                (profileUser as any)?.apellidos ||
                  safeSessionUser?.apellidos ||
                  safeSessionUser?.apellido ||
                  (profileUser as any)?.apellido
              ),
              nombre: normalizeString(
                (profileUser as any)?.nombre || (profileUser as any)?.nombres || safeSessionUser?.nombre
              ),
              apellido: normalizeString(
                (profileUser as any)?.apellido || (profileUser as any)?.apellidos || safeSessionUser?.apellido
              ),
              fotoUrl: sanitizeFotoUrl((profileUser as any)?.fotoUrl),
              email: normalizeString((profileUser as any)?.email || safeSessionUser?.email),
              telefono: normalizeString((profileUser as any)?.telefono || (safeSessionUser as any)?.telefono),
              cedula: normalizeString((profileUser as any)?.cedula || (safeSessionUser as any)?.cedula),
              genero: normalizeString((profileUser as any)?.genero || (safeSessionUser as any)?.genero),
              fechanacimiento: normalizeString(
                (profileUser as any)?.fechanacimiento || (safeSessionUser as any)?.fechanacimiento
              ),
            };

            sessionUser = mergedUser;
            const rawNextUser = JSON.stringify(mergedUser);

            try {
              await AsyncStorage.setItem(STORAGE_KEY, rawNextUser);
              await AsyncStorage.setItem('user', rawNextUser);
            } catch {}

            try {
              if (Platform.OS === 'web') {
                localStorage.setItem(LEGACY_USER_STORAGE_KEY, rawNextUser);
                localStorage.setItem('user', rawNextUser);
              } else {
                await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, rawNextUser);
              }
            } catch {}
          } else {
            const response = await fetch(apiUrl('/api/auth/me'), {
              method: 'GET',
              headers: { Authorization: `Bearer ${authToken}` },
            });
            const payload = await response.json().catch(() => null);

            if (response.ok && payload?.success && payload?.user) {
              const apiUser = payload.user as User;
              const cachedUserId = extractUserId(sessionUser);
              const apiUserId = extractUserId(apiUser);
              const safeSessionUser =
                cachedUserId && apiUserId && cachedUserId !== apiUserId ? null : sessionUser;

              const apiRoleId = Number((apiUser as any)?.rolid ?? (apiUser as any)?.rolId ?? (apiUser as any)?.roleId);
              if (apiRoleId !== 2) {
                const mergedUser: User = {
                  ...(safeSessionUser || {}),
                  ...apiUser,
                  nombres: normalizeString(
                    apiUser?.nombres || safeSessionUser?.nombres || safeSessionUser?.nombre || apiUser?.nombre
                  ),
                  apellidos: normalizeString(
                    apiUser?.apellidos || safeSessionUser?.apellidos || safeSessionUser?.apellido || apiUser?.apellido
                  ),
                  nombre: normalizeString(apiUser?.nombre || apiUser?.nombres || safeSessionUser?.nombre),
                  apellido: normalizeString(apiUser?.apellido || apiUser?.apellidos || safeSessionUser?.apellido),
                  fotoUrl: sanitizeFotoUrl(apiUser?.fotoUrl),
                  email: normalizeString(apiUser?.email || safeSessionUser?.email),
                  telefono: normalizeString((apiUser as any)?.telefono || (safeSessionUser as any)?.telefono),
                  cedula: normalizeString((apiUser as any)?.cedula || (safeSessionUser as any)?.cedula),
                  genero: normalizeString((apiUser as any)?.genero || (safeSessionUser as any)?.genero),
                  fechanacimiento: normalizeString(
                    (apiUser as any)?.fechanacimiento || (safeSessionUser as any)?.fechanacimiento
                  ),
                };

                sessionUser = mergedUser;
                const rawNextUser = JSON.stringify(mergedUser);

                try {
                  await AsyncStorage.setItem(STORAGE_KEY, rawNextUser);
                  await AsyncStorage.setItem('user', rawNextUser);
                } catch {}

                try {
                  if (Platform.OS === 'web') {
                    localStorage.setItem(LEGACY_USER_STORAGE_KEY, rawNextUser);
                    localStorage.setItem('user', rawNextUser);
                  } else {
                    await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, rawNextUser);
                  }
                } catch {}
              } else {
                sessionUser = null;
              }
            }
          }
        } catch {
          // Fallback silencioso a storage.
        }

        setLoadingCitas(true);
        try {
          const [upcomingResponse, historyResponse] = await Promise.all([
            fetch(apiUrl('/api/users/me/citas?scope=upcoming&limit=10'), {
              method: 'GET',
              headers: { Authorization: `Bearer ${authToken}` },
            }),
            fetch(apiUrl('/api/users/me/citas?scope=history&limit=10'), {
              method: 'GET',
              headers: { Authorization: `Bearer ${authToken}` },
            }),
          ]);

          const upcomingPayload = await upcomingResponse.json().catch(() => null);
          const historyPayload = await historyResponse.json().catch(() => null);

          if (
            upcomingResponse.ok &&
            upcomingPayload?.success &&
            Array.isArray(upcomingPayload?.citas)
          ) {
            setUpcomingCitas(sortCitasByStartAsc(upcomingPayload.citas as CitaItem[]));
          } else {
            setUpcomingCitas([]);
          }

          if (
            historyResponse.ok &&
            historyPayload?.success &&
            Array.isArray(historyPayload?.citas)
          ) {
            setHistoryCitas(historyPayload.citas as CitaItem[]);
          } else {
            setHistoryCitas([]);
          }
        } catch {
          setUpcomingCitas([]);
          setHistoryCitas([]);
        } finally {
          setLoadingCitas(false);
        }
      } else {
        setUpcomingCitas([]);
        setHistoryCitas([]);
        setLoadingCitas(false);
      }

      setUser(sessionUser);
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user]);

  // Foto: si no hay fotoUrl, usar avatar default
  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    const fotoUrl = sanitizeFotoUrl(user?.fotoUrl);
    if (fotoUrl) {
      return { uri: fotoUrl };
    }
    return DefaultAvatar;
  }, [user]);

  const getDoctorAvatar = useCallback(
    (cita: CitaItem | null | undefined): ImageSourcePropType =>
      resolveAvatarSource(cita?.medico?.fotoUrl),
    []
  );

  const primaryCita = upcomingCitas.length ? upcomingCitas[0] : null;
  const pendingCitas = useMemo(() => {
    if (!upcomingCitas.length) return [];
    return upcomingCitas.slice(primaryCita ? 1 : 0, (primaryCita ? 1 : 0) + 2);
  }, [upcomingCitas, primaryCita]);
  const historyRows = useMemo(() => historyCitas.slice(0, 2), [historyCitas]);
  const frequentDoctors = useMemo(() => {
    const order: { name: string; spec: string; fotoUrl: string }[] = [];
    const seen = new Set<string>();
    for (const cita of [...upcomingCitas, ...historyCitas]) {
      const name = normalizeString(cita?.medico?.nombreCompleto || '');
      const spec = normalizeString(cita?.medico?.especialidad || 'Medicina General');
      const fotoUrl = sanitizeFotoUrl(cita?.medico?.fotoUrl);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      order.push({ name, spec: spec || 'Medicina General', fotoUrl });
      if (order.length >= 2) break;
    }
    return order;
  }, [upcomingCitas, historyCitas]);

  const primaryDoctorName = normalizeString(primaryCita?.medico?.nombreCompleto || '');
  const primaryDoctorSpec = normalizeString(primaryCita?.medico?.especialidad || 'Medicina General');
  const primaryDoctorAvatar = useMemo(() => getDoctorAvatar(primaryCita), [getDoctorAvatar, primaryCita]);
  const primaryDateLabel = formatDateTime(primaryCita?.fechaHoraInicio || null);
  const primaryRelative = formatRelativeIn(primaryCita?.fechaHoraInicio || null);

  const toggleChat = () => {
    const next = !chatOpen;
    setChatOpen(next);

    Animated.timing(chatAnim, {
      toValue: next ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      }
    } catch {}

    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleJoinVideoCall = () => {
    if (!primaryCita) {
      Alert.alert('Videollamada', 'No tienes citas activas para entrar ahora.');
      return;
    }
    navigation.navigate('SalaEsperaVirtualPaciente', { citaId: primaryCita.citaid });
  };

  const handleSeePreparations = () => {
    setPrepOpen(true);
  };

  const handleRunTechnicalTest = async () => {
    if (testRunning) return;

    setTestRunning(true);
    setTestStatus('idle');
    setTestStatusText('Iniciando prueba de equipo...');
    setTestProgress(15);

    try {
      if (Platform.OS !== 'web') {
        // Fallback móvil: no hay selector nativo de dispositivos por navegador.
        await new Promise((resolve) => setTimeout(resolve, 700));
        setTestProgress(100);
        setTestStatus('ok');
        setTestStatusText('Equipo listo en este dispositivo.');
        return;
      }

      const mediaDevices = (globalThis as any).navigator?.mediaDevices;
      if (!mediaDevices?.getUserMedia || !mediaDevices?.enumerateDevices) {
        throw new Error('Tu navegador no soporta pruebas de cámara/micrófono.');
      }

      setTestProgress(40);
      setTestStatusText('Solicitando permisos de cámara y micrófono...');
      const stream = await mediaDevices.getUserMedia({ video: true, audio: true });

      setTestProgress(75);
      setTestStatusText('Verificando dispositivos disponibles...');
      const devices = await mediaDevices.enumerateDevices();
      const hasCam = devices.some((d: any) => d.kind === 'videoinput');
      const hasMic = devices.some((d: any) => d.kind === 'audioinput');

      stream.getTracks().forEach((track: any) => track.stop());

      if (!hasCam || !hasMic) {
        throw new Error('No se detectó cámara o micrófono en el equipo.');
      }

      setTestProgress(100);
      setTestStatus('ok');
      setTestStatusText('Prueba completada: cámara y micrófono funcionando.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo completar la prueba.';
      setTestProgress(100);
      setTestStatus('error');
      setTestStatusText(msg);
    } finally {
      setTestRunning(false);
    }
  };

  const togglePrepItem = (index: number) => {
    setPrepItems((prev) => prev.map((item, i) => (i === index ? !item : item)));
  };
  const allPrepItemsSelected = prepItems.every(Boolean);

  const handleSendMessage = () => {
    if (!chatReply.trim()) return;
    Alert.alert('Mensaje enviado', 'Tu respuesta fue enviada al doctor.');
    setChatReply('');
  };

  const handlePostponeCita = async (cita: CitaItem) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Sesion expirada', 'Inicia sesion nuevamente.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const response = await fetch(apiUrl(`/api/users/me/citas/${cita.citaid}/postpone`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        Alert.alert('No se pudo posponer', payload?.message || 'Intenta nuevamente.');
        return;
      }

      Alert.alert('Cita pospuesta', `Nueva fecha: ${formatDateTime(payload?.cita?.fechaHoraInicio || null)}`);
      loadUser();
    } catch {
      Alert.alert('Error', 'No se pudo conectar para posponer la cita.');
    }
  };

  const unreadNotifications = notifications.filter((n) => n.unread).length;

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

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
              <Text style={styles.logoSubtitle}>Portal Paciente</Text>
            </View>
          </View>

          {/* Perfil mini (REAL) */}
          <View style={styles.userBox}>
            <Image source={userAvatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userPlan}>{planLabel}</Text>

            {/* Si no tiene foto, se sugiere subirla */}
            {!user?.fotoUrl ? (
              <Text style={styles.hintText}>
                No tienes foto. Ve a Perfil para agregarla.
              </Text>
            ) : null}
          </View>

          {/* Menú */}
          <View style={styles.menu}>
            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('DashboardPaciente')}
            >
              <MaterialIcons name="grid-view" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>{t('menu.home')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('NuevaConsultaPaciente')}
            >
              <MaterialIcons name="person-search" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.searchDoctor')}</Text>
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
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacientePerfil')}
            >
              <MaterialIcons name="account-circle" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.profile')}</Text>
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

        {/* Cerrar sesión */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
      </View>

      {/* ===================== MAIN ===================== */}
      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              placeholder="Busca un médico para consulta online"
              placeholderTextColor="#8aa7bf"
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity style={styles.notifBtn} onPress={() => setNotificationsOpen(true)}>
            <MaterialIcons name="notifications" size={22} color={colors.dark} />
            {unreadNotifications > 0 ? <View style={styles.notifDot} /> : null}
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Hola, {fullName.split(' ')[0] || 'Paciente'}</Text>
        <Text style={styles.subtitle}>
          {loadingCitas
            ? 'Cargando tus citas...'
            : primaryCita
              ? `Tu proxima cita es con ${primaryDoctorName || 'tu especialista'}.`
              : 'Aun no tienes citas programadas. Agenda tu primera consulta.'}
        </Text>

        {/* Card grande */}
        <View style={styles.bigCard}>
          <View style={styles.bigCardLeft}>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>En directo ahora</Text>
            </View>

            <Text style={styles.bigCardTitle}>
              {primaryCita
                ? `Proxima videoconsulta: ${primaryDoctorName || 'Especialista'}`
                : 'No tienes videoconsultas pendientes'}
            </Text>

            <Text style={styles.bigCardSub}>
              {primaryCita
                ? `${primaryDoctorSpec || 'Medicina General'} · ${primaryDateLabel} (${primaryRelative})`
                : 'Selecciona "Nueva consulta" para agendar una cita.'}
            </Text>

            <View style={styles.bigCardActions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={primaryCita ? handleJoinVideoCall : () => navigation.navigate('NuevaConsultaPaciente')}
              >
                <MaterialIcons name="videocam" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  {primaryCita ? 'Entrar a Videollamada' : 'Ir a Nueva Consulta'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={primaryCita ? handleSeePreparations : () => navigation.navigate('NuevaConsultaPaciente')}
              >
                <Text style={styles.secondaryBtnText}>
                  {primaryCita ? 'Ver preparativos' : 'Agendar ahora'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bigCardRight}>
            <Image source={primaryDoctorAvatar} style={styles.bigCardImage} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.quickGrid}>
          <QuickAction
            icon="add-circle"
            label="Nueva consulta"
            color={colors.primary}
            bg="rgba(19,127,236,0.12)"
            onPress={() => navigation.navigate('NuevaConsultaPaciente')}
          />
          <QuickAction
            icon="calendar-month"
            label="Agendar cita"
            color="#f97316"
            bg="#fff7ed"
            onPress={() => navigation.navigate('NuevaConsultaPaciente')}
          />
          <QuickAction
            icon="chat"
            label="Consultar Chat"
            color="#14b8a6"
            bg="#f0fdfa"
            onPress={() => navigation.navigate('PacienteChat')}
          />
          <QuickAction
            icon="medical-information"
            label="Mis recetas"
            color="#a855f7"
            bg="#faf5ff"
            onPress={() => navigation.navigate('PacienteRecetasDocumentos')}
          />
        </View>

        <View style={styles.twoCols}>
          <View style={styles.colLeft}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Citas pendientes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('PacienteCitas')}>
                <Text style={styles.link}>Ver todas</Text>
              </TouchableOpacity>
            </View>

            {pendingCitas.length ? (
              pendingCitas.map((cita, index) => (
                <AppointmentCard
                  key={cita.citaid || `${cita.fechaHoraInicio}-${index}`}
                  doctor={normalizeString(cita?.medico?.nombreCompleto || 'Especialista')}
                  detail={`${normalizeString(cita?.medico?.especialidad || 'Medicina General')} · ${formatDateTime(cita.fechaHoraInicio)}`}
                  avatar={getDoctorAvatar(cita)}
                  simple={index % 2 !== 0}
                  onPostpone={() =>
                    Alert.alert(
                      'Posponer cita',
                      `Se movera 24 horas hacia adelante.\nCita actual: ${formatDateTime(cita.fechaHoraInicio)}`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Posponer', onPress: () => handlePostponeCita(cita) },
                      ]
                    )
                  }
                  onDetails={() =>
                    Alert.alert(
                      'Detalle de cita',
                      `${normalizeString(cita?.medico?.nombreCompleto || 'Especialista')}\n${normalizeString(
                        cita?.medico?.especialidad || 'Medicina General'
                      )}\n${formatDateTime(cita.fechaHoraInicio)}`
                    )
                  }
                />
              ))
            ) : (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateText}>
                  {loadingCitas
                    ? 'Cargando citas pendientes...'
                    : 'No tienes citas pendientes. Agenda una nueva consulta.'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.colRight} />
        </View>

        <View style={styles.twoCols}>
          <View style={styles.colLeft}>
            <Text style={styles.sectionTitle}>Historial reciente de consultas</Text>
            <View style={styles.listCard}>
              {historyRows.length ? (
                historyRows.map((cita, index) => (
                  <DocRow
                    key={cita.citaid || `${cita.fechaHoraInicio}-${index}`}
                    icon={index % 2 === 0 ? 'history' : 'description'}
                    title={`${normalizeString(cita?.medico?.especialidad || 'Consulta')} · ${normalizeString(cita.estado || 'Completada')}`}
                    sub={`${normalizeString(cita?.medico?.nombreCompleto || 'Especialista')} · ${formatDateTime(cita.fechaHoraInicio)}`}
                    onDownload={() =>
                      Alert.alert(
                        'Documento clinico',
                        `Puedes descargar documentos completos en "Mis recetas".\nConsulta: ${formatDateTime(
                          cita.fechaHoraInicio
                        )}`
                      )
                    }
                  />
                ))
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateText}>
                    {loadingCitas ? 'Cargando historial...' : 'Aun no hay consultas registradas.'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.colRight}>
            <Text style={styles.sectionTitle}>Doctores frecuentes</Text>
            <View style={styles.doctorsGrid}>
              {frequentDoctors.length ? (
                frequentDoctors.map((item, index) => (
                  <DoctorCard
                    key={`${item.name}-${index}`}
                    name={item.name}
                    spec={item.spec}
                    avatar={resolveAvatarSource(item.fotoUrl)}
                    onReserve={() =>
                      navigation.navigate('EspecialistasPorEspecialidad', { specialty: item.spec })
                    }
                  />
                ))
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateText}>Aun no hay doctores frecuentes.</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHead}>
            <View style={styles.summaryIconBox}>
              <MaterialCommunityIcons name="history" size={18} color="#fff" />
            </View>
            <Text style={styles.summaryTitle}>Resumen de ultima consulta</Text>
          </View>

          <View style={styles.summaryInner}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.summaryLabel}>Diagnóstico Principal</Text>
                <Text style={styles.summaryDiag}>
                  {historyCitas[0]
                    ? normalizeString(historyCitas[0].nota || historyCitas[0].estado || 'Consulta completada')
                    : 'Sin historial disponible'}
                </Text>
              </View>
              <Text style={styles.summaryDate}>
                {historyCitas[0] ? formatDateTime(historyCitas[0].fechaHoraInicio) : '--'}
              </Text>
            </View>

            <Text style={styles.summaryText}>
              {historyCitas[0]
                ? `Ultimo estado registrado: ${normalizeString(historyCitas[0].estado || 'Completada')}.`
                : 'Cuando completes una consulta, aqui veras un resumen clinico.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {chatOpen ? (
        <Animated.View
          style={[
            styles.chatFloatingPanel,
            {
              opacity: chatAnim,
              transform: [
                {
                  translateY: chatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.chatHeader}>
            <Image source={primaryDoctorAvatar} style={styles.chatAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chatName}>{primaryDoctorName || 'Especialista'}</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>

            <TouchableOpacity onPress={toggleChat}>
              <MaterialIcons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.chatBody}>
            <View style={styles.msgLeft}>
              <Text style={styles.msgLeftText}>
                Hola {fullName.split(' ')[0] || 'Paciente'}, ¿has podido completar los análisis?
              </Text>
            </View>

            <View style={styles.msgRight}>
              <Text style={styles.msgRightText}>Sí Doctor, se los envié por el portal esta mañana.</Text>
            </View>
          </View>

          <View style={styles.chatInputRow}>
            <TextInput
              placeholder="Responder..."
              placeholderTextColor="#8aa7bf"
              style={styles.chatInput}
              value={chatReply}
              onChangeText={setChatReply}
            />
            <TouchableOpacity onPress={handleSendMessage}>
              <MaterialIcons name="send" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}

      {notificationsOpen ? (
        <>
          <TouchableOpacity style={styles.notificationsOverlay} onPress={() => setNotificationsOpen(false)} />
          <View style={styles.notificationsPanel}>
            <View style={styles.notificationsHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="notifications" size={20} color={colors.dark} />
                <Text style={styles.notificationsTitle}>Notificaciones</Text>
              </View>
              <TouchableOpacity onPress={() => setNotificationsOpen(false)}>
                <MaterialIcons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.notificationsBody}>
              <View style={styles.notificationsSubhead}>
                <Text style={styles.notificationsSubheadText}>Recientes</Text>
                <TouchableOpacity onPress={markAllNotificationsRead}>
                  <Text style={styles.markReadText}>Marcar como leídas</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {notifications.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.notificationCard,
                      !item.unread && styles.notificationCardMuted,
                    ]}
                  >
                    <View style={[styles.notificationAccent, { backgroundColor: item.color }]} />
                    <View style={[styles.notificationIconBox, { backgroundColor: `${item.color}20` }]}>
                      <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.notificationTitleRow}>
                        <Text style={styles.notificationTitle}>{item.title}</Text>
                        <Text style={styles.notificationTime}>{item.time}</Text>
                      </View>
                      <Text style={styles.notificationText}>{item.text}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.notificationsFooter}>
              <TouchableOpacity
                style={styles.notificationsButton}
                onPress={() => {
                  setNotificationsOpen(false);
                  navigation.navigate('PacienteNotificaciones');
                }}
              >
                <Text style={styles.notificationsButtonText}>Ver todas las notificaciones</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : null}

      <Modal visible={prepOpen} transparent animationType="fade" onRequestClose={() => setPrepOpen(false)}>
        <View style={styles.prepOverlay}>
          <View style={styles.prepModal}>
            <View style={styles.prepHead}>
              <Text style={styles.prepBreadcrumb}>Preparativos</Text>
              <TouchableOpacity onPress={() => setPrepOpen(false)}>
                <MaterialIcons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.prepTitle}>Prepárate para tu videollamada</Text>
            <Text style={styles.prepSub}>
              {primaryCita
                ? `Con ${primaryDoctorName || 'tu especialista'} • ${primaryDoctorSpec || 'Medicina General'}`
                : 'Con tu especialista asignado'}
            </Text>

            <View style={styles.prepGrid}>
              <View style={styles.prepCard}>
                <Text style={styles.prepCardTitle}>Lista de verificación</Text>

                <TouchableOpacity style={styles.prepItem} onPress={() => togglePrepItem(0)}>
                  <MaterialIcons
                    name={prepItems[0] ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color={prepItems[0] ? colors.primary : colors.light}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prepItemTitle}>Conexión a internet estable</Text>
                    <Text style={styles.prepItemSub}>Asegúrate de tener buena señal Wi-Fi o datos móviles.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.prepItem} onPress={() => togglePrepItem(1)}>
                  <MaterialIcons
                    name={prepItems[1] ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color={prepItems[1] ? colors.primary : colors.light}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prepItemTitle}>Cámara y micrófono funcionando</Text>
                    <Text style={styles.prepItemSub}>El navegador te pedirá permisos para acceder a ellos.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.prepItem} onPress={() => togglePrepItem(2)}>
                  <MaterialIcons
                    name={prepItems[2] ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color={prepItems[2] ? colors.primary : colors.light}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prepItemTitle}>Lugar tranquilo y privado</Text>
                    <Text style={styles.prepItemSub}>Busca un espacio iluminado y sin ruidos externos.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.prepItem} onPress={() => togglePrepItem(3)}>
                  <MaterialIcons
                    name={prepItems[3] ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color={prepItems[3] ? colors.primary : colors.light}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prepItemTitle}>Ten a mano tus exámenes o recetas</Text>
                    <Text style={styles.prepItemSub}>Facilitará la consulta si el doctor necesita revisarlos.</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.prepCard}>
                <Text style={styles.prepCardTitle}>Prueba técnica</Text>
                <View style={styles.testBox}>
                  <MaterialIcons
                    name={testStatus === 'ok' ? 'check-circle' : testStatus === 'error' ? 'error-outline' : 'camera-alt'}
                    size={44}
                    color={testStatus === 'ok' ? '#22c55e' : testStatus === 'error' ? '#ef4444' : colors.muted}
                  />
                  <View style={styles.testBar}>
                    <View style={[styles.testBarFill, { width: `${Math.max(4, testProgress)}%` }]} />
                  </View>
                </View>

                <TouchableOpacity style={styles.testBtn} onPress={handleRunTechnicalTest} disabled={testRunning}>
                  <MaterialIcons name="settings" size={16} color={colors.blue} />
                  <Text style={styles.testBtnText}>
                    {testRunning ? 'Probando equipo...' : 'Hacer prueba de equipo'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.testStatusText}>{testStatusText}</Text>

                <TouchableOpacity
                  style={[styles.readyBtn, !allPrepItemsSelected && styles.readyBtnDisabled]}
                  disabled={!allPrepItemsSelected}
                  onPress={() => {
                    setPrepOpen(false);
                    if (primaryCita?.citaid) {
                      navigation.navigate('SalaEsperaVirtualPaciente', { citaId: primaryCita.citaid });
                    } else {
                      navigation.navigate('SalaEsperaVirtualPaciente');
                    }
                  }}
                >
                  <Text style={[styles.readyBtnText, !allPrepItemsSelected && styles.readyBtnTextDisabled]}>
                    Listo, ir a sala de espera
                  </Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={18}
                    color={allPrepItemsSelected ? '#fff' : '#94a3b8'}
                  />
                </TouchableOpacity>

                <Text style={styles.readySub}>
                  Serás redirigido a la sala de espera privada hasta que el doctor inicie la sesión.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.chatFab} onPress={toggleChat}>
        <MaterialIcons name={chatOpen ? 'close' : 'chat'} size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

/* ===================== COLORES ===================== */
const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  light: '#B3CFE5',
  white: '#FFFFFF',
};

/* ===================== ESTILOS ===================== */
const styles = StyleSheet.create({
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
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14 },
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  hintText: { marginTop: 6, color: colors.muted, fontSize: 11, fontWeight: '700' },

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
    paddingHorizontal: Platform.OS === 'web' ? 26 : 14,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },

  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.dark,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchInput: { flex: 1, color: colors.dark, fontWeight: '600' },

  notifBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  notifDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },

  title: { fontSize: 28, fontWeight: '900', color: colors.dark, marginTop: 8 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: 18, fontWeight: '600' },

  bigCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
    marginBottom: 18,
    shadowColor: colors.dark,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bigCardLeft: { flex: 1 },
  bigCardRight: {
    width: Platform.OS === 'web' ? 160 : '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigCardImage: { width: 140, height: 140, borderRadius: 20 },

  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  liveDot: { width: 10, height: 10, borderRadius: 10, backgroundColor: '#22c55e' },
  liveText: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },

  bigCardTitle: { fontSize: 18, fontWeight: '900', color: colors.dark, marginBottom: 6 },
  bigCardSub: { color: colors.muted, fontWeight: '700', marginBottom: 14 },

  bigCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16 },
  primaryBtnText: { color: '#fff', fontWeight: '900' },
  secondaryBtn: { backgroundColor: '#f1f5f9', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16 },
  secondaryBtnText: { color: colors.muted, fontWeight: '900' },

  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.dark, marginBottom: 10, marginTop: 10 },
  link: { color: colors.primary, fontWeight: '900', fontSize: 12 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: {
    width: '23%',
    minWidth: 140,
    padding: 16,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: colors.dark,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  quickIconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickLabel: { fontWeight: '900', color: colors.dark, textAlign: 'center' },

  twoCols: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
    marginTop: 16,
  },
  colLeft: { flex: 2 },
  colRight: { flex: 1.2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  apptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 18,
    marginTop: 10,
    shadowColor: colors.dark,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  apptAvatar: { width: 52, height: 52, borderRadius: 16 },
  apptDoctor: { fontWeight: '900', color: colors.dark },
  apptDetail: { color: colors.muted, fontWeight: '700', marginTop: 2, fontSize: 12 },

  apptBtns: { flexDirection: 'row', gap: 8 },

  smallBtnGray: { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  smallBtnGrayText: { color: colors.muted, fontWeight: '900', fontSize: 12 },
  smallBtnBlue: { backgroundColor: 'rgba(19,127,236,0.12)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  smallBtnBlueText: { color: colors.primary, fontWeight: '900', fontSize: 12 },

  chatCard: { backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', marginTop: 10, shadowColor: colors.dark, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  chatHeader: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  chatAvatar: { width: 40, height: 40, borderRadius: 40 },
  chatName: { fontWeight: '900', color: colors.dark, fontSize: 12 },
  onlineRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: '#22c55e' },
  onlineText: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  chatBody: { padding: 12, gap: 10, minHeight: 200 },
  msgLeft: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 16, alignSelf: 'flex-start', maxWidth: '90%' },
  msgLeftText: { color: colors.dark, fontWeight: '700', fontSize: 12 },
  msgRight: { backgroundColor: colors.primary, padding: 10, borderRadius: 16, alignSelf: 'flex-end', maxWidth: '90%' },
  msgRightText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  chatInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#eef2f7' },
  chatInput: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.dark, fontWeight: '700' },
  chatFloatingPanel: {
    position: 'absolute',
    right: 24,
    bottom: 96,
    width: 360,
    maxWidth: '92%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.dark,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  chatFab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  notificationsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
    zIndex: 60,
  },
  notificationsPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 380,
    maxWidth: '94%',
    backgroundColor: colors.bg,
    borderLeftWidth: 1,
    borderLeftColor: '#d9e5f2',
    zIndex: 70,
    shadowColor: colors.dark,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: -6, height: 0 },
    elevation: 12,
  },
  notificationsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e7eff8',
  },
  notificationsTitle: { color: colors.dark, fontSize: 20, fontWeight: '900' },
  notificationsBody: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
  notificationsSubhead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  notificationsSubheadText: { color: '#8aa7bf', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  markReadText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  notificationCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4edf7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
    position: 'relative',
  },
  notificationCardMuted: { opacity: 0.7 },
  notificationAccent: {
    position: 'absolute',
    left: 0,
    top: 14,
    width: 3,
    height: 26,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  notificationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  notificationTitle: { flex: 1, color: colors.dark, fontSize: 14, fontWeight: '900' },
  notificationTime: { color: '#9bb1c7', fontSize: 11, fontWeight: '700' },
  notificationText: { color: colors.muted, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 3 },
  notificationsFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#e7eff8',
    backgroundColor: '#fff',
  },
  notificationsButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  notificationsButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  listCard: { backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', marginTop: 10, shadowColor: colors.dark, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  emptyStateCard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyStateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  docLeft: { flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 },
  docIconBox: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(19,127,236,0.12)', alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontWeight: '900', color: colors.dark, fontSize: 12 },
  docSub: { color: colors.muted, fontWeight: '700', fontSize: 11, marginTop: 2 },

  doctorsGrid: { flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  doctorCard: {
    width: Platform.OS === 'web' ? '48%' : '100%',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 22,
    alignItems: 'center',
    shadowColor: colors.dark,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  doctorAvatar: { width: 64, height: 64, borderRadius: 64, marginBottom: 10, borderWidth: 4, borderColor: '#f5f7fb' },
  doctorName: { fontWeight: '900', color: colors.dark, textAlign: 'center', fontSize: 12 },
  doctorSpec: { color: colors.muted, fontWeight: '900', fontSize: 10, marginTop: 4, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  reserveBtn: { width: '100%', paddingVertical: 10, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center' },
  reserveText: { color: colors.primary, fontWeight: '900', fontSize: 11 },

  summaryCard: { backgroundColor: colors.dark, borderRadius: 24, padding: 16, marginTop: 18 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  summaryIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  summaryInner: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  summaryLabel: { color: colors.light, fontWeight: '900', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  summaryDiag: { color: '#fff', fontWeight: '900', fontSize: 16, marginTop: 4 },
  summaryDate: { color: '#fff', opacity: 0.8, fontWeight: '800', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  summaryText: { color: colors.light, fontWeight: '600', fontSize: 12, marginTop: 10, lineHeight: 18 },

  prepOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 49, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  prepModal: {
    width: '100%',
    maxWidth: 980,
    backgroundColor: colors.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d9e6f2',
    padding: 22,
    maxHeight: '90%',
  },
  prepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prepBreadcrumb: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  prepTitle: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: '900',
    color: colors.dark,
    lineHeight: 40,
  },
  prepSub: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '700',
    color: colors.muted,
  },
  prepGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  prepCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cfe0ee',
    borderRadius: 16,
    padding: 16,
  },
  prepCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.dark,
    marginBottom: 11,
  },
  prepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6eef6',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  prepItemTitle: {
    color: colors.dark,
    fontWeight: '900',
    fontSize: 14,
  },
  prepItemSub: {
    marginTop: 2,
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  testBox: {
    backgroundColor: '#edf3fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8e4f0',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  testBar: {
    marginTop: 10,
    width: '78%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d7e3ef',
    overflow: 'hidden',
  },
  testBarFill: {
    width: '4%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  testBtnText: {
    color: colors.blue,
    fontWeight: '900',
    fontSize: 15,
  },
  testStatusText: {
    marginTop: 8,
    marginBottom: 12,
    color: colors.muted,
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  readyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    shadowColor: colors.dark,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  readyBtnDisabled: {
    backgroundColor: '#e2e8f0',
    shadowOpacity: 0,
    elevation: 0,
  },
  readyBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  readyBtnTextDisabled: {
    color: '#94a3b8',
  },
  readySub: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 15,
  },
});

export default DashboardPacienteScreen;



