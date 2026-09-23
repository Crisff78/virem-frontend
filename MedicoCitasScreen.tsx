import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useResponsive } from './hooks/useResponsive';
import type { ImageSourcePropType } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePortalAwareMedicoNavigation } from './navigation/usePortalAwareMedicoNavigation';
import { useMedicoModule } from './navigation/MedicoModuleContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';
import MedicoHeader from './components/MedicoHeader';
import { useMedicoPortalSession } from './hooks/useMedicoPortalSession';
import { useSocketEvent } from './hooks/useSocketEvent';
import { apiClient } from './utils/api';
import { getApiErrorMessage, isAuthError } from './utils/apiErrors';
import { resolveRemoteImageSource } from './utils/imageSources';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  light: '#B3CFE5',
  white: '#FFFFFF',
};

type CitaItem = {
  citaid: string;
  fechaHoraInicio: string | null;
  fechaHoraFin: string | null;
  duracionMin: number;
  nota: string;
  precio: number | null;
  estado: string;
  estadoCodigo?: string;
  modalidad?: string;
  conversacionId?: string | null;
  paciente?: {
    pacienteid?: string;
    nombreCompleto?: string;
  };
  montoTotal?: number;
  montoPlataforma?: number;
  montoMedico?: number;
  comisionAplicada?: number;
};

type SideItem = {
  icon: string;
  label: string;
  route?: 'DashboardMedico' | 'MedicoCitas' | 'MedicoPacientes' | 'MedicoChat' | 'MedicoPerfil' | 'MedicoConfiguracion';
  active?: boolean;
  badge?: { text: string; color: string };
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

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

const MIN_REFRESH_INTERVAL_MS = 12000;

const formatPrice = (value: number | null | undefined) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(n);
};

