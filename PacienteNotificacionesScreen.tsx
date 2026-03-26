import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import type { RootStackParamList } from './navigation/types';
import { useLanguage } from './localization/LanguageContext';
import { apiUrl, BACKEND_URL } from './config/backend';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';
const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';
const MIN_REFRESH_INTERVAL_MS = 12000;

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
  section: 'HOY' | 'AYER' | 'ESTA SEMANA' | 'ANTERIOR';
  type: 'citas' | 'mensajes' | 'documentos';
  action?: string;
  createdAt?: string | null;
};

type AgendaNotification = {
  id?: string;
  tipo?: string;
  titulo?: string;
  contenido?: string;
  leida?: boolean;
  createdAt?: string;
  data?: Record<string, unknown>;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const sectionOrder: Array<'HOY' | 'AYER' | 'ESTA SEMANA' | 'ANTERIOR'> = [
  'HOY',
  'AYER',
  'ESTA SEMANA',
  'ANTERIOR',
];
type FilterType = 'todas' | 'citas' | 'mensajes' | 'documentos' | 'noleidas';

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
    if (secureToken && secureToken.trim()) return secureToken.trim();

    const asyncToken =
      (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
      (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    return String(asyncToken || '').trim();
  } catch {
    return '';
  }
};

const toRelativeTime = (value: string | null | undefined) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Ahora';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return 'hace segundos';
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `hace ${diffDay} dia(s)`;
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const resolveSection = (value: string | null | undefined): NotificationItem['section'] => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'HOY';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((today - target) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return 'HOY';
  if (diffDays === 1) return 'AYER';
  if (diffDays <= 7) return 'ESTA SEMANA';
  return 'ANTERIOR';
};

const mapApiType = (tipoRaw: string): NotificationItem['type'] => {
  const tipo = normalizeText(tipoRaw).toLowerCase();
  if (tipo.includes('mensaje')) return 'mensajes';
  if (tipo.includes('documento') || tipo.includes('receta')) return 'documentos';
  return 'citas';
};

const mapIcon = (tipoRaw: string): { icon: string; color: string; action: string } => {
  const tipo = normalizeText(tipoRaw).toLowerCase();
  if (tipo.includes('mensaje')) {
    return { icon: 'mail', color: '#137fec', action: 'Responder' };
  }
  if (tipo.includes('video')) {
    return { icon: 'videocam', color: '#137fec', action: 'Entrar a sala' };
  }
  if (tipo.includes('reprogram')) {
    return { icon: 'update', color: '#137fec', action: 'Ver cambios' };
  }
  if (tipo.includes('cancel')) {
    return { icon: 'event-busy', color: '#ef4444', action: 'Ver cita' };
  }
  if (tipo.includes('confirm')) {
    return { icon: 'event-available', color: '#137fec', action: 'Ver cita' };
  }
  return { icon: 'notifications', color: '#137fec', action: 'Ver detalles' };
};

const mapNotification = (item: AgendaNotification): NotificationItem => {
  const createdAt = item?.createdAt || null;
  const type = mapApiType(String(item?.tipo || ''));
  const iconData = mapIcon(String(item?.tipo || ''));
  return {
    id: normalizeText(item?.id || ''),
    title: normalizeText(item?.titulo || 'Notificacion'),
    message: normalizeText(item?.contenido || ''),
    time: toRelativeTime(createdAt),
    unread: !Boolean(item?.leida),
    icon: iconData.icon,
    color: iconData.color,
    section: resolveSection(createdAt),
    type,
    action: iconData.action,
    createdAt,
  };
};

const PacienteNotificacionesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('todas');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [searchText, setSearchText] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const lastRefreshRef = useRef(0);

  const loadUser = useCallback(async () => {
    try {
      let sessionUser: User | null = null;

      if (Platform.OS === 'web') {
        const webUser = ensurePatientSessionUser(parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY)));
        if (webUser) sessionUser = webUser;
      }

      if (!sessionUser) {
        const secureUser = ensurePatientSessionUser(
          parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY))
        );
        if (secureUser) sessionUser = secureUser;
      }

      if (!sessionUser) {
        sessionUser = ensurePatientSessionUser(parseUser(await AsyncStorage.getItem(STORAGE_KEY)));
      }

      const token = await getAuthToken();
      if (token) {
        const profileResponse = await fetch(apiUrl('/api/users/me/paciente-profile'), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const profilePayload = await profileResponse.json().catch(() => null);
        if (profileResponse.ok && profilePayload?.success && profilePayload?.profile) {
          const profile = profilePayload.profile as User;
          sessionUser = {
            ...(sessionUser || {}),
            ...profile,
            nombres: normalizeText((profile as any)?.nombres),
            apellidos: normalizeText((profile as any)?.apellidos),
            nombre: normalizeText((profile as any)?.nombres || (profile as any)?.nombre),
            apellido: normalizeText((profile as any)?.apellidos || (profile as any)?.apellido),
            fotoUrl: normalizeText((profile as any)?.fotoUrl),
          };
        }
      }

      setUser(sessionUser);
    } catch {
      setUser(null);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setNotifications([]);
        return;
      }

      const response = await fetch(apiUrl('/api/agenda/me/notificaciones?limit=120'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!(response.ok && payload?.success && Array.isArray(payload?.notificaciones))) {
        setNotifications([]);
        return;
      }

      const normalized = (payload.notificaciones as any[])
        .map((item) =>
          mapNotification({
            id: item?.id,
            tipo: item?.tipo,
            titulo: item?.titulo,
            contenido: item?.contenido,
            leida: item?.leida,
            createdAt: item?.createdAt,
            data: item?.data,
          })
        )
        .filter((item: NotificationItem) => Boolean(item.id))
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      setNotifications(normalized);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshRef.current = now;
      loadUser();
      loadNotifications();
    }, [loadNotifications, loadUser])
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const initSocket = async () => {
        const token = await getAuthToken();
        if (!mounted || !token) return;

        const socket = io(BACKEND_URL, {
          transports: ['websocket'],
          auth: { token },
        });
        socketRef.current = socket;

        socket.on('notificacion_nueva', (payload: any) => {
          const next = mapNotification({
            id: payload?.id,
            tipo: payload?.tipo,
            titulo: payload?.titulo,
            contenido: payload?.contenido,
            leida: payload?.leida,
            createdAt: payload?.createdAt,
            data: payload?.data,
          });
          if (!next.id) return;
          setNotifications((prev) => {
            const exists = prev.some((item) => item.id === next.id);
            if (exists) {
              return prev.map((item) => (item.id === next.id ? { ...item, ...next } : item));
            }
            return [next, ...prev];
          });
        });

        socket.on('mensaje_nuevo', () => loadNotifications());
        socket.on('cita_actualizada', () => loadNotifications());
        socket.on('cita_cancelada', () => loadNotifications());
        socket.on('cita_reprogramada', () => loadNotifications());
      };

      initSocket();
      return () => {
        mounted = false;
        if (socketRef.current) {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }, [loadNotifications])
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

  const filtered = useMemo(() => {
    const text = normalizeText(searchText).toLowerCase();
    let base = notifications;
    if (activeFilter === 'noleidas') {
      base = notifications.filter((n) => n.unread);
    } else if (activeFilter !== 'todas') {
      base = notifications.filter((n) => n.type === activeFilter);
    }
    if (!text) return base;
    return base.filter((item) => {
      return item.title.toLowerCase().includes(text) || item.message.toLowerCase().includes(text);
    });
  }, [activeFilter, notifications, searchText]);

  const grouped = useMemo(() => {
    return sectionOrder.map((section) => ({
      section,
      items: filtered.filter((item) => item.section === section),
    }));
  }, [filtered]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(apiUrl('/api/agenda/me/notificaciones/leer-todas'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        Alert.alert('No se pudo marcar', payload?.message || 'Intenta nuevamente.');
        return;
      }
      setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));
    } catch {
      Alert.alert('Error', 'No se pudieron marcar las notificaciones.');
    }
  }, []);

  const markOneRead = useCallback(async (item: NotificationItem) => {
    if (!item.unread) return;
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(apiUrl(`/api/agenda/me/notificaciones/${item.id}/leida`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) return;
      setNotifications((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, unread: false } : row))
      );
    } catch {
      // noop
    }
  }, []);

  const handleNotificationAction = (item: NotificationItem) => {
    markOneRead(item);
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
      }
    } catch {}
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
                value={searchText}
                onChangeText={setSearchText}
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
                  : group.section === 'ESTA SEMANA'
                  ? t('notif.thisWeek')
                  : 'ANTERIOR'}
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

          {!loadingNotifications && filtered.length === 0 ? (
            <Text style={styles.emptyListText}>No hay notificaciones para este filtro.</Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('notif.total')}: {notifications.length}</Text>
          <Text style={styles.footerText}>{t('notif.unread')}: {unreadCount}</Text>
          <Text style={styles.footerText}>
            {loadingNotifications ? 'Actualizando...' : t('notif.updated')}
          </Text>
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
  emptyListText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 18,
    textAlign: 'center',
  },
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


