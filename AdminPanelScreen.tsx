import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import type { RootStackParamList } from './navigation/types';
import { apiUrl } from './config/backend';

const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AdminPanel'>;

type PendingMedico = {
  usuarioid: number;
  email: string;
  estadoCuenta: string;
  fechaRegistro: string | null;
  medico: {
    nombreCompleto: string;
    especialidad: string;
    cedula: string;
    telefono: string;
  };
  documentos: Array<{
    tipo: string;
    archivoUrl: string;
    estadoRevision: string;
  }>;
};

type PendingReview = {
  valoracionId: number;
  citaId: string;
  pacienteNombre: string;
  medicoNombre: string;
  puntaje: number;
  comentario: string;
};

type PanelStats = {
  usuarios?: Record<string, unknown>;
  citas?: Record<string, unknown>;
  pagos?: Record<string, unknown>;
  valoraciones?: Record<string, unknown>;
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

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
    if (secureToken?.trim()) return secureToken.trim();

    const asyncToken =
      (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
      (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    return String(asyncToken || '').trim();
  } catch {
    return '';
  }
};

const toInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

const AdminPanelScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [panel, setPanel] = useState<PanelStats | null>(null);
  const [pendingDoctors, setPendingDoctors] = useState<PendingMedico[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const [panelRes, doctorsRes, reviewsRes] = await Promise.all([
        fetch(apiUrl('/api/admin/panel'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl('/api/admin/medicos/pendientes?limit=40'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl('/api/admin/valoraciones/pendientes?limit=40'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const panelPayload = await panelRes.json().catch(() => null);
      const doctorsPayload = await doctorsRes.json().catch(() => null);
      const reviewsPayload = await reviewsRes.json().catch(() => null);

      if (!panelRes.ok || !panelPayload?.success) {
        Alert.alert('Acceso denegado', panelPayload?.message || 'No se pudo abrir panel admin.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      setPanel(panelPayload?.panel || null);
      setPendingDoctors(Array.isArray(doctorsPayload?.pendientes) ? doctorsPayload.pendientes : []);
      setPendingReviews(
        Array.isArray(reviewsPayload?.valoraciones) ? reviewsPayload.valoraciones : []
      );
    } catch {
      Alert.alert('Error', 'No se pudo cargar el panel administrativo.');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleLogout = useCallback(async () => {
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    if (Platform.OS === 'web') {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [navigation]);

  const moderateDoctor = useCallback(
    async (usuarioid: number, action: 'aprobar' | 'rechazar') => {
      const token = await getAuthToken();
      if (!token) return;

      setWorkingId(`${action}-${usuarioid}`);
      try {
        const endpoint =
          action === 'aprobar'
            ? `/api/admin/medicos/${usuarioid}/aprobar`
            : `/api/admin/medicos/${usuarioid}/rechazar`;

        const response = await fetch(apiUrl(endpoint), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            comentario:
              action === 'aprobar'
                ? 'Documentos verificados por administrador.'
                : 'Solicitud rechazada por validacion administrativa.',
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          Alert.alert('No se pudo procesar', payload?.message || 'Intenta nuevamente.');
          return;
        }

        Alert.alert('Actualizado', payload?.message || 'Operacion completada.');
        await refresh();
      } catch {
        Alert.alert('Error', 'No se pudo procesar la solicitud.');
      } finally {
        setWorkingId('');
      }
    },
    [refresh]
  );

  const moderateReview = useCallback(
    async (valoracionId: number, action: 'aprobar' | 'rechazar') => {
      const token = await getAuthToken();
      if (!token) return;

      setWorkingId(`${action}-review-${valoracionId}`);
      try {
        const response = await fetch(
          apiUrl(`/api/admin/valoraciones/${valoracionId}/moderar`),
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ accion: action }),
          }
        );

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          Alert.alert('No se pudo moderar', payload?.message || 'Intenta nuevamente.');
          return;
        }

        await refresh();
      } catch {
        Alert.alert('Error', 'No se pudo moderar la valoracion.');
      } finally {
        setWorkingId('');
      }
    },
    [refresh]
  );

  const stats = useMemo(() => {
    const usuarios = panel?.usuarios || {};
    const citas = panel?.citas || {};
    const pagos = panel?.pagos || {};
    const valoraciones = panel?.valoraciones || {};

    return [
      {
        label: 'Usuarios activos',
        value: toInt(usuarios?.activos),
        icon: 'groups',
      },
      {
        label: 'Medicos pendientes',
        value: toInt(usuarios?.medicos_pendientes),
        icon: 'pending-actions',
      },
      {
        label: 'Citas hoy',
        value: toInt(citas?.citas_hoy),
        icon: 'calendar-today',
      },
      {
        label: 'Pagos simulados',
        value: toInt(pagos?.pagos_simulados),
        icon: 'receipt-long',
      },
      {
        label: 'Valoraciones pendientes',
        value: toInt(valoraciones?.valoraciones_pendientes),
        icon: 'star-half',
      },
    ];
  }, [panel]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Cargando panel administrativo...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel Administrativo</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={18} color="#fff" />
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsWrap}>
        {stats.map((item) => (
          <View key={item.label} style={styles.statCard}>
            <MaterialIcons name={item.icon as any} size={22} color={colors.primary} />
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solicitudes de Medicos ({pendingDoctors.length})</Text>
        {pendingDoctors.length ? (
          pendingDoctors.map((doctor) => (
            <View key={`doc-${doctor.usuarioid}`} style={styles.card}>
              <Text style={styles.cardTitle}>{normalizeText(doctor?.medico?.nombreCompleto) || 'Medico'}</Text>
              <Text style={styles.cardSub}>{doctor?.medico?.especialidad || 'Especialidad no definida'}</Text>
              <Text style={styles.cardMeta}>{doctor?.email}</Text>
              <Text style={styles.cardMeta}>Documentos: {doctor?.documentos?.length || 0}</Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.approveButton}
                  disabled={workingId === `aprobar-${doctor.usuarioid}`}
                  onPress={() => moderateDoctor(doctor.usuarioid, 'aprobar')}
                >
                  <Text style={styles.approveText}>Aprobar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  disabled={workingId === `rechazar-${doctor.usuarioid}`}
                  onPress={() => moderateDoctor(doctor.usuarioid, 'rechazar')}
                >
                  <Text style={styles.rejectText}>Rechazar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No hay medicos pendientes de aprobacion.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Valoraciones Pendientes ({pendingReviews.length})</Text>
        {pendingReviews.length ? (
          pendingReviews.map((review) => (
            <View key={`review-${review.valoracionId}`} style={styles.card}>
              <Text style={styles.cardTitle}>{review.medicoNombre}</Text>
              <Text style={styles.cardSub}>Paciente: {review.pacienteNombre}</Text>
              <Text style={styles.cardMeta}>Puntaje: {review.puntaje}/5</Text>
              <Text style={styles.commentText}>{review.comentario || 'Sin comentario'}</Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.approveButton}
                  disabled={workingId === `aprobar-review-${review.valoracionId}`}
                  onPress={() => moderateReview(review.valoracionId, 'aprobar')}
                >
                  <Text style={styles.approveText}>Publicar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  disabled={workingId === `rechazar-review-${review.valoracionId}`}
                  onPress={() => moderateReview(review.valoracionId, 'rechazar')}
                >
                  <Text style={styles.rejectText}>Descartar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No hay valoraciones pendientes.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  muted: '#4A7FA7',
  card: '#ffffff',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
  },
  loaderText: {
    color: colors.muted,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.dark,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '800',
  },
  statsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: Platform.OS === 'web' ? '19%' : '48%',
    minWidth: 130,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3eef8',
    padding: 12,
    gap: 4,
  },
  statValue: {
    color: colors.dark,
    fontWeight: '900',
    fontSize: 22,
  },
  statLabel: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3eef8',
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: colors.dark,
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e8f0f9',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fdfefe',
    gap: 2,
  },
  cardTitle: {
    color: colors.dark,
    fontWeight: '900',
    fontSize: 14,
  },
  cardSub: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  commentText: {
    color: colors.dark,
    fontSize: 12,
    marginTop: 4,
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  approveText: {
    color: '#166534',
    fontWeight: '800',
    fontSize: 12,
  },
  rejectButton: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rejectText: {
    color: '#991b1b',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 6,
  },
});

export default AdminPanelScreen;
