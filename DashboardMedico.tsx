import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// v1.0.1 - Build trigger
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
  Linking,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePortalAwareMedicoNavigation } from './navigation/usePortalAwareMedicoNavigation';
import { useMedicoModule } from './navigation/MedicoModuleContext';
import { useAuth } from './providers/AuthProvider';
import { apiClient } from './utils/api';
import { getApiErrorMessage } from './utils/apiErrors';
import { useMedicoSessionProfile, type MedicoSessionUser } from './hooks/useMedicoSessionProfile';
import { useResponsive } from './hooks/useResponsive';

import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MedicoHeader from './components/MedicoHeader';
import Skeleton from './components/Skeleton';
import ViremImage from './components/ViremImage';
import FadeInView from './components/FadeInView';
import colors from './theme/colors';

const ViremLogo = require('./assets/imagenes/descarga.png');
type MaterialIconName = any;

const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');
const PatientAvatar: ImageSourcePropType = DefaultAvatar;

// -------------------------------------------------------------
// COLORES Y CONSTANTES (Renovados)
// -------------------------------------------------------------


const MIN_REFRESH_INTERVAL_MS = 15000;

// -------------------------------------------------------------
// UTILS
// -------------------------------------------------------------
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

const resolveAvatarSource = (value: unknown): ImageSourcePropType => {
  const clean = sanitizeFotoUrl(value);
  if (clean) {
    return { uri: clean };
  }
  return DefaultAvatar;
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
  return `en ${diffDay} día(s)`;
};

const parseDateMs = (value: string | null | undefined) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

function addDoctorPrefix(name: string) {
  const clean = name.trim();
  if (!clean) return 'Doctor';
  if (/^dr\.|^dra\./i.test(clean)) return clean;
  return `Dr. ${clean}`;
}

// -------------------------------------------------------------
// TYPES
// -------------------------------------------------------------
type SideItem = {
  icon: MaterialIconName;
  label: string;
  badge?: { text: string; color: string };
  active?: boolean;
  route?: 'DashboardMedico' | 'MedicoPerfil' | 'MedicoCitas' | 'MedicoPacientes' | 'MedicoChat';
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
  modalidad?: string;
  paciente: {
    pacienteid: string;
    nombreCompleto: string;
    fotoUrl?: string;
  };
};

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

// -------------------------------------------------------------
// COMPONENTES MODERNOS
// -------------------------------------------------------------
type AppointmentCardProps = {
  patient: string;
  detail: string;
  avatar: ImageSourcePropType;
  onVideoCall?: () => void;
  onDetails?: () => void;
  videoCallDisabled?: boolean;
  videoCallLabel?: string;
};



