/**
 * MedicoConsultaVirtualScreen
 *
 * Dashboard de consultas virtuales para el médico.
 * Muestra la lista de citas virtuales activas y permite unirse
 * a la videollamada con un solo clic.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '../../navigation/types';
import { usePortalAwareMedicoNavigation } from '../../navigation/usePortalAwareMedicoNavigation';
import { useMedicoModule } from '../../navigation/MedicoModuleContext';
import { apiClient } from '../../utils/api';
import { useResponsive } from '../../hooks/useResponsive';
import MedicoHeader from '../../components/MedicoHeader';

const DefaultAvatar = require('../../assets/imagenes/avatar-default.jpg');

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  green: '#22c55e',
  red: '#ef4444',
  muted: '#4A7FA7',
  white: '#FFFFFF',
  orange: '#f59e0b',
};

type VirtualCita = {
  citaid: string;
  fechaHoraInicio: string | null;
  estado: string;
  modalidad: string;
  duracionMin?: number;
  paciente: {
    pacienteid: string;
    nombreCompleto: string;
    fotoUrl?: string;
  };
};

const resolveAvatarSource = (value: unknown): ImageSourcePropType => {
  const clean = String(value || '').trim();
  if (clean && !clean.toLowerCase().startsWith('blob:')) return { uri: clean };
  return DefaultAvatar;
};

const formatDateTime = (value: string | null) => {
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

const formatRelative = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= -5) return 'En curso';
  if (diffMin <= 0) return 'Inicia ahora';
  if (diffMin < 60) return `en ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `en ${diffHour}h`;
  return `en ${Math.round(diffHour / 24)} día(s)`;
};

const isNowOrSoon = (value: string | null, windowMinutes = 10): boolean => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const diffMs = date.getTime() - Date.now();
  const diffMin = diffMs / 60000;
  // Window: from 10 min before to 40 min after start
  return diffMin <= windowMinutes && diffMin >= -40;
};

const MedicoConsultaVirtualScreen: React.FC = () => {
  const navigation = usePortalAwareMedicoNavigation();
  const { isInsidePortal } = useMedicoModule();
  const { fs, rs, isDesktop } = useResponsive();

  const [citas, setCitas] = useState<VirtualCita[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningCitaId, setJoiningCitaId] = useState('');

  const loadCitas = useCallback(async () => {
    try {
      const payload = await apiClient.get<any>('/api/agenda/me/citas', {
        authenticated: true,
        query: { scope: 'upcoming', limit: 50 },
      });
      if (!(payload?.success && Array.isArray(payload?.citas))) {
        setCitas([]);
        return;
      }

      const mapped = (payload.citas as any[])
        .filter((item) =>
          ['pendiente', 'confirmada', 'reprogramada'].includes(
            String(item?.estadoCodigo || '').toLowerCase()
          )
        )
        .map((item) => ({
          citaid: String(item?.citaid || ''),
          fechaHoraInicio: item?.fechaHoraInicio || null,
          estado: String(item?.estado || 'Pendiente'),
          modalidad: String(item?.modalidad || 'virtual'),
          duracionMin: Number(item?.duracionMin || 30),
          paciente: {
            pacienteid: String(item?.paciente?.pacienteid || ''),
            nombreCompleto: String(item?.paciente?.nombreCompleto || 'Paciente'),
            fotoUrl: item?.paciente?.fotoUrl || '',
          },
        }))
        .sort((a, b) => {
          const aMs = a.fechaHoraInicio ? new Date(a.fechaHoraInicio).getTime() : Infinity;
          const bMs = b.fechaHoraInicio ? new Date(b.fechaHoraInicio).getTime() : Infinity;
          return aMs - bMs;
        });

      setCitas(mapped);
    } catch {
      setCitas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCitas();
    }, [loadCitas])
  );

  // Auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(() => loadCitas(), 30000);
    return () => clearInterval(timer);
  }, [loadCitas]);

  const handleJoinCall = (citaId: string) => {
    setJoiningCitaId(citaId);
    navigation.navigate('VideoCall', { citaId, initiate: true });
    setTimeout(() => setJoiningCitaId(''), 3000);
  };

  const activeCitas = useMemo(
    () => citas.filter((c) => isNowOrSoon(c.fechaHoraInicio, 10)),
    [citas]
  );

  const upcomingCitas = useMemo(
    () => citas.filter((c) => !isNowOrSoon(c.fechaHoraInicio, 10)),
    [citas]
  );

  const styles = useMemo(() => StyleSheet.create({
    main: { flex: 1, paddingHorizontal: rs(20), paddingTop: rs(18) },
    subtitle: {
      fontSize: fs(13),
      color: colors.muted,
      marginTop: rs(4),
      marginBottom: rs(16),
      fontWeight: '600',
    },
    
    // Active call banner
    activeBanner: {
      backgroundColor: '#fff',
      borderRadius: rs(20),
      padding: rs(20),
      marginBottom: rs(16),
      borderLeftWidth: 4,
      borderLeftColor: colors.green,
      shadowColor: colors.dark,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    activeBannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(8),
      marginBottom: rs(12),
    },
    activeDot: {
      width: rs(10),
      height: rs(10),
      borderRadius: rs(10),
      backgroundColor: colors.green,
    },
    activeBannerTitle: {
      fontSize: fs(12),
      fontWeight: '900',
      color: colors.green,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    activeCitaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(14),
      backgroundColor: '#f0faf0',
      borderRadius: rs(16),
      padding: rs(14),
      marginBottom: rs(10),
    },
    activeCitaAvatar: {
      width: rs(52),
      height: rs(52),
      borderRadius: rs(16),
      borderWidth: 2,
      borderColor: colors.green,
    },
    activeCitaInfo: { flex: 1 },
    activeCitaName: {
      fontSize: fs(15),
      fontWeight: '800',
      color: colors.dark,
    },
    activeCitaTime: {
      fontSize: fs(12),
      color: colors.muted,
      fontWeight: '600',
      marginTop: rs(2),
    },
    activeCitaStatus: {
      fontSize: fs(11),
      color: colors.green,
      fontWeight: '800',
      marginTop: rs(4),
    },
    joinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rs(8),
      backgroundColor: colors.green,
      paddingVertical: rs(12),
      paddingHorizontal: rs(20),
      borderRadius: rs(14),
      shadowColor: colors.green,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    joinBtnDisabled: { opacity: 0.6 },
    joinBtnText: {
      color: '#fff',
      fontSize: fs(14),
      fontWeight: '900',
    },
    
    // Section
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rs(12),
      marginTop: rs(8),
    },
    sectionTitle: {
      fontSize: fs(16),
      fontWeight: '900',
      color: colors.dark,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
      paddingHorizontal: rs(12),
      paddingVertical: rs(6),
      borderRadius: rs(10),
      backgroundColor: '#f1f5f9',
    },
    refreshText: {
      fontSize: fs(12),
      fontWeight: '700',
      color: colors.muted,
    },
    
    // Cita card
    citaCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(14),
      backgroundColor: '#fff',
      padding: rs(16),
      borderRadius: rs(18),
      marginBottom: rs(10),
      shadowColor: colors.dark,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    citaAvatar: {
      width: rs(48),
      height: rs(48),
      borderRadius: rs(14),
    },
    citaInfo: { flex: 1 },
    citaName: {
      fontSize: fs(14),
      fontWeight: '800',
      color: colors.dark,
    },
    citaDetail: {
      fontSize: fs(12),
      color: colors.muted,
      fontWeight: '600',
      marginTop: rs(2),
    },
    citaRelative: {
      fontSize: fs(11),
      color: colors.primary,
      fontWeight: '700',
      marginTop: rs(4),
    },
    citaActions: {
      flexDirection: 'row',
      gap: rs(8),
    },
    smallBtnBlue: {
      backgroundColor: 'rgba(19,127,236,0.12)',
      paddingVertical: rs(8),
      paddingHorizontal: rs(14),
      borderRadius: rs(12),
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
    },
    smallBtnBlueText: {
      color: colors.primary,
      fontWeight: '900',
      fontSize: fs(12),
    },
    
    // Empty state
    emptyCard: {
      alignItems: 'center',
      padding: rs(40),
      backgroundColor: '#fff',
      borderRadius: rs(20),
      borderWidth: 1,
      borderColor: '#eef2f7',
      borderStyle: 'dashed',
    },
    emptyIcon: {
      width: rs(64),
      height: rs(64),
      borderRadius: rs(20),
      backgroundColor: '#f1f5f9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: rs(16),
    },
    emptyTitle: {
      color: colors.dark,
      fontWeight: '800',
      fontSize: fs(15),
      textAlign: 'center',
    },
    emptyText: {
      color: colors.muted,
      fontWeight: '600',
      marginTop: rs(8),
      fontSize: fs(13),
      textAlign: 'center',
      maxWidth: 300,
    },

    // Loading skeleton
    skeleton: {
      backgroundColor: '#e8eff5',
      borderRadius: rs(18),
      height: rs(80),
      marginBottom: rs(10),
    },
    skeletonShimmer: {
      opacity: 0.5,
    },

    // Tip card
    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rs(12),
      backgroundColor: '#fffbeb',
      borderRadius: rs(16),
      padding: rs(16),
      marginTop: rs(16),
      borderWidth: 1,
      borderColor: '#fef3c7',
    },
    tipText: {
      flex: 1,
      fontSize: fs(12),
      color: '#92400e',
      fontWeight: '600',
      lineHeight: fs(18),
    },
  }), [fs, rs]);

  const renderSkeleton = () => (
    <View>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.skeleton, styles.skeletonShimmer]} />
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 40 }}>
        <MedicoHeader title="Consulta Virtual" />
        <Text style={styles.subtitle}>
          Gestiona tus videollamadas y únete a consultas virtuales con tus pacientes.
        </Text>

        {/* Active / In-progress calls */}
        {activeCitas.length > 0 && (
          <View style={styles.activeBanner}>
            <View style={styles.activeBannerHeader}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBannerTitle}>
                {activeCitas.length === 1 ? 'Llamada disponible' : `${activeCitas.length} llamadas disponibles`}
              </Text>
            </View>

            {activeCitas.map((cita) => (
              <View key={cita.citaid}>
                <View style={styles.activeCitaRow}>
                  <Image source={resolveAvatarSource(cita.paciente.fotoUrl)} style={styles.activeCitaAvatar} />
                  <View style={styles.activeCitaInfo}>
                    <Text style={styles.activeCitaName}>{cita.paciente.nombreCompleto}</Text>
                    <Text style={styles.activeCitaTime}>{formatDateTime(cita.fechaHoraInicio)}</Text>
                    <Text style={styles.activeCitaStatus}>● {formatRelative(cita.fechaHoraInicio)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.joinBtn, joiningCitaId === cita.citaid && styles.joinBtnDisabled]}
                  onPress={() => handleJoinCall(cita.citaid)}
                  disabled={!!joiningCitaId}
                >
                  {joiningCitaId === cita.citaid ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialIcons name="videocam" size={20} color="#fff" />
                  )}
                  <Text style={styles.joinBtnText}>
                    {joiningCitaId === cita.citaid ? 'Conectando...' : 'Unirse a videollamada'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Upcoming virtual appointments */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Próximas consultas virtuales</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { setLoading(true); loadCitas(); }}>
            <MaterialIcons name="refresh" size={16} color={colors.muted} />
            <Text style={styles.refreshText}>Actualizar</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          renderSkeleton()
        ) : upcomingCitas.length > 0 ? (
          upcomingCitas.map((cita) => (
            <View key={cita.citaid} style={styles.citaCard}>
              <Image source={resolveAvatarSource(cita.paciente.fotoUrl)} style={styles.citaAvatar} />
              <View style={styles.citaInfo}>
                <Text style={styles.citaName}>{cita.paciente.nombreCompleto}</Text>
                <Text style={styles.citaDetail}>{formatDateTime(cita.fechaHoraInicio)}</Text>
                <Text style={styles.citaRelative}>{formatRelative(cita.fechaHoraInicio)}</Text>
              </View>
              <View style={styles.citaActions}>
                <TouchableOpacity
                  style={styles.smallBtnBlue}
                  onPress={() => handleJoinCall(cita.citaid)}
                  disabled={!!joiningCitaId}
                >
                  <MaterialIcons name="videocam" size={16} color={colors.primary} />
                  <Text style={styles.smallBtnBlueText}>Iniciar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : activeCitas.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="video-off-outline" size={30} color={colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>Sin consultas virtuales</Text>
            <Text style={styles.emptyText}>
              No tienes citas de videollamada programadas. Las citas virtuales aparecerán aquí automáticamente.
            </Text>
          </View>
        ) : null}

        {/* Tip card */}
        <View style={styles.tipCard}>
          <MaterialIcons name="lightbulb-outline" size={20} color="#f59e0b" />
          <Text style={styles.tipText}>
            Las videollamadas se activan 5 minutos antes de la hora programada. 
            Asegúrate de tener cámara y micrófono habilitados antes de unirte.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default MedicoConsultaVirtualScreen;
