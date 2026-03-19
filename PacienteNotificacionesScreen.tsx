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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';
import { useLanguage } from './localization/LanguageContext';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

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

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  icon: string;
  color: string;
  section: 'HOY' | 'AYER' | 'ESTA SEMANA';
  type: 'citas' | 'mensajes' | 'documentos';
  action?: string;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const notificationsData: NotificationItem[] = [
  {
    id: '1',
    title: 'Nueva cita confirmada',
    message: 'Su cita con el Dr. Arreola ha sido programada para manana a las 10:00 AM.',
    time: 'hace 5 min',
    unread: true,
    icon: 'event-available',
    color: '#137fec',
    section: 'HOY',
    type: 'citas',
    action: 'Ver detalles',
  },
  {
    id: '2',
    title: 'Mensaje del Dr. Morales',
    message: '"Hola, he revisado tus resultados de laboratorio. Por favor, revisa la receta adjunta."',
    time: 'hace 2 horas',
    unread: true,
    icon: 'mail',
    color: '#137fec',
    section: 'HOY',
    type: 'mensajes',
    action: 'Responder',
  },
  {
    id: '3',
    title: 'Documento cargado',
    message: 'Sus resultados de la prueba de Rayos X ya estan disponibles en su perfil.',
    time: 'Ayer, 14:30 PM',
    unread: false,
    icon: 'folder-open',
    color: '#94a3b8',
    section: 'AYER',
    type: 'documentos',
    action: 'Descargar PDF',
  },
  {
    id: '4',
    title: 'Recibo generado',
    message: 'Se ha generado el recibo por su consulta de telemedicina del dia 15/10.',
    time: 'Ayer, 09:15 AM',
    unread: false,
    icon: 'payments',
    color: '#94a3b8',
    section: 'AYER',
    type: 'documentos',
  },
  {
    id: '5',
    title: 'Recordatorio de Medicacion',
    message: 'Es hora de renovar su receta de Metformina. Contacte a su medico.',
    time: 'Martes, 18:00 PM',
    unread: false,
    icon: 'medical-information',
    color: '#94a3b8',
    section: 'ESTA SEMANA',
    type: 'documentos',
  },
];

const sectionOrder: Array<'HOY' | 'AYER' | 'ESTA SEMANA'> = ['HOY', 'AYER', 'ESTA SEMANA'];
type FilterType = 'todas' | 'citas' | 'mensajes' | 'documentos' | 'noleidas';

const PacienteNotificacionesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, tx } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('todas');
  const [notifications, setNotifications] = useState<NotificationItem[]>(notificationsData);

  useEffect(() => {
    const loadUser = async () => {
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

        const asyncUser = ensurePatientSessionUser(parseUser(await AsyncStorage.getItem(STORAGE_KEY)));
        setUser(asyncUser);
      } catch {
        setUser(null);
      }
    };

    loadUser();
  }, []);

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

  const filtered = useMemo(() => {
    if (activeFilter === 'todas') return notifications;
    if (activeFilter === 'noleidas') return notifications.filter((n) => n.unread);
    return notifications.filter((n) => n.type === activeFilter);
  }, [activeFilter, notifications]);

  const grouped = useMemo(() => {
    return sectionOrder.map((section) => ({
      section,
      items: filtered.filter((item) => item.section === section),
    }));
  }, [filtered]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));
  };

  const handleNotificationAction = (item: NotificationItem) => {
    if (item.type === 'mensajes') {
      navigation.navigate('PacienteChat');
      return;
    }
    if (item.type === 'citas') {
      navigation.navigate('PacienteCitas');
      return;
    }
    navigation.navigate('PacienteRecetasDocumentos');
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem(STORAGE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteRecetasDocumentos')}
            >
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.recipesDocs')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('PacienteNotificaciones')}
            >
              <MaterialIcons name="notifications" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>{t('menu.notifications')}</Text>
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

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="notifications-none" size={24} color={colors.primary} />
            <Text style={styles.headerTitle}>{t('notif.center')}</Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={16} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('notif.searchPlaceholder')}
                placeholderTextColor="#8aa7bf"
              />
            </View>

            <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
              <MaterialIcons name="done-all" size={16} color="#fff" />
              <Text style={styles.markAllBtnText}>{t('notif.markAllRead')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() =>
                Alert.alert(
                  'Preferencias',
                  'Puedes configurar tus notificaciones en la pantalla de Configuracion.'
                )
              }
            >
              <MaterialIcons name="settings" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'todas' && styles.filterChipActive]}
            onPress={() => setActiveFilter('todas')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'todas' && styles.filterChipTextActive]}>{t('notif.all')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'citas' && styles.filterChipActive]}
            onPress={() => setActiveFilter('citas')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'citas' && styles.filterChipTextActive]}>{t('notif.appointments')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'mensajes' && styles.filterChipActive]}
            onPress={() => setActiveFilter('mensajes')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'mensajes' && styles.filterChipTextActive]}>{t('notif.messages')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'documentos' && styles.filterChipActive]}
            onPress={() => setActiveFilter('documentos')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'documentos' && styles.filterChipTextActive]}>{t('notif.documents')}</Text>
          </TouchableOpacity>

          <View style={styles.filtersDivider} />

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'noleidas' && styles.filterChipActive]}
            onPress={() => setActiveFilter('noleidas')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'noleidas' && styles.filterChipTextActive]}>{t('notif.unread')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.listWrap} contentContainerStyle={{ paddingBottom: 20 }}>
          {grouped.map((group) => (
            <View key={group.section} style={styles.sectionWrap}>
              <Text style={styles.sectionLabel}>
                {group.section === 'HOY'
                  ? t('notif.today')
                  : group.section === 'AYER'
                  ? t('notif.yesterday')
                  : t('notif.thisWeek')}
              </Text>
              {group.items.length === 0 ? null : group.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.notificationCard, !item.unread && styles.notificationCardRead]}
                  activeOpacity={0.9}
                  onPress={() => handleNotificationAction(item)}
                >
                  <View style={[styles.notificationBar, { backgroundColor: item.color }]} />

                  <View style={[styles.notificationIconBox, { backgroundColor: `${item.color}18` }]}>
                    <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.notificationTitleRow}>
                      <Text style={[styles.notificationTitle, !item.unread && styles.notificationTitleRead]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.statusTag, !item.unread && styles.statusTagRead]}>
                        {item.unread ? t('notif.statusUnread') : t('notif.statusRead')}
                      </Text>
                    </View>

                    <Text style={[styles.notificationMessage, !item.unread && styles.notificationMessageRead]}>
                      {item.message}
                    </Text>

                    <View style={styles.notificationMeta}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialIcons name="schedule" size={12} color="#9bb1c7" />
                        <Text style={styles.notificationTime}>{item.time}</Text>
                      </View>
                      {item.action ? <Text style={styles.notificationAction}>{item.action}</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('notif.total')}: {notifications.length}</Text>
          <Text style={styles.footerText}>{t('notif.unread')}: {unreadCount}</Text>
          <Text style={styles.footerText}>{t('notif.updated')}</Text>
        </View>
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

  main: { flex: 1 },

  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4edf7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: colors.dark, fontSize: 33, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  searchBox: {
    width: 240,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9e5f2',
    backgroundColor: '#f9fbff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, color: colors.dark, fontSize: 12, fontWeight: '600' },

  markAllBtn: {
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markAllBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9e5f2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  filtersRow: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4edf7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#d7e4f2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: { color: '#7b96ad', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#fff', fontWeight: '800' },
  filtersDivider: { width: 1, height: 18, backgroundColor: '#d7e4f2', marginHorizontal: 4 },

  listWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  sectionWrap: { marginBottom: 14 },
  sectionLabel: {
    color: '#9bb1c7',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 0.6,
  },

  notificationCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4edf7',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    position: 'relative',
  },
  notificationCardRead: { opacity: 0.74 },
  notificationBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    width: 3,
    height: 30,
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
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationTitle: { flex: 1, color: colors.dark, fontSize: 14, fontWeight: '900' },
  notificationTitleRead: { textDecorationLine: 'line-through', color: '#8fa4b9' },
  statusTag: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: 'rgba(19,127,236,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusTagRead: {
    color: '#94a3b8',
    backgroundColor: '#ecf2f8',
  },
  notificationMessage: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 17,
  },
  notificationMessageRead: { color: '#9ab0c4' },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  notificationTime: { color: '#9bb1c7', fontSize: 11, fontWeight: '600' },
  notificationAction: { color: colors.primary, fontSize: 11, fontWeight: '800' },

  footer: {
    height: 38,
    borderTopWidth: 1,
    borderTopColor: '#e4edf7',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: { color: '#8fa4b9', fontSize: 11, fontWeight: '600' },
});

export default PacienteNotificacionesScreen;

