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
import type { ImageSourcePropType } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePortalAwareMedicoNavigation } from './navigation/usePortalAwareMedicoNavigation';
import { useMedicoModule } from './navigation/MedicoModuleContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';
import { useMedicoPortalSession } from './hooks/useMedicoPortalSession';
import { useSocketEvent } from './hooks/useSocketEvent';
import { apiClient } from './utils/api';
import { getApiErrorMessage, isAuthError } from './utils/apiErrors';
import { resolveRemoteImageSource, sanitizeRemoteImageUrl } from './utils/imageSources';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

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
};

type DisponibilidadItem = {
  id: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  modalidad: 'presencial' | 'virtual' | 'ambas';
  slotMinutos: number;
  activo: boolean;
  bloqueado: boolean;
  especialidad?: string;
  nota?: string;
};

type SideItem = {
  icon: string;
  label: string;
  route?: 'DashboardMedico' | 'MedicoCitas' | 'MedicoPacientes' | 'MedicoChat' | 'MedicoPerfil';
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

const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toHourMinute = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const MedicoCitasScreen: React.FC = () => {
  const navigation = usePortalAwareMedicoNavigation();
  const { isInsidePortal } = useMedicoModule();
  const { loadingUser, refreshUser, signOut, doctorName, doctorSpec, fotoUrl } =
    useMedicoPortalSession({ syncOnMount: false, addDoctorPrefix: true });
  const { width: viewportWidth } = useWindowDimensions();
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [loadingDisponibilidades, setLoadingDisponibilidades] = useState(false);
  const [savingDisponibilidad, setSavingDisponibilidad] = useState(false);
  const [workingCitaId, setWorkingCitaId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [citas, setCitas] = useState<CitaItem[]>([]);
  const [disponibilidades, setDisponibilidades] = useState<DisponibilidadItem[]>([]);
  const [editingDisponibilidadId, setEditingDisponibilidadId] = useState('');
  const [dispFecha, setDispFecha] = useState(() => toIsoDate(new Date()));
  const [dispHoraInicio, setDispHoraInicio] = useState('09:00');
  const [dispHoraFin, setDispHoraFin] = useState('12:00');
  const [dispModalidad, setDispModalidad] = useState<'presencial' | 'virtual' | 'ambas'>('ambas');
  const [dispSlotMinutos, setDispSlotMinutos] = useState<15 | 20 | 30 | 60>(30);
  const [dispBloqueado, setDispBloqueado] = useState(false);
  const lastRefreshRef = React.useRef(0);
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;

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

  const loadDisponibilidades = useCallback(async () => {
    setLoadingDisponibilidades(true);
    try {
      const now = new Date();
      const from = toIsoDate(now);
      const to = toIsoDate(new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000));
      const payload = await apiClient.get<any>('/api/agenda/medico/me/disponibilidades', {
        authenticated: true,
        query: { from, to },
      });
      if (!(payload?.success && Array.isArray(payload?.disponibilidades))) {
        setDisponibilidades([]);
        return;
      }

      const normalized = (payload.disponibilidades as any[])
        .map((item) => {
          const id = normalizeText(item?.id);
          if (!id) return null;
          const modalidadRaw = normalizeText(item?.modalidad).toLowerCase();
          const modalidad =
            modalidadRaw === 'virtual' || modalidadRaw === 'presencial' || modalidadRaw === 'ambas'
              ? (modalidadRaw as 'presencial' | 'virtual' | 'ambas')
              : 'ambas';
          const slotMin = Number(item?.slotMinutos || 30);
          return {
            id,
            fechaInicio: item?.fechaInicio || null,
            fechaFin: item?.fechaFin || null,
            modalidad,
            slotMinutos: Number.isFinite(slotMin) ? slotMin : 30,
            activo: Boolean(item?.activo),
            bloqueado: Boolean(item?.bloqueado),
            especialidad: normalizeText(item?.especialidad),
            nota: normalizeText(item?.nota),
          } as DisponibilidadItem;
        })
        .filter((item: DisponibilidadItem | null): item is DisponibilidadItem => Boolean(item))
        .sort((a, b) => parseDateMs(a.fechaInicio) - parseDateMs(b.fechaInicio));

      setDisponibilidades(normalized);
    } catch (error) {
      if (isAuthError(error)) {
        await handleAuthExpired();
        return;
      }
      setDisponibilidades([]);
    } finally {
      setLoadingDisponibilidades(false);
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
      loadDisponibilidades();
    }, [loadCitas, loadDisponibilidades, refreshUser])
  );

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

  const resetDisponibilidadForm = useCallback(() => {
    setEditingDisponibilidadId('');
    setDispFecha(toIsoDate(new Date()));
    setDispHoraInicio('09:00');
    setDispHoraFin('12:00');
    setDispModalidad('ambas');
    setDispSlotMinutos(30);
    setDispBloqueado(false);
  }, []);

  const startEditDisponibilidad = useCallback((item: DisponibilidadItem) => {
    setEditingDisponibilidadId(item.id);
    setDispFecha(toIsoDate(new Date(item.fechaInicio || Date.now())));
    setDispHoraInicio(toHourMinute(item.fechaInicio) || '09:00');
    setDispHoraFin(toHourMinute(item.fechaFin) || '12:00');
    setDispModalidad(item.modalidad || 'ambas');
    const nextSlot = Number(item.slotMinutos);
    if (nextSlot === 15 || nextSlot === 20 || nextSlot === 30 || nextSlot === 60) {
      setDispSlotMinutos(nextSlot);
    } else {
      setDispSlotMinutos(30);
    }
    setDispBloqueado(Boolean(item.bloqueado));
  }, []);

  const saveDisponibilidad = useCallback(async () => {
    if (!dispFecha || !/^\d{4}-\d{2}-\d{2}$/.test(dispFecha)) {
      Alert.alert('Fecha invalida', 'Usa formato YYYY-MM-DD.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(dispHoraInicio) || !/^\d{2}:\d{2}$/.test(dispHoraFin)) {
      Alert.alert('Hora invalida', 'Usa formato HH:mm para inicio y fin.');
      return;
    }

    setSavingDisponibilidad(true);
    try {
      const body = {
        fecha: dispFecha,
        horaInicio: dispHoraInicio,
        horaFin: dispHoraFin,
        modalidad: dispModalidad,
        slotMinutos: dispSlotMinutos,
        bloqueado: dispBloqueado,
        activo: true,
      };
      const endpoint = editingDisponibilidadId
        ? `/api/agenda/medico/me/disponibilidades/${editingDisponibilidadId}`
        : '/api/agenda/medico/me/disponibilidades';

      const responseBody = editingDisponibilidadId
        ? await apiClient.put<any>(endpoint, { authenticated: true, body })
        : await apiClient.post<any>(endpoint, { authenticated: true, body });

      if (!responseBody?.success) {
        Alert.alert(
          'No se pudo guardar',
          responseBody?.message || 'Revisa los datos e intenta nuevamente.'
        );
        return;
      }

      await loadDisponibilidades();
      resetDisponibilidadForm();
      Alert.alert('Disponibilidad guardada', 'El bloque horario se actualizo correctamente.');
    } catch (error) {
      if (isAuthError(error)) {
        await handleAuthExpired();
        return;
      }
      Alert.alert('Error', getApiErrorMessage(error, 'No se pudo guardar la disponibilidad.'));
    } finally {
      setSavingDisponibilidad(false);
    }
  }, [
    dispBloqueado,
    dispFecha,
    dispHoraFin,
    dispHoraInicio,
    dispModalidad,
    dispSlotMinutos,
    editingDisponibilidadId,
    handleAuthExpired,
    loadDisponibilidades,
    resetDisponibilidadForm,
  ]);

  const toggleBloqueoDisponibilidad = useCallback(
    async (item: DisponibilidadItem) => {
      setWorkingCitaId(`disp-block-${item.id}`);
      try {
        const payload = await apiClient.patch<any>(
          `/api/agenda/medico/me/disponibilidades/${item.id}/bloquear`,
          {
            authenticated: true,
            body: { bloqueado: !item.bloqueado },
          }
        );
        if (!payload?.success) {
          Alert.alert('No se pudo actualizar', payload?.message || 'Intenta nuevamente.');
          return;
        }

        setDisponibilidades((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, bloqueado: !row.bloqueado } : row))
        );
      } catch (error) {
        if (isAuthError(error)) {
          await handleAuthExpired();
          return;
        }
        Alert.alert('Error', getApiErrorMessage(error, 'No se pudo actualizar el bloqueo.'));
      } finally {
        setWorkingCitaId('');
      }
    },
    [handleAuthExpired]
  );

  const toggleActivoDisponibilidad = useCallback(
    async (item: DisponibilidadItem) => {
      setWorkingCitaId(`disp-active-${item.id}`);
      try {
        const payload = await apiClient.put<any>(`/api/agenda/medico/me/disponibilidades/${item.id}`, {
          authenticated: true,
          body: {
            activo: !item.activo,
          },
        });
        if (!payload?.success) {
          Alert.alert('No se pudo actualizar', payload?.message || 'Intenta nuevamente.');
          return;
        }

        setDisponibilidades((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, activo: !row.activo } : row))
        );
      } catch (error) {
        if (isAuthError(error)) {
          await handleAuthExpired();
          return;
        }
        Alert.alert('Error', getApiErrorMessage(error, 'No se pudo actualizar el estado.'));
      } finally {
        setWorkingCitaId('');
      }
    },
    [handleAuthExpired]
  );

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

  const openVideoSala = useCallback(async (cita: CitaItem) => {
    if (normalizeText(cita?.modalidad).toLowerCase() !== 'virtual') {
      Alert.alert('Consulta presencial', 'Esta cita no tiene videollamada habilitada.');
      return;
    }

    setWorkingCitaId(cita.citaid);
    try {
      const payload = await apiClient.post<any>(`/api/agenda/me/citas/${cita.citaid}/video-sala/abrir`, {
        authenticated: true,
      });
      if (!payload?.success || !payload?.videoSala?.joinUrl) {
        Alert.alert('No disponible', payload?.message || 'No se pudo abrir la videollamada.');
        return;
      }

      const joinUrl = String(payload.videoSala.joinUrl || '').trim();
      if (!joinUrl) {
        Alert.alert('No disponible', 'La sala aun no tiene URL de acceso.');
        return;
      }

      if (Platform.OS === 'web') {
        const webOpen = (globalThis as any)?.open;
        if (typeof webOpen === 'function') {
          const opened = webOpen(joinUrl, '_blank');
          if (opened) return;
        }
      }
      await Linking.openURL(joinUrl);
    } catch (error) {
      if (isAuthError(error)) {
        await handleAuthExpired();
        return;
      }
      Alert.alert('Error', getApiErrorMessage(error, 'No se pudo abrir la videollamada.'));
    } finally {
      setWorkingCitaId('');
    }
  }, [handleAuthExpired]);

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
    <View style={[styles.container, isInsidePortal ? null : (!isDesktopLayout && styles.containerMobile)]}>
      {!isInsidePortal && (
      <View style={[styles.sidebar, !isDesktopLayout && styles.sidebarMobile]}>
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

          <View style={[styles.menu, !isDesktopLayout && styles.menuMobile]}>
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
      )}

      <ScrollView
        style={styles.main}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View style={styles.headerWrap}>
          <View style={[styles.headerRow, !isDesktopLayout && styles.headerRowMobile]}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Agenda Medica</Text>
              <Text style={styles.pageSubtitle}>Administra tus citas y acciones de seguimiento.</Text>
            </View>
            <View style={[styles.headerRight, !isDesktopLayout && styles.headerRightMobile]}>
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
          <Text style={styles.sectionTitle}>Disponibilidad</Text>
          <Text style={styles.sectionCount}>{disponibilidades.length}</Text>
        </View>
        <View style={styles.sectionCard}>
          <View style={[styles.availabilityFormGrid, !isDesktopLayout && styles.availabilityFormGridMobile]}>
            <View style={styles.availabilityField}>
              <Text style={styles.availabilityLabel}>Fecha (YYYY-MM-DD)</Text>
              <TextInput
                value={dispFecha}
                onChangeText={setDispFecha}
                style={styles.availabilityInput}
                placeholder="2026-03-20"
                placeholderTextColor="#8ca7bd"
              />
            </View>
            <View style={styles.availabilityField}>
              <Text style={styles.availabilityLabel}>Hora inicio</Text>
              <TextInput
                value={dispHoraInicio}
                onChangeText={setDispHoraInicio}
                style={styles.availabilityInput}
                placeholder="09:00"
                placeholderTextColor="#8ca7bd"
              />
            </View>
            <View style={styles.availabilityField}>
              <Text style={styles.availabilityLabel}>Hora fin</Text>
              <TextInput
                value={dispHoraFin}
                onChangeText={setDispHoraFin}
                style={styles.availabilityInput}
                placeholder="12:00"
                placeholderTextColor="#8ca7bd"
              />
            </View>
          </View>

          <Text style={styles.availabilityLabel}>Modalidad del bloque</Text>
          <View style={styles.actionsRow}>
            {(['ambas', 'virtual', 'presencial'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.secondaryAction,
                  dispModalidad === mode && styles.availabilityModeActive,
                ]}
                onPress={() => setDispModalidad(mode)}
              >
                <Text
                  style={[
                    styles.secondaryActionText,
                    dispModalidad === mode && styles.availabilityModeActiveText,
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.availabilityLabel}>Duracion por slot</Text>
          <View style={styles.actionsRow}>
            {([15, 20, 30, 60] as const).map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.secondaryAction,
                  dispSlotMinutos === minutes && styles.availabilityModeActive,
                ]}
                onPress={() => setDispSlotMinutos(minutes)}
              >
                <Text
                  style={[
                    styles.secondaryActionText,
                    dispSlotMinutos === minutes && styles.availabilityModeActiveText,
                  ]}
                >
                  {minutes} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.secondaryAction, dispBloqueado && styles.availabilityModeActive]}
              onPress={() => setDispBloqueado((prev) => !prev)}
            >
              <Text
                style={[
                  styles.secondaryActionText,
                  dispBloqueado && styles.availabilityModeActiveText,
                ]}
              >
                {dispBloqueado ? 'Bloqueado' : 'Disponible'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryAction, savingDisponibilidad && styles.secondaryActionDisabled]}
              onPress={saveDisponibilidad}
              disabled={savingDisponibilidad}
            >
              {savingDisponibilidad ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={16} color="#fff" />
                  <Text style={styles.primaryActionText}>
                    {editingDisponibilidadId ? 'Actualizar bloque' : 'Crear bloque'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {editingDisponibilidadId ? (
              <TouchableOpacity style={styles.secondaryAction} onPress={resetDisponibilidadForm}>
                <Text style={styles.secondaryActionText}>Cancelar edicion</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {loadingDisponibilidades ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : disponibilidades.length ? (
            disponibilidades.slice(0, 40).map((item) => (
              <View
                key={`disp-${item.id}`}
                style={[styles.availabilityRow, !isDesktopLayout && styles.availabilityRowMobile]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>
                    {formatDateTime(item.fechaInicio)} - {formatDateTime(item.fechaFin)}
                  </Text>
                  <Text style={styles.historySub}>
                    {normalizeText(item.especialidad || doctorSpec)} · {item.modalidad} · {item.slotMinutos} min
                  </Text>
                  <Text style={styles.historySub}>
                    {item.activo ? 'Activo' : 'Inactivo'} · {item.bloqueado ? 'Bloqueado' : 'Disponible'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.smallAction} onPress={() => startEditDisponibilidad(item)}>
                  <Text style={styles.smallActionText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallAction}
                  disabled={workingCitaId === `disp-block-${item.id}`}
                  onPress={() => toggleBloqueoDisponibilidad(item)}
                >
                  <Text style={styles.smallActionText}>
                    {item.bloqueado ? 'Desbloquear' : 'Bloquear'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallAction}
                  disabled={workingCitaId === `disp-active-${item.id}`}
                  onPress={() => toggleActivoDisponibilidad(item)}
                >
                  <Text style={styles.smallActionText}>{item.activo ? 'Desactivar' : 'Activar'}</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Aun no has configurado bloques de disponibilidad.</Text>
          )}
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
                  <View style={[styles.citaTop, !isDesktopLayout && styles.citaTopMobile]}>
                  <View style={styles.citaMeta}>
                    <Text style={styles.citaPatient}>{normalizeText(cita?.paciente?.nombreCompleto || 'Paciente')}</Text>
                    <Text style={styles.citaSub}>
                      {normalizeText(cita?.estado || 'Pendiente')} · {formatDateTime(cita?.fechaHoraInicio)} ·{' '}
                      {normalizeText(cita?.modalidad || 'presencial')}
                    </Text>
                    <Text style={styles.citaNote}>
                      {normalizeText(cita?.nota || 'Consulta programada sin nota adicional.')}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.primaryAction,
                      (normalizeText(cita?.modalidad).toLowerCase() !== 'virtual' ||
                        workingCitaId === cita.citaid) &&
                        styles.secondaryActionDisabled,
                    ]}
                    onPress={() => openVideoSala(cita)}
                    disabled={
                      normalizeText(cita?.modalidad).toLowerCase() !== 'virtual' ||
                      workingCitaId === cita.citaid
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
  containerMobile: {
    flexDirection: 'column',
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
  sidebarMobile: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    padding: 14,
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
  availabilityFormGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 8,
    flexWrap: 'wrap',
  },
  availabilityFormGridMobile: {
    flexDirection: 'column',
  },
  availabilityField: {
    flex: Platform.OS === 'web' ? 1 : 0,
    minWidth: Platform.OS === 'web' ? 180 : 0,
  },
  availabilityLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 4,
  },
  availabilityInput: {
    borderWidth: 1,
    borderColor: '#d6e4f3',
    backgroundColor: '#f9fbff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.dark,
    fontWeight: '700',
    fontSize: 13,
  },
  availabilityModeActive: {
    backgroundColor: 'rgba(19,127,236,0.14)',
    borderColor: colors.primary,
  },
  availabilityModeActiveText: {
    color: colors.primary,
  },
  availabilityRow: {
    borderWidth: 1,
    borderColor: '#e8eff8',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availabilityRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
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
  citaTopMobile: { alignItems: 'flex-start' },
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
  secondaryActionDisabled: {
    opacity: 0.55,
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

