import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';
import { useLanguage } from './localization/LanguageContext';
import { usePatientPortalSession } from './hooks/usePatientPortalSession';
import { resolveRemoteImageSource } from './utils/imageSources';
import PacienteSidebar from './components/PacienteSidebar';
import { usePacienteModule, PacienteModuleProvider } from './navigation/PacienteModuleContext';
import { useResponsive } from './hooks/useResponsive';

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

const colors = {
  primary: '#1e40af',
  blue: '#1e40af',
  dark: '#0f172a',
  muted: '#64748b',
  bg: '#f5f7fb',
};

const PacienteHistorialSesionesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, tx } = useLanguage();
  const { isInsidePortal, isSidebarOpen, toggleSidebar, setIsNotificationsOpen } = usePacienteModule();
  const { isDesktop: isDesktopLayout } = useResponsive();
  const { signOut, fullName, planLabel, fotoUrl } = usePatientPortalSession();
  const [sessions, setSessions] = useState<SessionRow[]>([
    {
      id: 's1',
      device: 'MacBook Pro - Chrome',
      ip: '192.168.1.45',
      location: 'Santo Domingo, DO',
      dateTime: 'Hoy, 10:24 AM',
      current: true,
    },
    {
      id: 's2',
      device: 'iPhone 13 - App VIREM',
      ip: '85.12.44.201',
      location: 'Santiago, DO',
      dateTime: 'Ayer, 08:15 PM',
      current: false,
    },
    {
      id: 's3',
      device: 'Windows PC - Microsoft Edge',
      ip: '74.22.10.155',
      location: 'La Vega, DO',
      dateTime: '12 Oct, 09:30 AM',
      current: false,
    },
    {
      id: 's4',
      device: 'Samsung Galaxy Tab - Safari',
      ip: '188.4.12.99',
      location: 'San Pedro, DO',
      dateTime: '08 Oct, 03:45 PM',
      current: false,
    },
  ]);

  const avatarSource: ImageSourcePropType = useMemo(() => {
    return resolveRemoteImageSource(fotoUrl, DefaultAvatar);
  }, [fotoUrl]);

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const closeOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.current));
    Alert.alert(
      tx({ es: 'Listo', en: 'Done', pt: 'Pronto' }),
      tx({
        es: 'Se cerraron todas las demás sesiones.',
        en: 'All other sessions were closed.',
        pt: 'Todas as outras sessoes fueron encerradas.',
      })
    );
  };

  const removeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <View style={[styles.container, !isInsidePortal && isDesktopLayout && { flexDirection: 'row' }]}>
      {!isInsidePortal && (
        <PacienteSidebar
          isMobileMenuOpen={isSidebarOpen}
          onToggleMobileMenu={toggleSidebar}
          onCloseMobileMenu={toggleSidebar}
        />
      )}

      <View style={styles.main}>
        <View style={styles.topHeader}>
          {!isSidebarOpen && (
            <TouchableOpacity 
              style={styles.hamburgerBtn} 
              onPress={toggleSidebar}
            >
              <MaterialIcons name="menu" size={26} color={colors.dark} />
            </TouchableOpacity>
          )}
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
              onPress={() => setIsNotificationsOpen(true)}
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
            <Text style={styles.breadcrumbText}>{tx({ es: 'Configuración', en: 'Settings', pt: 'Configuracoes' })}</Text>
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
                  pt: 'Se notar atividade incomum, encerre sessoes inativas e altere sua senha inmediatamente. Mostramos sessoes dos ultimos 30 dias.',
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    marginRight: 10,
  },
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

const PacienteHistorialSesionesScreenWrapper: React.FC = (props) => (
  <PacienteModuleProvider initialModule="PacienteConfiguracion">
    <PacienteHistorialSesionesScreen {...props} />
  </PacienteModuleProvider>
);

export default PacienteHistorialSesionesScreenWrapper;