const MedicoCitasScreen: React.FC = () => {
  const navigation = usePortalAwareMedicoNavigation();
  const { isInsidePortal, isSidebarOpen, toggleSidebar, activeModuleParams } = useMedicoModule();
  const { loadingUser, refreshUser, signOut, doctorName, doctorSpec, fotoUrl } =
    useMedicoPortalSession({ syncOnMount: false, addDoctorPrefix: true });
  const { isDesktop, isTablet, isMobile, rs, select } = useResponsive();
  const isDesktopLayout = isDesktop;
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [workingCitaId, setWorkingCitaId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [citas, setCitas] = useState<CitaItem[]>([]);
  const lastRefreshRef = React.useRef(0);

  const handleAuthExpired = useCallback(
    async (message = 'Inicia sesion nuevamente.') => {
      Alert.alert('Sesion expirada', message);
      await signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    },
    [navigation, signOut]
  );

  const loadCitas = useCallback(async () => {
    setLoadingCitas(true);
    try {
      const payload = await apiClient.get<any>('/api/agenda/me/citas', {
        authenticated: true,
        query: { scope: 'all', limit: 160 },
      });
      if (payload?.success && Array.isArray(payload?.citas)) {
        setCitas(payload.citas as CitaItem[]);
      } else {
        setCitas([]);
      }
    } catch (error) {
      if (isAuthError(error)) {
        await handleAuthExpired();
        return;
      }
      setCitas([]);
    } finally {
      setLoadingCitas(false);
    }
  }, [handleAuthExpired]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshRef.current = now;
      refreshUser().catch(() => undefined);
      loadCitas();
    }, [loadCitas, refreshUser])
  );

  const highlightCitaId = activeModuleParams?.highlightCitaId;

  const upsertCita = useCallback((nextCita: CitaItem) => {
    if (!nextCita?.citaid) return;
    setCitas((prev) => {
      const idx = prev.findIndex((item) => item.citaid === nextCita.citaid);
      if (idx === -1) return [nextCita, ...prev];
      const next = [...prev];
      next[idx] = { ...prev[idx], ...nextCita };
      return next;
    });
  }, []);

  const handleRealtimeCitaEvent = useCallback(
    (payload: any) => {
      const citaPayload = payload?.cita as CitaItem | undefined;
      if (citaPayload?.citaid) {
        upsertCita(citaPayload);
        return;
      }
      loadCitas();
    },
    [loadCitas, upsertCita]
  );

  useSocketEvent('cita_creada', handleRealtimeCitaEvent);
  useSocketEvent('cita_actualizada', handleRealtimeCitaEvent);
  useSocketEvent('cita_cancelada', handleRealtimeCitaEvent);
  useSocketEvent('cita_reprogramada', handleRealtimeCitaEvent);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    return resolveRemoteImageSource(fotoUrl, DefaultAvatar);
  }, [fotoUrl]);

  const filteredCitas = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();
    if (!q) return citas;
    return citas.filter((item) => {
      const patient = normalizeText(item?.paciente?.nombreCompleto).toLowerCase();
      const estado = normalizeText(item?.estado).toLowerCase();
      const nota = normalizeText(item?.nota).toLowerCase();
      const modalidad = normalizeText(item?.modalidad).toLowerCase();
      return patient.includes(q) || estado.includes(q) || nota.includes(q) || modalidad.includes(q);
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

  const stats = useMemo(() => {
    let totalEarnings = 0;
    let platformFees = 0;
    let netProfit = 0;
    
    filteredCitas.forEach(cita => {
      if (cita.estadoCodigo === 'completada' || cita.estadoCodigo === 'confirmada' || cita.estadoCodigo === 'pendiente') {
        totalEarnings += (cita.montoTotal || 0);
        platformFees += (cita.montoPlataforma || 0);
        netProfit += (cita.montoMedico || 0);
      }
    });

    return { totalEarnings, platformFees, netProfit };
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
        let endpoint = '';
        let body: Record<string, unknown> = {};
        if (action === 'reschedule') {
          const currentStart = cita?.fechaHoraInicio ? new Date(cita.fechaHoraInicio) : new Date();
          const nextStart = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000);
          endpoint = `/api/agenda/me/citas/${cita.citaid}/reprogramar`;
          body = {
            fechaHoraInicio: nextStart.toISOString(),
            motivo: 'Reprogramada desde panel medico',
          };
        } else if (action === 'complete') {
          endpoint = `/api/agenda/me/citas/${cita.citaid}/estado`;
          body = {
            estado: 'completada',
            motivo: 'Marcada como completada por medico',
          };
        } else {
          endpoint = `/api/agenda/me/citas/${cita.citaid}/cancelar`;
          body = {
            motivo: 'Cancelada desde panel medico',
          };
        }

        const payload = await apiClient.patch<any>(endpoint, {
          authenticated: true,
          body,
        });
        if (!payload?.success) {
          Alert.alert('No se pudo actualizar', payload?.message || 'Ocurrio un error.');
          return;
        }

        if (payload?.cita) {
          upsertCita(payload.cita as CitaItem);
        } else {
          await loadCitas();
        }
      } catch (error) {
        if (isAuthError(error)) {
          await handleAuthExpired();
          return;
        }
        Alert.alert('Error', getApiErrorMessage(error, 'No se pudo completar la accion.'));
      } finally {
        setWorkingCitaId('');
      }
    },
    [handleAuthExpired, loadCitas, upsertCita]
  );

  const openVideoSala = useCallback((cita: CitaItem) => {
    /*
    if (normalizeText(cita?.modalidad).toLowerCase() !== 'virtual') {
      Alert.alert('Consulta presencial', 'Esta cita no tiene videollamada habilitada.');
      return;
    }
    */

    navigation.navigate('VideoCall', {
      citaId: cita.citaid,
      initiate: true
    });
  }, [navigation]);

  const showDetails = (cita: CitaItem) => {
    Alert.alert(
      'Detalle de cita',
      `Paciente: ${normalizeText(cita?.paciente?.nombreCompleto || 'Paciente')}\nEstado: ${normalizeText(
        cita?.estado || 'Pendiente'
      )}\nModalidad: ${normalizeText(cita?.modalidad || 'presencial')}\nHora: ${formatDateTime(
        cita?.fechaHoraInicio
      )}\nNota: ${normalizeText(cita?.nota || 'Sin nota')}`
    );
  };

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const sideItems: SideItem[] = [
    { icon: 'dashboard', label: 'Dashboard', route: 'DashboardMedico' },
    { icon: 'calendar-today', label: 'Agenda', route: 'MedicoCitas', active: true },
    { icon: 'group', label: 'Pacientes', route: 'MedicoPacientes' },
    { icon: 'notification-important', label: 'Solicitudes', badge: { text: '5', color: '#ef4444' } },
    { icon: 'chat-bubble', label: 'Mensajes', route: 'MedicoChat', badge: { text: '3', color: colors.primary } },
    { icon: 'person', label: 'Perfil', route: 'MedicoPerfil' },
    { icon: 'settings', label: 'Configuracion', route: 'MedicoConfiguracion' },
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
    <View style={{ flex: 1 }}>
        <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
          <MedicoHeader title="Mi Agenda" />

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

        <View style={[styles.statsRow, (isTablet || isMobile) && { flexWrap: 'wrap' }]}>
          <View style={[styles.statCard, { borderLeftColor: colors.primary }, (isTablet || isMobile) && { width: '48%', minWidth: 150 }]}>
            <Text style={styles.statLabel}>Ingresos Totales</Text>
            <Text style={styles.statValue}>{formatPrice(stats.totalEarnings)}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#ef4444' }, (isTablet || isMobile) && { width: '48%', minWidth: 150 }]}>
            <Text style={styles.statLabel}>Comisión VIREM</Text>
            <Text style={styles.statValue}>{formatPrice(stats.platformFees)}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#10b981' }, (isTablet || isMobile) && { width: '100%', marginTop: isMobile ? 10 : 0 }]}>
            <Text style={styles.statLabel}>Ganancia Neta</Text>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{formatPrice(stats.netProfit)}</Text>
          </View>
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
              <View 
                key={cita.citaid} 
                style={[
                  styles.citaCard, 
                  highlightCitaId === cita.citaid && { borderColor: colors.primary, borderWidth: 2, backgroundColor: 'rgba(19,127,236,0.02)' }
                ]}
              >
                <View style={[styles.citaTop, (isTablet || isMobile) && styles.citaTopMobile]}>
                  <View style={styles.citaMeta}>
                    <Text style={styles.citaPatient}>{normalizeText(cita?.paciente?.nombreCompleto || 'Paciente')}</Text>
                    <Text style={styles.citaSub}>
                      {normalizeText(cita?.estado || 'Pendiente')} · {formatDateTime(cita?.fechaHoraInicio)} ·{' '}
                      {normalizeText(cita?.modalidad || 'presencial')}
                    </Text>
                    <Text style={styles.citaNote}>
                      {normalizeText(cita?.nota || 'Consulta programada sin nota adicional.')}
                    </Text>
                    {Number(cita.montoTotal) > 0 && (
                      <View style={styles.financeRow}>
                        <View style={styles.financeItem}>
                          <Text style={styles.financeLabel}>Precio</Text>
                          <Text style={styles.financeValue}>{formatPrice(cita.montoTotal)}</Text>
                        </View>
                        <View style={styles.financeItem}>
                          <Text style={styles.financeLabel}>Tu Ganancia</Text>
                          <Text style={[styles.financeValue, { color: '#10b981' }]}>{formatPrice(cita.montoMedico)}</Text>
                        </View>
                        <View style={styles.financeItem}>
                          <Text style={styles.financeLabel}>Comisión</Text>
                          <Text style={[styles.financeValue, { color: '#ef4444' }]}>{formatPrice(cita.montoPlataforma)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.primaryAction,
                      (workingCitaId === cita.citaid) &&
                        styles.secondaryActionDisabled,
                    ]}
                    onPress={() => openVideoSala(cita)}
                    disabled={workingCitaId === cita.citaid}
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

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() =>
                      navigation.navigate('MedicoPacienteDetalle', {
                        patientId: String(cita?.paciente?.pacienteid || ''),
                        patientName: normalizeText(cita?.paciente?.nombreCompleto || 'Paciente'),
                      })
                    }
                  >
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
                <TouchableOpacity
                  style={[styles.smallAction, { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)' }]}
                  onPress={() =>
                    navigation.navigate('MedicoRecetas', {
                      prefill: {
                        pacienteId: String(cita?.paciente?.pacienteid || ''),
                        pacienteNombre: normalizeText(cita?.paciente?.nombreCompleto || 'Paciente'),
                        citaId: cita.citaid,
                      },
                    })
                  }
                >
                  <Text style={[styles.smallActionText, { color: '#15803d' }]}>Crear Receta</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallAction}
                  onPress={() =>
                    navigation.navigate('MedicoPacienteDetalle', {
                      patientId: String(cita?.paciente?.pacienteid || ''),
                      patientName: normalizeText(cita?.paciente?.nombreCompleto || 'Paciente'),
                    })
                  }
                >
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
  containerMobile: {
    flexDirection: 'column',
  },
  containerTablet: {
    flexDirection: 'row',
  },
  sidebar: {
    backgroundColor: colors.white,
    borderRightColor: '#eef2f7',
    borderBottomColor: '#eef2f7',
    padding: 20,
    justifyContent: 'space-between',
  },
  sidebarDesktop: {
    width: 280,
    borderRightWidth: 1,
    borderBottomWidth: 0,
  },
  sidebarTablet: {
    width: 80,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 8,
  },
  sidebarMobile: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    padding: 14,
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44 },
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
  menuMobile: { flexDirection: 'row', flexWrap: 'wrap' },
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
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  main: { flex: 1, paddingHorizontal: 20 },
  headerWrap: {
    paddingTop: Platform.OS === 'web' ? 32 : 14,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start',
    gap: 12,
  },
  headerRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start' },
  headerRightMobile: { alignItems: 'flex-start' },
  headerDate: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  headerTime: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pageTitle: { color: colors.dark, fontSize: 30, fontWeight: '900' },
  pageSubtitle: { color: colors.muted, fontSize: 16, marginTop: 4, fontWeight: '500' },
  searchWrap: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d6e4f3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  searchInput: { flex: 1, color: colors.dark, fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  sectionHead: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: colors.dark, fontSize: 20, fontWeight: '900' },
  sectionCount: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4edf7',
    padding: 12,
    gap: 10,
    marginBottom: 24,
  },
  citaCard: {
    borderWidth: 1,
    borderColor: '#e8eff8',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  citaTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  citaTopMobile: { alignItems: 'flex-start' },
  citaMeta: { flex: 1 },
  citaPatient: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  citaSub: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 1 },
  citaNote: { color: colors.muted, fontSize: 12, marginTop: 4, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  secondaryActionDisabled: {
    opacity: 0.55,
  },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  secondaryAction: {
    borderWidth: 1,
    borderColor: '#d6e2f0',
    backgroundColor: '#f6f9fd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryActionText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  historyRow: {
    borderWidth: 1,
    borderColor: '#e8eff8',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyName: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  historySub: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  smallAction: {
    borderWidth: 1,
    borderColor: '#d8e5f3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f7fafe',
  },
  smallActionText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700', paddingVertical: 12 },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.dark,
    marginTop: 4,
  },
  financeRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 24,
    flexWrap: 'wrap',
  },
  financeItem: {
    minWidth: 80,
  },
  financeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  financeValue: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.dark,
    marginTop: 2,
  },
});

export default MedicoCitasScreen;