// -------------------------------------------------------------
// PANTALLA PRINCIPAL
// -------------------------------------------------------------
const DashboardMedico: React.FC = () => {
  const navigation = usePortalAwareMedicoNavigation();
  const { isInsidePortal } = useMedicoModule();
  const { signOut } = useAuth();
  const { syncProfile } = useMedicoSessionProfile();
  const { fs, rs, wp, hp, select, isDesktop, isTablet, isMobile, typography } = useResponsive();
  const isDesktopLayout = isDesktop;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [doctorName, setDoctorName] = useState('Doctor');
  const [doctorSpec, setDoctorSpec] = useState('Especialidad no definida');
  const [doctorAvatar, setDoctorAvatar] = useState<ImageSourcePropType>(DefaultAvatar);

  const [dashboardData, setDashboardData] = useState<DashboardPayload>(EMPTY_DASHBOARD);
  const [upcomingCitas, setUpcomingCitas] = useState<MedicoUpcomingCita[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [profileReady, setProfileReady] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [openingCitaId, setOpeningCitaId] = useState('');

  const lastRefreshRef = useRef(0);

  // --- Sub-componentes internos para acceder a styles ---
  const AppointmentCard: React.FC<AppointmentCardProps> = ({
    patient,
    detail,
    avatar,
    onVideoCall,
    onDetails,
    videoCallDisabled,
    videoCallLabel = 'Videollamada',
  }) => {
    return (
      <View style={styles.apptCard}>
        <Image source={avatar} style={styles.apptAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.apptDoctor}>{patient}</Text>
          <Text style={styles.apptDetail}>{detail}</Text>
        </View>

        <View style={styles.apptBtns}>
          {onVideoCall && (
            <TouchableOpacity
              style={[styles.smallBtnBlue, videoCallDisabled && styles.smallBtnGrayDisabled]}
              onPress={onVideoCall}
              disabled={videoCallDisabled}
            >
              <Text style={[styles.smallBtnBlueText, videoCallDisabled && styles.smallBtnGrayTextDisabled]}>
                {videoCallLabel}
              </Text>
            </TouchableOpacity>
          )}
          {onDetails && (
            <TouchableOpacity style={styles.smallBtnGray} onPress={onDetails}>
              <Text style={styles.smallBtnGrayText}>Detalles</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const PatientRow: React.FC<{ name: string; id: string; lastSeen: string; avatar: ImageSourcePropType; onPress?: () => void }> = ({
    name,
    id,
    lastSeen,
    avatar,
    onPress,
  }) => (
    <View style={styles.docRow}>
      <View style={styles.docLeft}>
        <View style={styles.docIconBox}>
          <Image source={avatar} style={styles.docAvatar} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.docSub} numberOfLines={1}>
            Expediente #{id} • {lastSeen}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onPress}>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );

  const StatPill: React.FC<{ title: string; value: string; icon: MaterialIconName; trendText: string; trendUp?: boolean }> = ({ title, value, icon, trendText, trendUp = true }) => {
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

  const FileCard: React.FC<{ name: string; id: string; lastSeen: string; onPress?: () => void }> = ({ name, id, lastSeen, onPress }) => (
    <View style={styles.docRow}>
      <View style={styles.docLeft}>
        <View style={styles.docIconBox}>
          <MaterialIcons name="folder-shared" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.docSub} numberOfLines={1}>
            Expediente #{id} • {lastSeen}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onPress}>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );

  // -------------------------------------------------------------
  // ESTILOS DINÁMICOS (Premium Responsive)
  // -------------------------------------------------------------
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    containerDesktop: { flexDirection: 'row' },
    containerTablet: { flexDirection: 'row' },
    containerMobile: { flexDirection: 'column' },
    mainCallContainer: {
      flex: 1,
      backgroundColor: '#000',
      overflow: 'hidden',
    },

    mobileMenuBar: {
      paddingHorizontal: rs(14),
      paddingTop: rs(12),
      paddingBottom: rs(8),
      backgroundColor: colors.bg
    },
    mobileMenuButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(8),
      paddingHorizontal: rs(12),
      paddingVertical: rs(8),
      borderRadius: rs(10),
      borderWidth: 1,
      borderColor: '#d8e4f0',
      backgroundColor: colors.white
    },
    mobileMenuButtonText: { color: colors.dark, fontWeight: '700', fontSize: fs(13) },

    sidebar: { backgroundColor: colors.white, justifyContent: 'space-between' },
    sidebarDesktop: {
      width: rs(240),
      borderRightWidth: 1,
      borderRightColor: '#eef2f7',
      padding: rs(16)
    },
    sidebarTablet: {
      width: rs(220),
      borderRightWidth: 1,
      borderRightColor: '#eef2f7',
      padding: rs(16)
    },
    sidebarMobile: {
      width: '100%',
      borderBottomWidth: 1,
      borderBottomColor: '#eef2f7',
      padding: rs(14)
    },

    logoBox: { flexDirection: 'row', alignItems: 'center', gap: rs(10) },
    logo: { width: rs(44), height: rs(44), resizeMode: 'contain' },
    logoTitle: { fontSize: fs(20), fontWeight: '800', color: colors.dark, letterSpacing: 0.5 },
    logoSubtitle: { fontSize: fs(11), fontWeight: '700', color: colors.muted },

    userBox: { marginTop: rs(18), alignItems: 'center', paddingVertical: rs(12) },
    userAvatar: {
      width: rs(70),
      height: rs(70),
      borderRadius: rs(70),
      marginBottom: rs(10),
      borderWidth: 4,
      borderColor: '#f5f7fb'
    },
    userName: { fontWeight: '800', color: colors.dark, fontSize: fs(14), textAlign: 'center' },
    userPlan: { color: colors.muted, fontSize: fs(11), fontWeight: '700', marginTop: rs(2), textAlign: 'center' },

    menu: { marginTop: rs(10), gap: rs(6) },
    menuDesktop: { flex: 1 },
    menuMobile: { flexDirection: 'row', flexWrap: 'wrap' },
    menuItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(12),
      paddingVertical: rs(12),
      paddingHorizontal: rs(12),
      borderRadius: rs(12),
      minWidth: rs(140)
    },
    menuItemActive: {
      backgroundColor: 'rgba(19,127,236,0.10)',
      borderRightWidth: 3,
      borderRightColor: colors.primary
    },
    menuText: { fontSize: fs(14), fontWeight: '700', color: colors.muted },
    menuTextActive: { color: colors.primary },

    logoutButton: {
      flexDirection: 'row',
      gap: rs(10),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand,
      paddingVertical: rs(12),
      borderRadius: rs(12)
    },
    logoutText: { color: '#fff', fontWeight: '800', fontSize: fs(14) },

    main: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
    mainMobile: { paddingHorizontal: 20, paddingTop: 12 },

    header: { marginBottom: rs(2) },
    notifBtn: {
      width: rs(44),
      height: rs(44),
      borderRadius: rs(14),
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.dark,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2
    },
    notifDot: {
      position: 'absolute',
      top: rs(10),
      right: rs(10),
      width: rs(10),
      height: rs(10),
      borderRadius: rs(10),
      backgroundColor: '#ef4444',
      borderWidth: 2,
      borderColor: '#fff'
    },

    title: {
      fontSize: fs(22),
      fontWeight: '900',
      color: colors.dark,
      marginTop: 0,
      letterSpacing: -0.3
    },
    subtitle: {
      fontSize: fs(13),
      color: colors.muted,
      marginTop: rs(4),
      marginBottom: rs(16),
      fontWeight: '600',
      lineHeight: fs(20)
    },

    bigCard: {
      backgroundColor: '#fff',
      borderRadius: rs(24),
      padding: rs(16),
      flexDirection: isDesktop ? 'row' : 'column',
      gap: rs(16),
      marginBottom: rs(20),
      shadowColor: colors.dark,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3
    },
    bigCardLeft: { flex: 1 },
    bigCardRight: {
      width: isDesktop ? rs(160) : '100%',
      justifyContent: 'center',
      alignItems: 'center'
    },
    bigCardImage: { width: rs(130), height: rs(130), borderRadius: rs(20) },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: rs(8), marginBottom: rs(10) },
    liveDot: { width: rs(10), height: rs(10), borderRadius: rs(10), backgroundColor: '#22c55e' },
    liveText: {
      color: colors.primary,
      fontSize: fs(11),
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase'
    },
    bigCardTitle: { fontSize: fs(16), fontWeight: '900', color: colors.dark, marginBottom: rs(6) },
    bigCardSub: { fontSize: fs(13), color: colors.muted, fontWeight: '700', marginBottom: rs(14) },
    bigCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(10) },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(8),
      backgroundColor: colors.primary,
      paddingVertical: rs(12),
      paddingHorizontal: rs(16),
      borderRadius: rs(16),
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3
    },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: fs(14) },
    secondaryBtn: {
      backgroundColor: '#f1f5f9',
      paddingVertical: rs(12),
      paddingHorizontal: rs(16),
      borderRadius: rs(16)
    },
    secondaryBtnText: { color: colors.muted, fontWeight: '900', fontSize: fs(14) },

    quickRow: { flexDirection: 'row', gap: rs(10), marginBottom: rs(18), flexWrap: 'wrap' },
    quickTile: {
      flex: 1,
      backgroundColor: '#fff',
      borderRadius: rs(16),
      paddingVertical: rs(14),
      paddingHorizontal: rs(10),
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#eef3fa',
      shadowColor: colors.dark,
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2
    },
    quickTileIcon: {
      width: rs(44),
      height: rs(44),
      borderRadius: rs(12),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: rs(8)
    },
    quickTileLabel: { fontSize: fs(12), fontWeight: '700', color: colors.dark, textAlign: 'center' },

    twoCols: {
      flexDirection: isDesktop ? 'row' : 'column',
      gap: rs(16),
      marginTop: rs(16)
    },
    colLeft: { flex: 2 },
    colRight: { flex: 1.2 },
    colLeftFull: { flex: 1 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

    sectionTitle: {
      fontSize: fs(16),
      fontWeight: '900',
      color: colors.dark,
      marginBottom: rs(10),
      marginTop: rs(10)
    },
    link: { color: colors.primary, fontWeight: '900', fontSize: fs(12) },

    apptCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(12),
      backgroundColor: '#fff',
      padding: rs(14),
      borderRadius: rs(18),
      marginTop: rs(10),
      shadowColor: colors.dark,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2
    },
    apptAvatar: { width: rs(52), height: rs(52), borderRadius: rs(16) },
    apptDoctor: { fontWeight: '900', color: colors.dark, fontSize: fs(14) },
    apptDetail: { color: colors.muted, fontWeight: '700', marginTop: rs(2), fontSize: fs(12) },
    apptBtns: { flexDirection: 'row', gap: rs(8) },
    smallBtnGray: {
      backgroundColor: '#f1f5f9',
      paddingVertical: rs(8),
      paddingHorizontal: rs(12),
      borderRadius: rs(12)
    },
    smallBtnGrayDisabled: { backgroundColor: '#e2e8f0' },
    smallBtnGrayText: { color: colors.muted, fontWeight: '900', fontSize: fs(12) },
    smallBtnGrayTextDisabled: { color: '#94a3b8' },
    smallBtnBlue: {
      backgroundColor: 'rgba(19,127,236,0.12)',
      paddingVertical: rs(8),
      paddingHorizontal: rs(12),
      borderRadius: rs(12)
    },
    smallBtnBlueText: { color: colors.primary, fontWeight: '900', fontSize: fs(12) },

    docRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rs(12),
      borderBottomWidth: 1,
      borderBottomColor: '#eef2f7'
    },
    docLeft: { flexDirection: 'row', alignItems: 'center', gap: rs(12), flex: 1 },
    docIconBox: {
      width: rs(40),
      height: rs(40),
      borderRadius: rs(12),
      backgroundColor: '#f4f8fc',
      alignItems: 'center',
      justifyContent: 'center'
    },
    docAvatar: { width: '100%', height: '100%', borderRadius: rs(12) },
    docTitle: { color: colors.dark, fontWeight: '700', fontSize: fs(13) },
    docSub: { color: colors.muted, fontSize: fs(11), marginTop: rs(2) },

    emptyCard: {
      alignItems: 'center',
      padding: rs(24),
      backgroundColor: '#fff',
      borderRadius: rs(18),
      borderWidth: 1,
      borderColor: '#eef2f7',
      borderStyle: 'dashed',
      marginTop: rs(10)
    },
    emptyText: { color: colors.muted, fontWeight: '600', marginTop: rs(10), fontSize: fs(14) },

    statsContainer: { gap: rs(10), marginTop: rs(10) },
    statCard: {
      backgroundColor: '#fff',
      padding: rs(16),
      borderRadius: rs(18),
      shadowColor: colors.dark,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2
    },
    statTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: rs(12)
    },
    statTitle: {
      color: colors.muted,
      fontWeight: '700',
      fontSize: fs(11),
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    statBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    statValue: { fontSize: fs(20), fontWeight: '900', color: colors.dark },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(4),
      backgroundColor: '#f8fafc',
      paddingHorizontal: rs(8),
      paddingVertical: rs(4),
      borderRadius: rs(8)
    },
    trendText: { fontSize: fs(11), fontWeight: '800' },
  }), [fs, rs, isDesktop, colors]);

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const loadDashboardData = useCallback(async () => {
    setLoadingDashboard(true);
    setDataError(false);

    // Show real content (or empty state) after 2s max — prevents the perception of an infinite skeleton.
    const timeoutId = setTimeout(() => {
      setLoadingDashboard(false);
      setDataError(true);
    }, 2000);

    try {
      const payload = await apiClient.get<any>('/api/users/me/dashboard-medico', {
        authenticated: true,
      });
      clearTimeout(timeoutId);
      
      if (!(payload?.success && payload?.dashboard)) {
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
      clearTimeout(timeoutId);
      setDashboardData(EMPTY_DASHBOARD);
      setDataError(true);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const loadUpcomingCitas = useCallback(async () => {
    try {
      const payload = await apiClient.get<any>('/api/agenda/me/citas', {
        authenticated: true,
        query: { scope: 'upcoming', limit: 20 },
      });
      if (!(payload?.success && Array.isArray(payload?.citas))) {
        setUpcomingCitas([]);
        return;
      }

      const mapped = (payload.citas as any[]).map((item) => ({
        citaid: String(item?.citaid || ''),
        fechaHoraInicio: item?.fechaHoraInicio || null,
        estado: String(item?.estado || 'Pendiente'),
        modalidad: String(item?.modalidad || ''),
        paciente: {
          pacienteid: String(item?.paciente?.pacienteid || ''),
          nombreCompleto: String(item?.paciente?.nombreCompleto || 'Paciente'),
          fotoUrl: item?.paciente?.fotoUrl || '',
        },
      })).filter((item) => String(item?.modalidad || '').toLowerCase() === 'virtual');

      mapped.sort((a, b) => parseDateMs(a?.fechaHoraInicio) - parseDateMs(b?.fechaHoraInicio));
      setUpcomingCitas(mapped);
    } catch {
      setUpcomingCitas([]);
    }
  }, []);

  const loadMedicoProfile = useCallback(async () => {
    // Run profile sync and data fetches in parallel so the dashboard can render
    // as soon as data arrives, even if the profile endpoint is slow.
    const profilePromise = syncProfile().catch(() => null) as Promise<MedicoSessionUser | null>;
    const dataPromise = Promise.all([loadDashboardData(), loadUpcomingCitas()]).catch(() => null);

    try {
      const nextUser = await profilePromise;

      const nombreBase = String(
        nextUser?.nombreCompleto || nextUser?.medico?.nombreCompleto || ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const especialidadBase = String(
        nextUser?.especialidad || nextUser?.medico?.especialidad || ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const fotoBase = sanitizeFotoUrl(
        nextUser?.fotoUrl || nextUser?.medico?.fotoUrl || ''
      );

      setDoctorName(nombreBase ? addDoctorPrefix(nombreBase) : 'Doctor');
      setDoctorSpec(especialidadBase || 'Especialidad no definida');
      setDoctorAvatar(fotoBase ? { uri: fotoBase } : DefaultAvatar);
    } catch {
      setDoctorName('Doctor');
    } finally {
      setProfileReady(true);
      await dataPromise;
    }
  }, [syncProfile, loadDashboardData, loadUpcomingCitas]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (!profileReady || now - lastRefreshRef.current > MIN_REFRESH_INTERVAL_MS) {
        lastRefreshRef.current = now;
        loadMedicoProfile();
      }
    }, [profileReady, loadMedicoProfile])
  );

  const handleLogout = async () => {
    closeMobileMenu();
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleSidebarNavigation = (route: string) => {
    closeMobileMenu();
    navigation.navigate(route as any);
  };

  const handleVideoCall = (citaId?: string) => {
    const targetCitaId = citaId || upcomingCitas[0]?.citaid;
    if (!targetCitaId) return;

    navigation.navigate('VideoCall', {
      citaId: targetCitaId,
      initiate: true
    });
  };

  // Calculate the most relevant "next" or "current" appointment
  const currentConsultation = useMemo(() => {
    const now = Date.now();
    return upcomingCitas.find((c) => {
      if (!c.fechaHoraInicio) return false;
      const startMs = new Date(c.fechaHoraInicio).getTime();
      if (!Number.isFinite(startMs)) return false;
      
      // Active 5 minutes before start, up to 30 minutes after start
      const diffMinStart = (startMs - now) / 60000;
      const startedHowLongAgo = (now - startMs) / 60000;

      return diffMinStart <= 5 && startedHowLongAgo <= 30;
    });
  }, [upcomingCitas]);

  const nextCita = currentConsultation || upcomingCitas[0] || null;
  const isConsultationActive = useMemo(() => {
    if (!nextCita?.fechaHoraInicio) return false;
    const now = Date.now();
    const startMs = new Date(nextCita.fechaHoraInicio).getTime();
    const diffMinStart = (startMs - now) / 60000;
    const startedHowLongAgo = (now - startMs) / 60000;
    return diffMinStart <= 5 && startedHowLongAgo <= 30;
  }, [nextCita]);

  const bannerPatientName = nextCita ? nextCita.paciente.nombreCompleto : '';
  const bannerPatientAvatar = resolveAvatarSource(nextCita?.paciente?.fotoUrl);


  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={[styles.main, !isDesktopLayout ? styles.mainMobile : null]} contentContainerStyle={{ paddingBottom: 40 }}>
        <MedicoHeader
          title={`Hola, ${doctorName.split(' ').slice(0, 2).join(' ')}`}
          hasNotifications={dashboardData.stats.mensajesPendientes > 0}
        />

        {/* ── Skeleton loading overlay ── */}
        {loadingDashboard && (
          <View style={{ gap: rs(12), marginBottom: rs(16) }}>
            <View style={{
              backgroundColor: '#e8eff5',
              borderRadius: rs(20),
              height: rs(14),
              width: '60%',
              marginBottom: rs(8),
            }} />
            <View style={{
              backgroundColor: '#e8eff5',
              borderRadius: rs(24),
              height: rs(160),
              width: '100%',
            }} />
            <View style={{ flexDirection: 'row', gap: rs(10) }}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={{
                  flex: 1,
                  backgroundColor: '#e8eff5',
                  borderRadius: rs(18),
                  height: rs(90),
                }} />
              ))}
            </View>
            <View style={{
              backgroundColor: '#e8eff5',
              borderRadius: rs(18),
              height: rs(80),
              width: '100%',
            }} />
          </View>
        )}

        {!loadingDashboard && (
          <>
            {dataError && (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: rs(14), padding: rs(14), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(10) }}>
                <MaterialIcons name="wifi-off" size={20} color={colors.red} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.dark }}>Conexión lenta o sin datos</Text>
                  <Text style={{ fontSize: fs(11), color: colors.muted, marginTop: rs(2) }}>Algunos datos podrían no estar actualizados.</Text>
                </View>
                <TouchableOpacity onPress={() => loadMedicoProfile()} style={{ paddingHorizontal: rs(12), paddingVertical: rs(6), backgroundColor: colors.primary, borderRadius: rs(8) }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(11) }}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.subtitle}>Aquí tienes un resumen de tu jornada y próximos pacientes.</Text>

            {/* ── Llamada en Curso card ── */}
            {(() => {
              const now = Date.now();
              const activeCita = upcomingCitas.find((c) => {
                if (!c.fechaHoraInicio) return false;
                const startMs = new Date(c.fechaHoraInicio).getTime();
                if (!Number.isFinite(startMs)) return false;
                const diffMinStart = (startMs - now) / 60000;
                const startedHowLongAgo = (now - startMs) / 60000;
                return diffMinStart <= 5 && startedHowLongAgo <= 30;
              });
              if (!activeCita) return null;
              return (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: rs(14),
                    backgroundColor: '#fff',
                    padding: rs(16),
                    borderRadius: rs(20),
                    marginBottom: rs(16),
                    borderLeftWidth: 4,
                    borderLeftColor: colors.green,
                    shadowColor: colors.dark,
                    shadowOpacity: 0.08,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 3,
                  }}
                  onPress={() => handleVideoCall(activeCita.citaid)}
                  activeOpacity={0.85}
                >
                  <View style={{
                    width: rs(48), height: rs(48), borderRadius: rs(14),
                    backgroundColor: 'rgba(34,197,94,0.12)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MaterialIcons name="videocam" size={24} color={colors.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(6) }}>
                      <View style={{ width: rs(8), height: rs(8), borderRadius: rs(8), backgroundColor: colors.green }} />
                      <Text style={{ fontSize: fs(11), fontWeight: '900', color: colors.green, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Llamada disponible
                      </Text>
                    </View>
                    <Text style={{ fontSize: fs(14), fontWeight: '800', color: colors.dark, marginTop: rs(4) }} numberOfLines={1}>
                      {activeCita.paciente.nombreCompleto}
                    </Text>
                    <Text style={{ fontSize: fs(12), color: colors.muted, fontWeight: '600', marginTop: rs(2) }}>
                      {formatDateTime(activeCita.fechaHoraInicio)} • Toca para unirte
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: colors.green,
                    paddingVertical: rs(10), paddingHorizontal: rs(16),
                    borderRadius: rs(12),
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: fs(13) }}>Unirse</Text>
                  </View>
                </TouchableOpacity>
              );
            })()}

            <View style={styles.bigCard}>
              <View style={styles.bigCardLeft}>
                <View style={styles.liveRow}>
                  <View style={[styles.liveDot, { backgroundColor: isConsultationActive ? '#22c55e' : colors.primary }]} />
                  <Text style={[styles.liveText, { color: isConsultationActive ? '#22c55e' : colors.primary }]}>
                    {isConsultationActive ? 'CONSULTA ACTIVA' : nextCita ? 'PRÓXIMA CITA' : 'JORNADA ACTIVA'}
                  </Text>
                </View>
                <Text style={styles.bigCardTitle}>Bienvenido de nuevo, {doctorName}</Text>
                <Text style={styles.bigCardSub}>
                  {nextCita
                    ? `Tienes una videollamada programada con ${bannerPatientName} para las ${formatDateTime(nextCita.fechaHoraInicio)}.`
                    : 'No tienes citas virtuales programadas para este momento.'}
                </Text>

                <View style={styles.bigCardActions}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, (!isConsultationActive || openingCitaId) && { opacity: 0.6 }]}
                    onPress={() => handleVideoCall(nextCita?.citaid)}
                    disabled={!isConsultationActive || !!openingCitaId}
                  >
                    <MaterialIcons name="videocam" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>
                      {openingCitaId ? 'Iniciando...' : 'Entrar a consulta'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('MedicoCitas', { highlightCitaId: nextCita?.citaid })}>
                    <Text style={styles.secondaryBtnText}>Ver agenda completa</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {isDesktopLayout && (
                <View style={styles.bigCardRight}>
                  <Image source={bannerPatientAvatar} style={styles.bigCardImage} />
                </View>
              )}
            </View>

            {/* Quick Stats */}
            <View style={styles.quickRow}>
              <StatPill
                title="Citas hoy"
                value={String(dashboardData.stats.citasHoy)}
                icon="today"
                trendText="+2"
              />
              <StatPill
                title="Completadas"
                value={String(dashboardData.stats.citasCompletadas)}
                icon="check-circle"
                trendText="80%"
              />
              <StatPill
                title="Pacientes Mes"
                value={String(dashboardData.stats.nuevosPacientesMes)}
                icon="people"
                trendText="+12%"
              />
              <StatPill
                title="Mensajes"
                value={String(dashboardData.stats.mensajesPendientes)}
                icon="chat"
                trendText="Pendientes"
                trendUp={false}
              />
            </View>

            <View style={styles.twoCols}>
              <View style={styles.colLeft}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>Próximas consultas virtuales</Text>
                  <TouchableOpacity onPress={() => handleSidebarNavigation('MedicoCitas')}>
                    <Text style={styles.link}>Ver todas</Text>
                  </TouchableOpacity>
                </View>

                {upcomingCitas.length > 0 ? (
                  upcomingCitas.map((cita) => (
                    <AppointmentCard
                      key={cita.citaid}
                      patient={cita.paciente.nombreCompleto}
                      detail={formatDateTime(cita.fechaHoraInicio)}
                      avatar={resolveAvatarSource(cita.paciente.fotoUrl)}
                      onVideoCall={() => handleVideoCall(cita.citaid)}
                      onDetails={() =>
                        navigation.navigate('MedicoPacienteDetalle', {
                          patientId: cita.paciente.pacienteid,
                          patientName: cita.paciente.nombreCompleto,
                        })
                      }
                      videoCallDisabled={!!openingCitaId}
                    />
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons name="calendar-blank" size={40} color={colors.muted} />
                    <Text style={styles.emptyText}>No hay citas virtuales hoy</Text>
                  </View>
                )}
              </View>

              <View style={styles.colRight}>
                <Text style={styles.sectionTitle}>Expedientes recientes</Text>
                <View style={{ backgroundColor: '#fff', borderRadius: rs(20), padding: rs(10) }}>
                  {dashboardData.expedientesRecientes.length > 0 ? (
                    dashboardData.expedientesRecientes.map((exp) => (
                      <FileCard
                        key={exp.id}
                        name={exp.name}
                        id={exp.code}
                        lastSeen={exp.lastSeenText}
                        onPress={() =>
                          navigation.navigate('MedicoPacienteDetalle', {
                            patientId: exp.id,
                            patientName: exp.name,
                          })
                        }
                      />
                    ))
                  ) : (
                    <Text style={{ padding: rs(20), color: colors.muted, textAlign: 'center' }}>
                      Sin actividad reciente
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default DashboardMedico;
