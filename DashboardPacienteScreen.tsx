import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { useResponsive } from './hooks/useResponsive';
import type { ImageSourcePropType } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePortalAwareNavigation } from './navigation/usePortalAwareNavigation';
import { usePacienteModule } from './navigation/PacienteModuleContext';
import { useAuth } from './providers/AuthProvider';
import { apiClient } from './utils/api';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useLanguage } from './localization/LanguageContext';
import { usePatientSessionProfile, type PatientSessionUser } from './hooks/usePatientSessionProfile';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

import sharedColors from './theme/colors';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const MIN_REFRESH_INTERVAL_MS = 15000;

// Use the shared palette so the patient dashboard matches the doctor dashboard exactly.
const colors = {
  primary: sharedColors.primary,
  brand: sharedColors.brand,
  dark: sharedColors.dark,
  muted: sharedColors.muted,
  light: sharedColors.light,
  bg: sharedColors.bg,
  white: sharedColors.white,
  green: sharedColors.green,
  red: sharedColors.red,
};

/* ===================== HELPERS ===================== */
const normalizeString = (value: unknown) => String(value || '').trim();
const sanitizeFotoUrl = (value: unknown) => {
  const clean = normalizeString(value);
  if (!clean || clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};
const resolveAvatarSource = (value: unknown): ImageSourcePropType => {
  const clean = sanitizeFotoUrl(value);
  return clean ? { uri: clean } : DefaultAvatar;
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
  return `en ${Math.round(diffHour / 24)} día(s)`;
};
const parseDateMs = (value: string | null | undefined) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

/* ===================== TIPOS ===================== */
type User = {
  usuarioid?: number | string;
  nombres?: string;
  apellidos?: string;
  plan?: string;
  fotoUrl?: string;
};

type CitaItem = {
  citaid: string;
  fechaHoraInicio: string | null;
  estado: string;
  medico?: {
    nombreCompleto?: string;
    especialidad?: string;
    fotoUrl?: string | null;
  };
};

type NotificationItem = {
  id: string;
  titulo: string;
  contenido: string;
  leida: boolean;
  createdAt: string;
  tipo?: string;
};

/* ===================== PANTALLA ===================== */
const DashboardPacienteScreen: React.FC = () => {
  const navigation = usePortalAwareNavigation();
  const { isInsidePortal, isSidebarOpen, toggleSidebar, setIsNotificationsOpen } = usePacienteModule();
  const { signOut } = useAuth();
  const { sessionUser, syncProfile } = usePatientSessionProfile();
  const { t } = useLanguage();
  const { isDesktop, isTablet, isMobile, select, fs, rs, wp, hp } = useResponsive();
  const [isExpressModalOpen, setIsExpressModalOpen] = useState(true);
  const [user, setUser] = useState<User | null>(() => (ensurePatientSessionUser(sessionUser) as User | null) || null);
  const [loadingCitas, setLoadingCitas] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [upcomingCitas, setUpcomingCitas] = useState<CitaItem[]>([]);
  const [historyCitas, setHistoryCitas] = useState<CitaItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    if (sessionUser) {
      setUser((ensurePatientSessionUser(sessionUser) as User | null) || null);
    }
  }, [sessionUser]);

  // --- Sub-componentes internos ---
  const AppointmentRow: React.FC<{ name: string; detail: string; avatar: ImageSourcePropType; onPress?: () => void }> = ({ name, detail, avatar, onPress }) => (
    <View style={styles.docRow}>
      <View style={styles.docLeft}>
        <View style={styles.docIconBox}>
          <Image source={avatar} style={styles.docAvatar} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.docSub} numberOfLines={1}>{detail}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onPress}>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );

  // StatPill: same visual language as DashboardMedico's stats area, adapted to patient metrics.
  const StatPill: React.FC<{ title: string; value: string; icon: any; trendText: string; trendUp?: boolean }> = ({ title, value, icon, trendText, trendUp = true }) => (
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
          <Text style={[styles.trendText, { color: trendUp ? colors.green : colors.red }]}>{trendText}</Text>
        </View>
      </View>
    </View>
  );

  // -------------------------------------------------------------
  // ESTILOS DINÁMICOS
  // -------------------------------------------------------------
  const styles = useMemo(() => StyleSheet.create({
    drawerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 2000,
    },
    drawerContent: {
      width: 280,
      height: '100%',
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 15,
      elevation: 20,
    },
    sidebarContent: {
      flex: 1,
      padding: 20,
      backgroundColor: '#fff',
    },
    hamburgerBtn: {
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
    menuScroll: {
      flex: 1,
      marginTop: 20,
    },
    menuItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 4,
    },
    menuItemActive: {
      backgroundColor: 'rgba(19,127,236,0.1)',
    },
    menuText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.muted,
    },
    menuTextActive: {
      color: colors.primary,
    },
    logoutButton: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 20,
    },
    logoutText: {
      color: '#fff',
      fontWeight: '800',
    },

    container: { flex: 1, backgroundColor: '#F6FAFD' },

    // Modal-portal root — covers full viewport with dim backdrop, used by RN Modal which on Web auto-renders at body root
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },

    drawer: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 18, elevation: 10 },
    drawerLeft: { left: 0, width: rs(300) },
    drawerRight: { right: 0, width: rs(320) },

    drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: rs(16), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    drawerTitle: { fontSize: fs(18), fontWeight: '900', color: colors.dark },

    sidebar: { flex: 1, backgroundColor: colors.white, justifyContent: 'space-between', padding: rs(20) },

    logoBox: { flexDirection: 'row', alignItems: 'center', gap: rs(10) },
    logo: { width: rs(44), height: rs(44), resizeMode: 'contain' },
    logoTitle: { fontSize: fs(20), fontWeight: '800', color: colors.dark },
    logoSubtitle: { fontSize: fs(11), fontWeight: '700', color: colors.muted },

    userBox: { marginTop: rs(18), alignItems: 'center', paddingVertical: rs(12) },
    userAvatar: { width: rs(70), height: rs(70), borderRadius: rs(70), marginBottom: rs(10), borderWidth: 4, borderColor: '#f5f7fb' },
    userName: { fontWeight: '800', color: colors.dark, fontSize: fs(14), textAlign: 'center' },
    userPlan: { color: colors.muted, fontSize: fs(11), fontWeight: '700', marginTop: rs(2), textAlign: 'center' },

    main: { flex: 1, paddingHorizontal: rs(24), paddingTop: rs(12) },
    mainMobile: { paddingHorizontal: rs(14), paddingTop: rs(8) },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: rs(12), marginBottom: rs(2) },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: rs(12) },
    menuToggle: { width: rs(40), height: rs(40), alignItems: 'center', justifyContent: 'center', borderRadius: rs(10), backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    
    notifBtn: { width: rs(40), height: rs(40), borderRadius: rs(12), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: colors.dark, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    notifDot: { position: 'absolute', top: rs(8), right: rs(8), width: rs(8), height: rs(8), borderRadius: rs(8), backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' },

    title: { fontSize: fs(22), fontWeight: '900', color: colors.dark, marginTop: 0 },
    subtitle: { fontSize: fs(13), color: colors.muted, marginTop: rs(4), marginBottom: rs(16), fontWeight: '600' },

    bigCard: { backgroundColor: '#fff', borderRadius: rs(24), padding: rs(16), flexDirection: isDesktop ? 'row' : 'column', gap: rs(16), marginBottom: rs(20), shadowColor: colors.dark, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
    bigCardLeft: { flex: 1 },
    bigCardRight: { width: isDesktop ? rs(160) : '100%', justifyContent: 'center', alignItems: 'center' },
    bigCardImage: { width: rs(130), height: rs(130), borderRadius: rs(20) },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: rs(8), marginBottom: rs(10) },
    liveDot: { width: rs(10), height: rs(10), borderRadius: rs(10), backgroundColor: '#22c55e' },
    liveText: { color: colors.primary, fontSize: fs(11), fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
    bigCardTitle: { fontSize: fs(16), fontWeight: '900', color: colors.dark, marginBottom: rs(6) },
    bigCardSub: { fontSize: fs(13), color: colors.muted, fontWeight: '700', marginBottom: rs(14) },
    bigCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(10) },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: rs(8), backgroundColor: colors.primary, paddingVertical: rs(12), paddingHorizontal: rs(16), borderRadius: rs(16), shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: fs(14) },
    secondaryBtn: { backgroundColor: '#f1f5f9', paddingVertical: rs(12), paddingHorizontal: rs(16), borderRadius: rs(16) },
    secondaryBtnText: { color: colors.muted, fontWeight: '900', fontSize: fs(14) },

    quickRow: { flexDirection: 'row', gap: rs(10), marginBottom: rs(18), flexWrap: 'wrap' },
    quickTile: { flex: 1, minWidth: rs(100), backgroundColor: '#fff', borderRadius: rs(16), paddingVertical: rs(14), paddingHorizontal: rs(10), alignItems: 'center', borderWidth: 1, borderColor: '#eef3fa', shadowColor: colors.dark, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    quickTileIcon: { width: rs(44), height: rs(44), borderRadius: rs(12), alignItems: 'center', justifyContent: 'center', marginBottom: rs(8) },
    quickTileLabel: { fontSize: fs(12), fontWeight: '700', color: colors.dark, textAlign: 'center' },

    // Stats pills — same shape and metrics layout as DashboardMedico
    statCard: { flex: 1, minWidth: rs(140), backgroundColor: '#fff', padding: rs(16), borderRadius: rs(18), shadowColor: colors.dark, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    statTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(12) },
    statTitle: { color: colors.muted, fontWeight: '700', fontSize: fs(11), textTransform: 'uppercase', letterSpacing: 0.5 },
    statBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    statValue: { fontSize: fs(20), fontWeight: '900', color: colors.dark },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: rs(4), backgroundColor: '#f8fafc', paddingHorizontal: rs(8), paddingVertical: rs(4), borderRadius: rs(8) },
    trendText: { fontSize: fs(11), fontWeight: '800' },

    twoCols: { flexDirection: isDesktop ? 'row' : 'column', gap: rs(16), marginTop: rs(16) },
    colLeft: { flex: 2 },
    colRight: { flex: 1.2 },
    sectionTitle: { fontSize: fs(15), fontWeight: '900', color: colors.dark, marginBottom: rs(10), marginTop: rs(10) },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    link: { color: colors.primary, fontWeight: '900', fontSize: fs(12) },

    docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: rs(12), borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
    docLeft: { flexDirection: 'row', alignItems: 'center', gap: rs(12), flex: 1 },
    docIconBox: { width: rs(40), height: rs(40), borderRadius: rs(12), backgroundColor: '#f4f8fc', alignItems: 'center', justifyContent: 'center' },
    docAvatar: { width: '100%', height: '100%', borderRadius: rs(12) },
    docTitle: { color: colors.dark, fontWeight: '700', fontSize: fs(13) },
    docSub: { color: colors.muted, fontSize: fs(11), marginTop: rs(2) },

    emptyCard: { alignItems: 'center', padding: rs(24), backgroundColor: '#fff', borderRadius: rs(18), borderWidth: 1, borderColor: '#eef2f7', borderStyle: 'dashed', marginTop: rs(10) },
    emptyText: { color: colors.muted, fontWeight: '600', marginTop: rs(10), fontSize: fs(14) },

    expressBanner: { backgroundColor: '#0f172a', borderRadius: rs(20), padding: rs(18), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: rs(24), shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 },
    expressLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(14) },
    expressIconBox: { width: rs(44), height: rs(44), borderRadius: rs(44), backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    expressTitle: { color: '#fff', fontSize: fs(16), fontWeight: '900' },
    expressSub: { color: 'rgba(255,255,255,0.6)', fontSize: fs(12), fontWeight: '600', marginTop: rs(2) },
    expressBtn: { backgroundColor: colors.primary, paddingVertical: rs(10), paddingHorizontal: rs(16), borderRadius: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(6) },
    expressBtnText: { color: '#fff', fontWeight: '900', fontSize: fs(13) },

    // Notificaciones List
    notifItem: { padding: rs(14), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    notifUnread: { backgroundColor: 'rgba(30,64,175,0.03)' },
    notifTitle: { fontWeight: '800', color: colors.dark, fontSize: fs(13) },
    notifMsg: { color: colors.muted, fontSize: fs(12), marginTop: rs(4), lineHeight: fs(18) },
    notifTime: { color: '#94a3b8', fontSize: fs(11), marginTop: rs(6), fontWeight: '700' },

    modalContent: { backgroundColor: '#0f172a', borderRadius: rs(28), padding: rs(24), width: '90%', maxWidth: rs(450), shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: rs(10) },
    modalIconBox: { width: rs(60), height: rs(60), borderRadius: rs(30), backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: rs(20), alignSelf: 'center' },
    modalTitle: { color: '#fff', fontSize: fs(22), fontWeight: '900', textAlign: 'center', marginBottom: rs(10) },
    modalSub: { color: 'rgba(255,255,255,0.7)', fontSize: fs(14), fontWeight: '600', textAlign: 'center', lineHeight: fs(20), marginBottom: rs(24) },
    modalAction: { backgroundColor: colors.primary, paddingVertical: rs(16), borderRadius: rs(18), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(10) },
    modalActionText: { color: '#fff', fontWeight: '900', fontSize: fs(16) },
  }), [fs, rs, isDesktop]);

  const loadData = useCallback(async () => {
    setLoadingCitas(true);
    setDataError(false);

    // Hide the skeleton fast (2s max) — render real content or empty state instead.
    const timeoutId = setTimeout(() => {
      setLoadingCitas(false);
      setDataError(true);
    }, 2000);

    // Profile sync runs in parallel so a slow profile call doesn't block the dashboard.
    syncProfile()
      .then((sessionUser) => {
        setUser((ensurePatientSessionUser(sessionUser as PatientSessionUser | null) as User | null) || null);
      })
      .catch(() => {});

    try {
      const [up, hist, notifs] = await Promise.all([
        apiClient.get<any>('/api/agenda/me/citas', { authenticated: true, query: { scope: 'upcoming', limit: 5 } }).catch(() => null),
        apiClient.get<any>('/api/agenda/me/citas', { authenticated: true, query: { scope: 'history', limit: 5 } }).catch(() => null),
        apiClient.get<any>('/api/agenda/me/notificaciones', { authenticated: true, query: { limit: 15 } }).catch(() => null),
      ]);
      clearTimeout(timeoutId);
      if (up?.success) setUpcomingCitas(up.citas.sort((a: any, b: any) => parseDateMs(a.fechaHoraInicio) - parseDateMs(b.fechaHoraInicio)));
      if (hist?.success) setHistoryCitas(hist.citas);
      if (notifs?.success) setNotifications(notifs.notificaciones || []);
    } catch {
      clearTimeout(timeoutId);
      setDataError(true);
    } finally {
      setLoadingCitas(false);
    }
  }, [syncProfile]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRefreshRef.current > MIN_REFRESH_INTERVAL_MS) {
        lastRefreshRef.current = now;
        loadData();
      }
    }, [loadData])
  );

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);
  const userAvatarSource = resolveAvatarSource(user?.fotoUrl);
  const primaryCita = upcomingCitas[0] || null;
  const unreadCount = notifications.filter(n => !n.leida).length;


  return (
    <View style={styles.container}>


      {/* Modal Consulta Express */}
      <Modal
        visible={isExpressModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsExpressModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsExpressModalOpen(false)}
          />
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalHeader} onPress={() => setIsExpressModalOpen(false)}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <View style={styles.modalIconBox}>
              <MaterialIcons name="emergency" size={32} color="#fff" />
            </View>

            <Text style={styles.modalTitle}>¿Necesitas atención inmediata?</Text>
            <Text style={styles.modalSub}>
              Contamos con médicos de guardia disponibles 24/7 para videoconsultas de urgencia.
            </Text>

            <TouchableOpacity style={styles.modalAction} onPress={() => { setIsExpressModalOpen(false); navigation.navigate('EspecialistasPorEspecialidad', { specialty: 'Medicina General' }); }}>
              <MaterialIcons name="bolt" size={20} color="#fff" />
              <Text style={styles.modalActionText}>Iniciar Consulta Express</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingHorizontal: rs(24), paddingTop: rs(12), backgroundColor: '#F6FAFD', zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#eef4fb' }]}>
          <View style={styles.headerLeft}>
            {!isSidebarOpen && (
              <TouchableOpacity style={styles.menuToggle} onPress={toggleSidebar}>
                <MaterialIcons name="menu" size={24} color={colors.dark} />
              </TouchableOpacity>
            )}
            <Text style={styles.title}>Hola, {fullName.split(' ')[0]}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: rs(10) }}>
            <TouchableOpacity style={styles.notifBtn} onPress={() => setIsNotificationsOpen(true)}>
              <MaterialIcons name="notifications" size={22} color={colors.dark} />
              {unreadCount > 0 && <View style={styles.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={[styles.main, !isDesktop && styles.mainMobile]} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Skeleton loading overlay ── */}
          {loadingCitas && upcomingCitas.length === 0 && (
            <View style={{ gap: rs(12), marginBottom: rs(16) }}>
              <View style={{ backgroundColor: '#e8eff5', borderRadius: rs(20), height: rs(14), width: '60%', marginBottom: rs(8) }} />
              <View style={{ backgroundColor: '#e8eff5', borderRadius: rs(24), height: rs(160), width: '100%' }} />
              <View style={{ flexDirection: 'row', gap: rs(10) }}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: '#e8eff5', borderRadius: rs(18), height: rs(90) }} />
                ))}
              </View>
              <View style={{ backgroundColor: '#e8eff5', borderRadius: rs(18), height: rs(80), width: '100%' }} />
            </View>
          )}

          {dataError && !loadingCitas && (
            <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: rs(14), padding: rs(14), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(10) }}>
              <MaterialIcons name="wifi-off" size={20} color={colors.red} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.dark }}>Conexión lenta</Text>
                <Text style={{ fontSize: fs(11), color: colors.muted, marginTop: rs(2) }}>Algunos datos podrían no estar actualizados.</Text>
              </View>
              <TouchableOpacity onPress={() => loadData()} style={{ paddingHorizontal: rs(12), paddingVertical: rs(6), backgroundColor: colors.primary, borderRadius: rs(8) }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(11) }}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.subtitle}>Gestiona tus consultas y salud desde aquí.</Text>

          {/* ── Llamada Disponible (active call card) ── */}
          {(() => {
            const now = Date.now();
            const activeCita = upcomingCitas.find((c) => {
              if (!c.fechaHoraInicio) return false;
              const startMs = new Date(c.fechaHoraInicio).getTime();
              if (!Number.isFinite(startMs)) return false;
              const diffMin = (startMs - now) / 60000;
              return diffMin <= 10 && diffMin >= -60;
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
                onPress={() => navigation.navigate('WaitingRoom', { citaId: activeCita.citaid })}
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
                    {activeCita.medico?.nombreCompleto || 'Tu médico'}
                  </Text>
                  <Text style={{ fontSize: fs(12), color: colors.muted, fontWeight: '600', marginTop: rs(2) }}>
                    {formatDateTime(activeCita.fechaHoraInicio)} • Toca para entrar
                  </Text>
                </View>
                <View style={{
                  backgroundColor: colors.green,
                  paddingVertical: rs(10), paddingHorizontal: rs(16),
                  borderRadius: rs(12),
                }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: fs(13) }}>Entrar</Text>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* Big Card */}
          <View style={styles.bigCard}>
            <View style={styles.bigCardLeft}>
              <View style={styles.liveRow}>
                <View style={[styles.liveDot, { backgroundColor: primaryCita ? colors.green : colors.primary }]} />
                <Text style={styles.liveText}>{primaryCita ? 'Cita próxima' : 'Sistema listo'}</Text>
              </View>
              <Text style={styles.bigCardTitle}>
                {primaryCita ? `Tienes una cita con ${primaryCita.medico?.nombreCompleto}` : `¡Bienvenido de nuevo, ${fullName.split(' ')[0]}!`}
              </Text>
              <Text style={styles.bigCardSub}>
                {primaryCita 
                  ? `${formatDateTime(primaryCita.fechaHoraInicio)} (${formatRelativeIn(primaryCita.fechaHoraInicio)})` 
                  : '¿Necesitas hablar con un especialista? Agenda tu consulta ahora.'}
              </Text>
              <View style={styles.bigCardActions}>
                {primaryCita ? (
                  <>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('WaitingRoom', { citaId: primaryCita.citaid })}>
                      <MaterialIcons name="videocam" size={20} color="#fff" />
                      <Text style={styles.primaryBtnText}>Entrar a consulta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('PacienteCitas')}>
                      <Text style={styles.secondaryBtnText}>Ver detalles</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('NuevaConsultaPaciente')}>
                    <MaterialIcons name="add" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Nueva consulta</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.bigCardRight}>
              <Image source={primaryCita ? resolveAvatarSource(primaryCita.medico?.fotoUrl) : userAvatarSource} style={styles.bigCardImage} />
            </View>
          </View>

          {/* Stats overview — mirrors DashboardMedico's StatPill row */}
          <View style={styles.quickRow}>
            <StatPill
              title="Próximas citas"
              value={String(upcomingCitas.length)}
              icon="event"
              trendText={upcomingCitas.length > 0 ? 'Activas' : 'Sin citas'}
              trendUp={upcomingCitas.length > 0}
            />
            <StatPill
              title="Médicos consultados"
              value={String(historyCitas.length)}
              icon="people"
              trendText={historyCitas.length > 0 ? 'Historial' : 'Nuevo'}
            />
            <StatPill
              title="Notificaciones"
              value={String(unreadCount)}
              icon="notifications"
              trendText={unreadCount > 0 ? 'Sin leer' : 'Al día'}
              trendUp={unreadCount === 0}
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickTile} onPress={() => navigation.navigate('NuevaConsultaPaciente')}>
              <View style={[styles.quickTileIcon, { backgroundColor: 'rgba(19,127,236,0.1)' }]}>
                <MaterialIcons name="add-circle" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickTileLabel}>Agendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickTile} onPress={() => navigation.navigate('PacienteCitas')}>
              <View style={[styles.quickTileIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                <MaterialIcons name="event" size={24} color={colors.green} />
              </View>
              <Text style={styles.quickTileLabel}>Mis Citas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickTile} onPress={() => navigation.navigate('PacienteRecetasDocumentos')}>
              <View style={[styles.quickTileIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                <MaterialIcons name="description" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.quickTileLabel}>Recetas</Text>
            </TouchableOpacity>
          </View>

          {/* Two Columns */}
          <View style={styles.twoCols}>
            <View style={styles.colLeft}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Próximas consultas</Text>
                <TouchableOpacity onPress={() => navigation.navigate('PacienteCitas')}>
                  <Text style={styles.link}>Ver todas</Text>
                </TouchableOpacity>
              </View>
              {upcomingCitas.length > 0 ? (
                upcomingCitas.map((cita) => (
                  <AppointmentRow 
                    key={cita.citaid}
                    name={cita.medico?.nombreCompleto || 'Médico'}
                    detail={`${cita.medico?.especialidad || 'Consulta'} • ${formatDateTime(cita.fechaHoraInicio)}`}
                    avatar={resolveAvatarSource(cita.medico?.fotoUrl)}
                    onPress={() => navigation.navigate('PacienteCitas')}
                  />
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="event-busy" size={32} color={colors.muted} />
                  <Text style={styles.emptyText}>No tienes citas programadas</Text>
                </View>
              )}
            </View>

            <View style={styles.colRight}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Médicos recientes</Text>
                <TouchableOpacity>
                  <Text style={styles.link}>Ver todos</Text>
                </TouchableOpacity>
              </View>
              {historyCitas.slice(0, 3).length > 0 ? (
                historyCitas.slice(0, 3).map((cita) => (
                  <AppointmentRow 
                    key={cita.citaid}
                    name={cita.medico?.nombreCompleto || 'Médico'}
                    detail={cita.medico?.especialidad || 'Medicina General'}
                    avatar={resolveAvatarSource(cita.medico?.fotoUrl)}
                  />
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="history" size={32} color={colors.muted} />
                  <Text style={styles.emptyText}>Sin historial reciente</Text>
                </View>
              )}
            </View>
          </View>

        </ScrollView>
      </View>
    </View>
  );
};

export default DashboardPacienteScreen;
