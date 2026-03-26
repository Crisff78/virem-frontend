import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import type { RootStackParamList } from './navigation/types';
import { useLanguage } from './localization/LanguageContext';
import { apiUrl } from './config/backend';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';
import { getAuthToken } from './utils/auth';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';

type User = {
  nombres?: string;
  apellidos?: string;
  nombre?: string;
  apellido?: string;
  firstName?: string;
  lastName?: string;
  fotoUrl?: string;
  plan?: string;
};

type SessionRow = {
  id: string;
  device: string;
  ip: string;
  location: string;
  dateTime: string;
  current: boolean;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const FALLBACK_SESSIONS: SessionRow[] = [
  {
    id: 's-current',
    device: Platform.OS === 'web' ? 'Navegador Web' : 'Dispositivo Movil',
    ip: '---',
    location: 'Sesion actual',
    dateTime: 'Ahora',
    current: true,
  },
];

const mapApiSession = (item: any, index: number): SessionRow => ({
  id: String(item?.id || item?.sessionId || `s-${index}`),
  device: String(item?.device || item?.userAgent || 'Dispositivo desconocido'),
  ip: String(item?.ip || item?.ipAddress || '---'),
  location: String(item?.location || item?.ciudad || 'Ubicacion desconocida'),
  dateTime: item?.createdAt
    ? new Intl.DateTimeFormat('es-DO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(item.createdAt))
    : String(item?.dateTime || 'Sin fecha'),
  current: Boolean(item?.current || item?.esSesionActual),
});

const PacienteHistorialSesionesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, tx } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>(FALLBACK_SESSIONS);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(apiUrl('/api/auth/sessions'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.success && Array.isArray(payload?.sessions)) {
        const mapped = payload.sessions.map(mapApiSession);
        if (mapped.length > 0) {
          setSessions(mapped);
        }
      }
    } catch {
      // Keep fallback sessions
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const webUser = ensurePatientSessionUser(parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY)));
        if (webUser) {
          setUser(webUser);
          return;
        }
      }
      const secureUser = ensurePatientSessionUser(
        parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY))
      );
      if (secureUser) {
        setUser(secureUser);
        return;
      }
      setUser(ensurePatientSessionUser(parseUser(await AsyncStorage.getItem(STORAGE_KEY))));
    } catch {
      setUser(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadSessions();
    }, [loadUser, loadSessions])
  );

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user]);

  const avatarSource: ImageSourcePropType = useMemo(() => {
    if (user?.fotoUrl && user.fotoUrl.trim().length > 0) {
      return { uri: user.fotoUrl.trim() };
    }
    return DefaultAvatar;
  }, [user]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem(STORAGE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const closeOtherSessions = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        await fetch(apiUrl('/api/auth/sessions/revoke-others'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch {}
    setSessions((prev) => prev.filter((s) => s.current));
    Alert.alert(
      tx({ es: 'Listo', en: 'Done', pt: 'Pronto' }),
      tx({
        es: 'Se cerraron todas las demas sesiones.',
        en: 'All other sessions were closed.',
        pt: 'Todas as outras sessoes foram encerradas.',
      })
    );
  };

  const removeSession = async (id: string) => {
    try {
      const token = await getAuthToken();
      if (token) {
        await fetch(apiUrl(`/api/auth/sessions/${id}/revoke`), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch {}
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <View>
          <View style={styles.logoBox}>
            <Image source={ViremLogo} style={styles.logo} />
            <View>
              <Text style={styles.logoTitle}>VIREM</Text>
              <Text style={styles.logoSubtitle}>Portal Paciente</Text>
            </View>
          </View>

          <View style={styles.userBox}>
            <Image source={avatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userPlan}>{planLabel}</Text>
          </View>

          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('DashboardPaciente')}>
              <MaterialIcons name="grid-view" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.home')}</Text>
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
            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('PacienteRecetasDocumentos')}>
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.recipesDocs')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('PacientePerfil')}>
              <MaterialIcons name="account-circle" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.profile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItemRow, styles.menuItemActive]} onPress={() => navigation.navigate('PacienteConfiguracion')}>
              <MaterialIcons name="settings" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>{t('menu.settings')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        <View style={styles.topHeader}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder={tx({
                es: 'Buscar en historial...',
                en: 'Search in history...',
                pt: 'Buscar no historico...',
              })}
              placeholderTextColor="#8ea6bc"
            />
          </View>

          <View style={styles.topRight}>
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={() => navigation.navigate('PacienteNotificaciones')}
            >
              <MaterialIcons name="notifications" size={20} color={colors.muted} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
            <View style={styles.headerDivider} />
            <View style={styles.userHeader}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.userHeaderName}>{fullName}</Text>
                <Text style={styles.userHeaderRole}>{planLabel}</Text>
              </View>
              <Image source={avatarSource} style={styles.userHeaderAvatar} />
            </View>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 26 }}>
          <View style={styles.breadcrumbRow}>
            <Text style={styles.breadcrumbText}>{t('menu.settings')}</Text>
            <MaterialIcons name="chevron-right" size={14} color="#9bb1c7" />
            <Text style={styles.breadcrumbCurrent}>
              {tx({ es: 'Seguridad', en: 'Security', pt: 'Seguranca' })}
            </Text>
          </View>

          <View style={styles.headingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {tx({ es: 'Historial de Sesiones', en: 'Session History', pt: 'Historico de Sessoes' })}
              </Text>
              <Text style={styles.subtitle}>
                {tx({
                  es: 'Gestiona tus sesiones activas y dispositivos conectados para mantener tu cuenta segura.',
                  en: 'Manage active sessions and connected devices to keep your account secure.',
                  pt: 'Gerencie suas sessoes ativas e dispositivos conectados para manter sua conta segura.',
                })}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeAllBtn} onPress={closeOtherSessions}>
              <MaterialIcons name="history-toggle-off" size={16} color="#fff" />
              <Text style={styles.closeAllText}>
                {tx({
                  es: 'Cerrar todas las demás sesiones',
                  en: 'Close all other sessions',
                  pt: 'Encerrar todas as outras sessoes',
                })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.securityAlert}>
            <View style={styles.securityIcon}>
              <MaterialIcons name="security" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityAlertTitle}>
                {tx({ es: 'Seguridad de la cuenta', en: 'Account Security', pt: 'Seguranca da conta' })}
              </Text>
              <Text style={styles.securityAlertText}>
                {tx({
                  es: 'Si notas actividad inusual en esta lista, te recomendamos cerrar las sesiones inactivas y cambiar tu contraseña inmediatamente. Mostramos sesiones de los últimos 30 días.',
                  en: 'If you notice unusual activity, close inactive sessions and change your password immediately. We show sessions from the last 30 days.',
                  pt: 'Se notar atividade incomum, encerre sessoes inativas e altere sua senha imediatamente. Mostramos sessoes dos ultimos 30 dias.',
                })}
              </Text>
            </View>
          </View>

          <View style={styles.tableWrap}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2.2 }]}>
                {tx({ es: 'DISPOSITIVO', en: 'DEVICE', pt: 'DISPOSITIVO' })}
              </Text>
              <Text style={[styles.th, { flex: 1.4 }]}>
                {tx({ es: 'UBICACION', en: 'LOCATION', pt: 'LOCALIZACAO' })}
              </Text>
              <Text style={[styles.th, { flex: 1.3 }]}>
                {tx({ es: 'FECHA / HORA', en: 'DATE / TIME', pt: 'DATA / HORA' })}
              </Text>
              <Text style={[styles.th, { flex: 1 }]}>
                {tx({ es: 'ESTADO', en: 'STATUS', pt: 'STATUS' })}
              </Text>
              <Text style={[styles.th, { flex: 0.6, textAlign: 'right' }]}>
                {tx({ es: 'ACCION', en: 'ACTION', pt: 'ACAO' })}
              </Text>
            </View>

            {sessions.map((s) => (
              <View key={s.id} style={styles.tr}>
                <View style={[styles.td, { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <MaterialIcons name="devices" size={17} color={colors.muted} />
                  <View>
                    <Text style={styles.deviceTitle}>{s.device}</Text>
                    <Text style={styles.deviceIp}>IP: {s.ip}</Text>
                  </View>
                </View>
                <Text style={[styles.tdText, { flex: 1.4 }]}>{s.location}</Text>
                <Text style={[styles.tdText, { flex: 1.3 }]}>{s.dateTime}</Text>
                <View style={[styles.td, { flex: 1 }]}>
                  <View style={[styles.statusBadge, s.current && styles.statusCurrent]}>
                    <Text style={[styles.statusText, s.current && styles.statusCurrentText]}>
                      {s.current
                        ? tx({ es: 'Sesion actual', en: 'Current session', pt: 'Sessao atual' })
                        : tx({ es: 'Finalizada', en: 'Ended', pt: 'Finalizada' })}
                    </Text>
                  </View>
                </View>
                <View style={[styles.td, { flex: 0.6, alignItems: 'flex-end' }]}>
                  {s.current ? (
                    <Text style={styles.dashText}>-</Text>
                  ) : (
                    <TouchableOpacity onPress={() => removeSession(s.id)}>
                      <MaterialIcons name="delete-outline" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerInfo}>
              {tx({
                es: `Mostrando ${sessions.length} de 12 sesiones detectadas`,
                en: `Showing ${sessions.length} of 12 detected sessions`,
                pt: `Mostrando ${sessions.length} de 12 sessoes detectadas`,
              })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.pageBtn, styles.pageBtnDisabled]} disabled>
                <Text style={styles.pageBtnDisabledText}>
                  {tx({ es: 'Anterior', en: 'Previous', pt: 'Anterior' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pageBtn}
                onPress={() =>
                  Alert.alert(
                    'Historial',
                    'No hay mas sesiones para mostrar por ahora.'
                  )
                }
              >
                <Text style={styles.pageBtnText}>
                  {tx({ es: 'Siguiente', en: 'Next', pt: 'Proximo' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
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
  userAvatar: { width: 76, height: 76, borderRadius: 76, marginBottom: 10, borderWidth: 4, borderColor: '#f5f7fb' },
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14 },
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
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
  menuItemActive: { backgroundColor: 'rgba(19,127,236,0.10)', borderRightWidth: 3, borderRightColor: colors.primary },
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

  main: { flex: 1 },
  topHeader: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#dce8f5',
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchBox: {
    width: 320,
    maxWidth: '60%',
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f8fd',
    borderWidth: 1,
    borderColor: '#dce8f5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.dark, fontWeight: '600' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: '#fff',
  },
  headerDivider: { width: 1, height: 24, backgroundColor: '#dce8f5' },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userHeaderName: { color: colors.dark, fontSize: 13, fontWeight: '800' },
  userHeaderRole: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  userHeaderAvatar: { width: 34, height: 34, borderRadius: 34, borderWidth: 2, borderColor: '#dce8f5' },

  content: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  breadcrumbText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  breadcrumbCurrent: { color: colors.dark, fontSize: 12, fontWeight: '800' },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  title: { color: colors.dark, fontSize: 40, fontWeight: '900', marginBottom: 3 },
  subtitle: { color: colors.muted, fontSize: 18, fontWeight: '600', lineHeight: 24, maxWidth: 820 },
  closeAllBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.blue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeAllText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  securityAlert: {
    backgroundColor: '#eef6ff',
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  securityIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityAlertTitle: { color: colors.dark, fontSize: 18, fontWeight: '800', marginBottom: 3 },
  securityAlertText: { color: colors.muted, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  tableWrap: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHead: {
    backgroundColor: '#f6fafe',
    borderBottomWidth: 1,
    borderBottomColor: '#e5eef7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  th: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef4fb',
  },
  td: { justifyContent: 'center' },
  deviceTitle: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  deviceIp: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  tdText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#eef4fb',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusCurrent: { backgroundColor: '#dcfce7' },
  statusText: { color: colors.blue, fontSize: 11, fontWeight: '800' },
  statusCurrentText: { color: '#166534' },
  dashText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },

  footerRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerInfo: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  pageBtn: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  pageBtnText: { color: colors.blue, fontSize: 13, fontWeight: '700' },
  pageBtnDisabled: { backgroundColor: '#f8fafc' },
  pageBtnDisabledText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
});

export default PacienteHistorialSesionesScreen;

