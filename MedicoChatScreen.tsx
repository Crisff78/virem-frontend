import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

import type { RootStackParamList } from './navigation/types';
import { apiUrl, BACKEND_URL } from './config/backend';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';
const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';
const MIN_REFRESH_INTERVAL_MS = 12000;

type SessionUser = {
  id?: number | string;
  usuarioid?: number | string;
  email?: string;
  nombreCompleto?: string;
  especialidad?: string;
  fotoUrl?: string;
};

type Message = {
  id: string;
  from: 'me' | 'other';
  text: string;
  time: string;
};

type ChatContact = {
  id: string;
  patientId: string;
  name: string;
  status: string;
  citaId: string;
  unreadCount: number;
  nextDateMs: number;
  timeLabel: string;
};

type SideItem = {
  icon: string;
  label: string;
  route?: 'DashboardMedico' | 'MedicoCitas' | 'MedicoPacientes' | 'MedicoChat' | 'MedicoPerfil';
  active?: boolean;
  badge?: { text: string; color: string };
};

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeFotoUrl = (value: unknown) => {
  const clean = normalizeText(value);
  if (!clean) return '';
  if (clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};

const parseDateMs = (value: string | null | undefined) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

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

const MedicoChatScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MedicoChat'>>();

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [searchText, setSearchText] = useState('');
  const [reply, setReply] = useState('');
  const [selectedChatId, setSelectedChatId] = useState('');
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const socketRef = useRef<Socket | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef(0);

  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    try {
      const rawStorageUser =
        Platform.OS === 'web'
          ? localStorage.getItem(LEGACY_USER_STORAGE_KEY)
          : await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY);
      const rawAsyncUser = await AsyncStorage.getItem(STORAGE_KEY);
      let sessionUser = parseJson<SessionUser>(rawStorageUser) || parseJson<SessionUser>(rawAsyncUser);

      const token = await getAuthToken();
      if (token) {
        const dashboardResponse = await fetch(apiUrl('/api/users/me/dashboard-medico'), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const dashboardPayload = await dashboardResponse.json().catch(() => null);
        if (dashboardResponse.ok && dashboardPayload?.success && dashboardPayload?.dashboard?.profile) {
          const profile = dashboardPayload.dashboard.profile;
          sessionUser = {
            ...(sessionUser || {}),
            nombreCompleto: normalizeText(profile?.nombreCompleto || sessionUser?.nombreCompleto),
            especialidad: normalizeText(profile?.especialidad || sessionUser?.especialidad),
            fotoUrl: sanitizeFotoUrl(profile?.fotoUrl || sessionUser?.fotoUrl),
          };
        }
      }

      setUser(sessionUser);
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setContacts([]);
        return;
      }

      const response = await fetch(apiUrl('/api/agenda/me/conversaciones?limit=150'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!(response.ok && payload?.success && Array.isArray(payload?.conversaciones))) {
        setContacts([]);
        return;
      }

      const sorted = (payload.conversaciones as any[])
        .map((conversation) => {
          const conversationId = normalizeText(conversation?.conversacionId);
          const citaId = normalizeText(conversation?.citaId);
          if (!conversationId || !citaId) return null;
          const nextDateMs = parseDateMs(conversation?.cita?.fechaHoraInicio || null);
          return {
            id: conversationId,
            patientId: normalizeText(conversation?.paciente?.pacienteid),
            name: normalizeText(conversation?.paciente?.nombreCompleto || 'Paciente') || 'Paciente',
            status: normalizeText(conversation?.cita?.estadoCodigo || 'pendiente') || 'pendiente',
            citaId,
            unreadCount: Number(conversation?.unreadCount || 0),
            nextDateMs,
            timeLabel: formatDateTime(conversation?.cita?.fechaHoraInicio),
          } as ChatContact;
        })
        .filter((row: ChatContact | null): row is ChatContact => Boolean(row))
        .sort((a, b) => {
          if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
          if (a.nextDateMs === b.nextDateMs) return a.name.localeCompare(b.name);
          return a.nextDateMs - b.nextDateMs;
        });
      setContacts(sorted);
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const scheduleContactsReload = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadContacts();
    }, 500);
  }, [loadContacts]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshRef.current = now;
      loadUser();
      loadContacts();
    }, [loadContacts, loadUser])
  );

  const loadMessages = useCallback(async (conversationId: string) => {
    const cleanConversationId = normalizeText(conversationId);
    if (!cleanConversationId) return;

    setLoadingMessages(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        apiUrl(`/api/agenda/me/conversaciones/${cleanConversationId}/mensajes?limit=120`),
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const payload = await response.json().catch(() => null);
      if (!(response.ok && payload?.success && Array.isArray(payload?.mensajes))) {
        return;
      }

      const normalized = (payload.mensajes as any[]).map((message: any) => {
        const sender = normalizeText(message?.emisorTipo).toLowerCase();
        const from = sender === 'medico' ? 'me' : 'other';
        return {
          id: normalizeText(message?.mensajeId || `${Date.now()}-${Math.random()}`),
          from,
          text: normalizeText(message?.contenido),
          time: formatDateTime(message?.createdAt),
        } as Message;
      });

      setMessagesByChat((prev) => ({
        ...prev,
        [cleanConversationId]: normalized,
      }));

      await fetch(apiUrl(`/api/agenda/me/conversaciones/${cleanConversationId}/leido`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null);
    } catch {
      // noop
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    const routePatientId = normalizeText(route.params?.patientId);
    const routePatientName = normalizeText(route.params?.patientName);
    if (!contacts.length) {
      setSelectedChatId('');
      return;
    }

    if (routePatientId) {
      const byPatientId = contacts.find((c) => normalizeText(c.patientId) === routePatientId);
      if (byPatientId) {
        setSelectedChatId(byPatientId.id);
        return;
      }
    }

    if (routePatientName) {
      const byName = contacts.find(
        (c) => normalizeText(c.name).toLowerCase() === routePatientName.toLowerCase()
      );
      if (byName) {
        setSelectedChatId(byName.id);
        return;
      }
    }

    if (!contacts.some((c) => c.id === selectedChatId)) {
      setSelectedChatId(contacts[0].id);
    }
  }, [contacts, route.params?.patientId, route.params?.patientName, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) return;
    loadMessages(selectedChatId);
  }, [loadMessages, selectedChatId]);

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

        socket.on('mensaje_nuevo', (payload: any) => {
          const conversationId = normalizeText(payload?.conversacionId);
          if (!conversationId) return;
          const rawMessage = payload?.mensaje;
          if (conversationId === selectedChatId && rawMessage) {
            const sender = normalizeText(rawMessage?.emisorTipo).toLowerCase();
            const from = sender === 'medico' ? 'me' : 'other';
            const nextMessage: Message = {
              id: normalizeText(rawMessage?.mensajeId || `${Date.now()}-${Math.random()}`),
              from,
              text: normalizeText(rawMessage?.contenido),
              time: formatDateTime(rawMessage?.createdAt),
            };
            setMessagesByChat((prev) => ({
              ...prev,
              [conversationId]: [...(prev[conversationId] || []), nextMessage],
            }));
          }
          scheduleContactsReload();
          if (conversationId === selectedChatId) {
            loadMessages(conversationId);
          }
        });
        socket.on('cita_actualizada', () => scheduleContactsReload());
        socket.on('cita_reprogramada', () => scheduleContactsReload());
      };

      initSocket();
      return () => {
        mounted = false;
        if (socketRef.current) {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }, [loadMessages, scheduleContactsReload, selectedChatId])
  );

  const filteredContacts = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) => {
      const name = normalizeText(contact.name).toLowerCase();
      const status = normalizeText(contact.status).toLowerCase();
      return name.includes(q) || status.includes(q);
    });
  }, [contacts, searchText]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedChatId) || null,
    [contacts, selectedChatId]
  );

  const currentMessages = messagesByChat[selectedChatId] || [];

  const doctorName = useMemo(() => {
    const base = normalizeText(user?.nombreCompleto);
    if (!base) return 'Doctor';
    const lowered = base.toLowerCase();
    if (lowered.startsWith('dr ') || lowered.startsWith('dr.')) return base;
    return `Dr. ${base}`;
  }, [user?.nombreCompleto]);

  const doctorSpec = useMemo(
    () => normalizeText(user?.especialidad) || 'Especialidad no definida',
    [user?.especialidad]
  );

  const doctorAvatarSource: ImageSourcePropType = useMemo(() => {
    const foto = sanitizeFotoUrl(user?.fotoUrl);
    if (foto) return { uri: foto };
    return DefaultAvatar;
  }, [user?.fotoUrl]);

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

  const sendMessage = async () => {
    const text = normalizeText(reply);
    if (!text || !selectedChatId) return;

    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(apiUrl(`/api/agenda/me/conversaciones/${selectedChatId}/mensajes`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contenido: text,
          tipo: 'texto',
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.mensaje) {
        return;
      }

      const nextMessage: Message = {
        id: normalizeText(payload?.mensaje?.mensajeId || `${Date.now()}`),
        from: 'me',
        text,
        time: formatDateTime(payload?.mensaje?.createdAt),
      };

      setMessagesByChat((prev) => ({
        ...prev,
        [selectedChatId]: [...(prev[selectedChatId] || []), nextMessage],
      }));
      setReply('');
      loadContacts();
    } catch {
      // noop
    }
  };

  const sideItems: SideItem[] = [
    { icon: 'dashboard', label: 'Dashboard', route: 'DashboardMedico' },
    { icon: 'calendar-today', label: 'Agenda', route: 'MedicoCitas' },
    { icon: 'group', label: 'Pacientes', route: 'MedicoPacientes' },
    { icon: 'notification-important', label: 'Solicitudes', badge: { text: '5', color: '#ef4444' } },
    { icon: 'chat-bubble', label: 'Mensajes', route: 'MedicoChat', active: true, badge: { text: '3', color: colors.primary } },
    { icon: 'person', label: 'Perfil', route: 'MedicoPerfil' },
    { icon: 'settings', label: 'Configuracion', route: 'MedicoPerfil' },
  ];

  const handleSideItemPress = (item: SideItem) => {
    if (!item.route) {
      Alert.alert('Solicitudes', 'Las solicitudes pendientes se integraran en un modulo dedicado.');
      return;
    }
    if (item.route === 'MedicoChat') return;
    navigation.navigate(item.route);
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

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.loadingText}>Cargando chat medico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <View>
          <View style={styles.logoWrap}>
            <Image source={ViremLogo} style={styles.logo} />
            <View>
              <Text style={styles.logoTitle}>VIREM</Text>
              <Text style={styles.logoSub}>Portal Medico</Text>
            </View>
          </View>

          <View style={styles.userCard}>
            <Image source={doctorAvatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{doctorName}</Text>
            <Text style={styles.userSpec}>{doctorSpec}</Text>
          </View>

          <View style={styles.menu}>
            {sideItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, item.active ? styles.menuItemActive : null]}
                onPress={() => handleSideItemPress(item)}
                activeOpacity={0.85}
              >
                <MaterialIcons
                  name={item.icon as any}
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

      <View style={styles.main}>
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Mensajeria Medica</Text>
              <Text style={styles.pageSubtitle}>Comunicate rapido con pacientes agendados.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerDate}>{dateText}</Text>
              <Text style={styles.headerTime}>{timeText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.chatShell}>
          <View style={styles.contactsPane}>
            <View style={styles.searchRow}>
              <MaterialIcons name="search" size={18} color={colors.muted} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Buscar paciente"
                placeholderTextColor="#8ca7bd"
                style={styles.searchInput}
              />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              {loadingContacts ? <Text style={styles.loadingText}>Cargando pacientes...</Text> : null}
              {!loadingContacts && !filteredContacts.length ? (
                <Text style={styles.loadingText}>No tienes pacientes para chat aun.</Text>
              ) : null}
              {filteredContacts.map((chat) => {
                const active = chat.id === selectedChatId;
                return (
                  <TouchableOpacity
                    key={chat.id}
                    style={[styles.contactRow, active && styles.contactRowActive]}
                    onPress={() => setSelectedChatId(chat.id)}
                    activeOpacity={0.85}
                  >
                    <Image source={DefaultAvatar} style={styles.contactAvatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contactName, active && styles.contactNameActive]}>{chat.name}</Text>
                      <Text style={styles.contactMeta}>
                        {chat.status} · {chat.timeLabel}
                        {chat.unreadCount > 0 ? ` · ${chat.unreadCount} sin leer` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.messagesPane}>
            {selectedContact ? (
              <>
                <View style={styles.chatHeader}>
                  <Image source={DefaultAvatar} style={styles.chatHeaderAvatar} />
                  <View>
                    <Text style={styles.chatHeaderName}>{selectedContact.name}</Text>
                    <Text style={styles.chatHeaderSub}>
                      Ultima referencia: {selectedContact.status} · {selectedContact.timeLabel}
                    </Text>
                  </View>
                </View>

                <ScrollView style={styles.messagesList} contentContainerStyle={{ paddingBottom: 12 }}>
                  {loadingMessages ? (
                    <Text style={styles.emptyConversation}>Cargando mensajes...</Text>
                  ) : !currentMessages.length ? (
                    <Text style={styles.emptyConversation}>
                      Inicia la conversacion con {selectedContact.name}.
                    </Text>
                  ) : (
                    currentMessages.map((message) => (
                      <View
                        key={message.id}
                        style={[styles.messageBubble, message.from === 'me' ? styles.messageMe : styles.messageOther]}
                      >
                        <Text style={[styles.messageText, message.from === 'me' ? styles.messageTextMe : null]}>
                          {message.text}
                        </Text>
                        <Text style={[styles.messageTime, message.from === 'me' ? styles.messageTimeMe : null]}>
                          {message.time}
                        </Text>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={styles.replyRow}>
                  <TextInput
                    value={reply}
                    onChangeText={setReply}
                    placeholder={selectedContact ? `Escribe a ${selectedContact.name}` : 'Selecciona un paciente'}
                    placeholderTextColor="#8ca7bd"
                    style={styles.replyInput}
                    editable={Boolean(selectedContact)}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !reply.trim().length && styles.sendBtnDisabled]}
                    onPress={sendMessage}
                    disabled={!reply.trim().length || !selectedContact}
                  >
                    <MaterialIcons name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyChatState}>
                <Text style={styles.loadingText}>Selecciona un paciente para iniciar chat.</Text>
              </View>
            )}
          </View>
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
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
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
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, resizeMode: 'contain' },
  logoTitle: { color: colors.dark, fontSize: 20, fontWeight: '800' },
  logoSub: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  userCard: { marginTop: 18, marginBottom: 10, alignItems: 'center' },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: '#f1f5fb',
    marginBottom: 10,
  },
  userName: { color: colors.dark, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  userSpec: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  menu: { marginTop: 10, gap: 6 },
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
    marginTop: 14,
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
  headerLeft: { flex: 1 },
  headerRight: { alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start' },
  headerDate: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  headerTime: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pageTitle: { color: colors.dark, fontSize: 30, fontWeight: '900' },
  pageSubtitle: { color: colors.muted, fontSize: 16, fontWeight: '500', marginTop: 3 },
  chatShell: {
    flex: 1,
    marginHorizontal: Platform.OS === 'web' ? 32 : 14,
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe8f5',
    overflow: 'hidden',
    backgroundColor: '#fff',
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    minHeight: 500,
  },
  contactsPane: {
    width: Platform.OS === 'web' ? 320 : '100%',
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderRightColor: '#e4edf7',
    borderBottomColor: '#e4edf7',
    padding: 12,
    backgroundColor: '#f8fbff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d5e3f2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: colors.dark, fontSize: 14, fontWeight: '600', paddingVertical: 3 },
  contactRow: {
    borderWidth: 1,
    borderColor: '#e1ebf6',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  contactRowActive: { borderColor: '#137fec', backgroundColor: '#eef6ff' },
  contactAvatar: { width: 42, height: 42, borderRadius: 42 },
  contactName: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  contactNameActive: { color: colors.primary },
  contactMeta: { color: colors.muted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  messagesPane: { flex: 1, padding: 12, backgroundColor: '#fbfdff' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#dfeaf7',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  chatHeaderAvatar: { width: 42, height: 42, borderRadius: 42 },
  chatHeaderName: { color: colors.dark, fontSize: 15, fontWeight: '900' },
  chatHeaderSub: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  messagesList: { flex: 1, marginTop: 10 },
  emptyConversation: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 8 },
  messageBubble: {
    maxWidth: '84%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  messageMe: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  messageOther: { alignSelf: 'flex-start', backgroundColor: '#e9f1fb' },
  messageText: { color: colors.dark, fontSize: 13, fontWeight: '600' },
  messageTextMe: { color: '#fff' },
  messageTime: { color: '#6e89a1', fontSize: 10, marginTop: 4, textAlign: 'right', fontWeight: '700' },
  messageTimeMe: { color: '#d9e9ff' },
  replyRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d9e6f4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  replyInput: { flex: 1, color: colors.dark, fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.55 },
  emptyChatState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default MedicoChatScreen;

