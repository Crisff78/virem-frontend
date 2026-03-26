import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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

import { useLanguage } from './localization/LanguageContext';
import type { RootStackParamList } from './navigation/types';
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
  id?: number | string;
  usuarioid?: number | string;
  email?: string;
  nombres?: string;
  apellidos?: string;
  nombre?: string;
  apellido?: string;
  firstName?: string;
  lastName?: string;
  plan?: string;
  fotoUrl?: string;
};

type Message = {
  id: string;
  from: 'me' | 'other';
  text: string;
  time: string;
  dateLabel?: string;
};

type ChatContact = {
  id: string;
  doctorId: string;
  name: string;
  specialty: string;
  avatarUrl: string;
  citaId: string;
  unreadCount: number;
  nextDateMs: number;
  timeLabel: string;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
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

const resolveAvatarSource = (value: unknown): ImageSourcePropType => {
  const clean = sanitizeFotoUrl(value);
  if (clean) return { uri: clean };
  return DefaultAvatar;
};

const parseDateMs = (value: string | null | undefined) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

const formatTimeLabel = (dateMs: number) => {
  if (!Number.isFinite(dateMs) || dateMs === Number.POSITIVE_INFINITY) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateMs));
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

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  white: '#FFFFFF',
};

const PacienteChatScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;
  const route = useRoute<RouteProp<RootStackParamList, 'PacienteChat'>>();
  const { t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [user, setUser] = useState<User | null>(null);
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
      const rawUserFromStorage =
        Platform.OS === 'web'
          ? localStorage.getItem(LEGACY_USER_STORAGE_KEY)
          : await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY);
      const rawUserFromAsync = await AsyncStorage.getItem(STORAGE_KEY);
      let sessionUser = ensurePatientSessionUser(parseUser(rawUserFromStorage) || parseUser(rawUserFromAsync));

      const token = await getAuthToken();
      if (token) {
        const profileResponse = await fetch(apiUrl('/api/users/me/paciente-profile'), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const profilePayload = await profileResponse.json().catch(() => null);
        if (profileResponse.ok && profilePayload?.success && profilePayload?.profile) {
          const profileUser = profilePayload.profile as User;
          sessionUser = {
            ...(sessionUser || {}),
            ...profileUser,
            nombres: normalizeText((profileUser as any)?.nombres),
            apellidos: normalizeText((profileUser as any)?.apellidos),
            nombre: normalizeText((profileUser as any)?.nombres || (profileUser as any)?.nombre),
            apellido: normalizeText((profileUser as any)?.apellidos || (profileUser as any)?.apellido),
            fotoUrl: sanitizeFotoUrl((profileUser as any)?.fotoUrl),
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

      const response = await fetch(apiUrl('/api/agenda/me/conversaciones?limit=120'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!(response.ok && payload?.success && Array.isArray(payload?.conversaciones))) {
        setContacts([]);
        return;
      }

      const routeDoctorId = normalizeText(route.params?.doctorId);
      const routeAvatarUrl = sanitizeFotoUrl(route.params?.doctorAvatarUrl);
      const contactList = (payload.conversaciones as any[])
        .map((conversation) => {
          const conversationId = normalizeText(conversation?.conversacionId);
          const citaId = normalizeText(conversation?.citaId);
          if (!conversationId || !citaId) return null;
          const nextDateMs = parseDateMs(conversation?.cita?.fechaHoraInicio || null);
          const doctorId = normalizeText(conversation?.medico?.medicoid);
          const fallbackAvatar = routeDoctorId && doctorId === routeDoctorId ? routeAvatarUrl : '';
          return {
            id: conversationId,
            doctorId,
            name: normalizeText(conversation?.medico?.nombreCompleto || 'Especialista') || 'Especialista',
            specialty:
              normalizeText(conversation?.medico?.especialidad || 'Medicina General') || 'Medicina General',
            avatarUrl: fallbackAvatar,
            citaId,
            unreadCount: Number(conversation?.unreadCount || 0),
            nextDateMs,
            timeLabel: formatTimeLabel(nextDateMs),
          } as ChatContact;
        })
        .filter((row: ChatContact | null): row is ChatContact => Boolean(row))
        .sort((a, b) => {
          if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
          return a.nextDateMs - b.nextDateMs;
        });

      setContacts(contactList);
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [route.params?.doctorAvatarUrl, route.params?.doctorId]);

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
        const from = sender === 'paciente' ? 'me' : 'other';
        const time = formatTimeLabel(parseDateMs(message?.createdAt));
        return {
          id: normalizeText(message?.mensajeId || `${Date.now()}-${Math.random()}`),
          from,
          text: normalizeText(message?.contenido),
          time,
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
    const routeDoctorId = normalizeText(route.params?.doctorId);
    const routeDoctorName = normalizeText(route.params?.doctorName).toLowerCase();

    if (!contacts.length) {
      setSelectedChatId('');
      return;
    }

    if (routeDoctorId) {
      const byDoctorId = contacts.find((c) => c.doctorId === routeDoctorId);
      if (byDoctorId) {
        setSelectedChatId(byDoctorId.id);
        return;
      }
      const byId = contacts.find((c) => c.id === routeDoctorId);
      if (byId) {
        setSelectedChatId(byId.id);
        return;
      }
    }

    if (routeDoctorName) {
      const byName = contacts.find((c) => c.name.toLowerCase() === routeDoctorName);
      if (byName) {
        setSelectedChatId(byName.id);
        return;
      }
    }

    const exists = contacts.some((c) => c.id === selectedChatId);
    if (!exists) {
      setSelectedChatId(contacts[0].id);
    }
  }, [contacts, route.params?.doctorId, route.params?.doctorName, selectedChatId]);

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
            const from = sender === 'paciente' ? 'me' : 'other';
            const createdMs = parseDateMs(rawMessage?.createdAt);
            const nextMessage: Message = {
              id: normalizeText(rawMessage?.mensajeId || `${Date.now()}-${Math.random()}`),
              from,
              text: normalizeText(rawMessage?.contenido),
              time: formatTimeLabel(createdMs),
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

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user?.plan]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => resolveAvatarSource(user?.fotoUrl), [user?.fotoUrl]);
  const hasProfilePhoto = useMemo(() => Boolean(sanitizeFotoUrl(user?.fotoUrl)), [user?.fotoUrl]);

  const filteredContacts = useMemo(() => {
    const query = normalizeText(searchText).toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      return (
        contact.name.toLowerCase().includes(query) ||
        contact.specialty.toLowerCase().includes(query)
      );
    });
  }, [contacts, searchText]);

  const selectedChat = useMemo(
    () => filteredContacts.find((chat) => chat.id === selectedChatId) ?? contacts.find((chat) => chat.id === selectedChatId) ?? filteredContacts[0] ?? contacts[0] ?? null,
    [contacts, filteredContacts, selectedChatId]
  );

  const messages = useMemo(() => {
    if (!selectedChat) return [] as Message[];
    const stored = messagesByChat[selectedChat.id] || [];
    if (stored.length) return stored;

    const intro: Message = {
      id: `intro-${selectedChat.id}`,
      from: 'other',
      text: `Hola, soy ${selectedChat.name}. Puedes escribirme por aqui para coordinar tu consulta.`,
      time: 'Ahora',
      dateLabel: 'Nuevo chat',
    };
    return [intro];
  }, [messagesByChat, selectedChat]);

  const handleSend = async () => {
    const text = reply.trim();
    if (!text || !selectedChat) return;

    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const response = await fetch(
        apiUrl(`/api/agenda/me/conversaciones/${selectedChat.id}/mensajes`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            contenido: text,
            tipo: 'texto',
          }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.mensaje) {
        return;
      }

      const createdAt = parseDateMs(payload?.mensaje?.createdAt);
      const nextMessage: Message = {
        id: normalizeText(payload?.mensaje?.mensajeId || `out-${Date.now()}`),
        from: 'me',
        text,
        time: formatTimeLabel(createdAt),
      };

      setMessagesByChat((prev) => ({
        ...prev,
        [selectedChat.id]: [...(prev[selectedChat.id] || []), nextMessage],
      }));
      setReply('');
      loadContacts();
    } catch {
      // noop
    }
  };

  const renderMenuItem = (
    icon: string,
    label: string,
    active = false,
    onPress?: () => void
  ) => (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        styles.menuItem,
        active && styles.menuItemActive,
        hovered && !active && styles.menuItemHover,
        pressed && styles.menuItemPressed,
      ]}
    >
      <MaterialIcons name={icon as any} size={20} color={active ? colors.primary : colors.muted} />
      <Text style={[styles.menuText, active && styles.menuTextActive]}>{label}</Text>
    </Pressable>
  );

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const navigateFromMenu = (
    routeName:
      | 'DashboardPaciente'
      | 'NuevaConsultaPaciente'
      | 'PacienteCitas'
      | 'SalaEsperaVirtualPaciente'
      | 'PacienteRecetasDocumentos'
      | 'PacientePerfil'
      | 'PacienteConfiguracion'
  ) => {
    closeMobileMenu();
    navigation.navigate(routeName);
  };

  return (
    <View style={[styles.container, isDesktopLayout ? styles.containerDesktop : styles.containerMobile]}>
      {!isDesktopLayout ? (
        <View style={styles.mobileMenuBar}>
          <TouchableOpacity style={styles.mobileMenuButton} onPress={toggleMobileMenu}>
            <MaterialIcons name={isMobileMenuOpen ? 'close' : 'menu'} size={22} color={colors.dark} />
            <Text style={styles.mobileMenuButtonText}>
              {isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {(isDesktopLayout || isMobileMenuOpen) && (
      <View style={[styles.sidebar, isDesktopLayout ? styles.sidebarDesktop : styles.sidebarMobile]}>
        <View>
          <View style={styles.logoBox}>
            <Image source={ViremLogo} style={styles.logo} />
            <View>
              <Text style={styles.logoTitle}>VIREM</Text>
              <Text style={styles.logoSubtitle}>Portal Paciente</Text>
            </View>
          </View>
          <View style={styles.userBox}>
            <Image source={userAvatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userPlan}>{planLabel}</Text>
            {!hasProfilePhoto ? (
              <Text style={styles.hintText}>No tienes foto. Ve a Perfil para agregarla.</Text>
            ) : null}
          </View>
          {renderMenuItem('grid-view', t('menu.home'), false, () => navigateFromMenu('DashboardPaciente'))}
          {renderMenuItem('person-search', t('menu.searchDoctor'), false, () => navigateFromMenu('NuevaConsultaPaciente'))}
          {renderMenuItem('calendar-today', t('menu.appointments'), false, () => navigateFromMenu('PacienteCitas'))}
          {renderMenuItem('videocam', t('menu.videocall'), false, () => navigateFromMenu('SalaEsperaVirtualPaciente'))}
          {renderMenuItem('chat-bubble', t('menu.chat'), true)}
          {renderMenuItem('description', t('menu.recipesDocs'), false, () => navigateFromMenu('PacienteRecetasDocumentos'))}
          {renderMenuItem('account-circle', t('menu.profile'), false, () => navigateFromMenu('PacientePerfil'))}
          {renderMenuItem('settings', t('menu.settings'), false, () => navigateFromMenu('PacienteConfiguracion'))}
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            closeMobileMenu();
            await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
            await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
        >
          <MaterialIcons name="logout" size={18} color="#fff" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
      </View>
      )}

      <View style={[styles.main, !isDesktopLayout ? styles.mainMobile : null]}>
        <View style={[styles.leftPanel, !isDesktopLayout ? styles.leftPanelMobile : null]}>
          <Text style={styles.sectionTitle}>Chats seguros</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar medico por nombre o especialidad"
            placeholderTextColor="#8aa7bf"
            value={searchText}
            onChangeText={setSearchText}
          />
          <ScrollView showsVerticalScrollIndicator={false}>
            {loadingUser || loadingContacts ? (
              <Text style={styles.loadingText}>Cargando chats...</Text>
            ) : !filteredContacts.length ? (
              <Text style={styles.loadingText}>No tienes medicos para chatear aun. Agenda una cita primero.</Text>
            ) : (
              filteredContacts.map((chat) => {
                const latest = (messagesByChat[chat.id] || []).slice(-1)[0];
                return (
                  <TouchableOpacity
                    key={chat.id}
                    style={[styles.chatRow, selectedChat?.id === chat.id && styles.chatRowActive]}
                    onPress={() => setSelectedChatId(chat.id)}
                    activeOpacity={0.88}
                  >
                    <Image source={resolveAvatarSource(chat.avatarUrl)} style={styles.chatAvatar} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.chatName}>{chat.name}</Text>
                        <Text style={styles.chatTime}>{latest?.time || chat.timeLabel}</Text>
                      </View>
                      <Text style={styles.chatMsg} numberOfLines={1}>
                        {latest?.text || `${chat.specialty} · ${chat.timeLabel}`}
                        {chat.unreadCount > 0 ? ` · ${chat.unreadCount} sin leer` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        <View style={styles.chatPanel}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderTitle}>
              {selectedChat ? `${selectedChat.name} · ${selectedChat.specialty}` : 'Selecciona un chat'}
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.messagesWrap} showsVerticalScrollIndicator={false}>
            {loadingMessages ? (
              <Text style={styles.loadingText}>Cargando mensajes...</Text>
            ) : (
              messages.map((msg) => (
                <View key={msg.id} style={[styles.msgWrap, msg.from === 'me' && styles.msgWrapMe]}>
                  {msg.dateLabel ? <Text style={styles.oldDateLabel}>{msg.dateLabel}</Text> : null}
                  <View style={[styles.msgBubble, msg.from === 'me' && styles.msgBubbleMe]}>
                    <Text style={[styles.msgText, msg.from === 'me' && styles.msgTextMe]}>{msg.text}</Text>
                  </View>
                  <Text style={styles.msgTime}>{msg.time}</Text>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder={selectedChat ? 'Escribe tu mensaje seguro aqui...' : 'Selecciona un chat para escribir'}
              placeholderTextColor="#8aa7bf"
              style={styles.input}
              multiline
              editable={Boolean(selectedChat)}
            />
            <TouchableOpacity style={[styles.sendBtn, !selectedChat && styles.sendBtnDisabled]} onPress={handleSend} disabled={!selectedChat}>
              <MaterialIcons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDesktop: { flexDirection: 'row' },
  containerMobile: { flexDirection: 'column' },
  mobileMenuBar: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  mobileMenuButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8e4f0',
    backgroundColor: colors.white,
  },
  mobileMenuButtonText: { color: colors.dark, fontWeight: '700', fontSize: 13 },
  sidebar: {
    backgroundColor: colors.white,
    justifyContent: 'space-between',
  },
  sidebarDesktop: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    padding: 20,
  },
  sidebarMobile: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    padding: 14,
  },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, resizeMode: 'contain' },
  logoTitle: { fontSize: 20, fontWeight: '800', color: colors.dark },
  logoSubtitle: { fontSize: 11, fontWeight: '700', color: colors.muted },
  userBox: { marginTop: 18, alignItems: 'center', paddingVertical: 12 },
  userAvatar: { width: 76, height: 76, borderRadius: 76, marginBottom: 10, borderWidth: 4, borderColor: '#f5f7fb' },
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14, textAlign: 'center' },
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  hintText: { marginTop: 6, color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuItemActive: {
    backgroundColor: 'rgba(19,127,236,0.10)',
    borderRightWidth: 3,
    borderRightColor: colors.primary,
  },
  menuItemHover: { backgroundColor: '#f4f8fc' },
  menuItemPressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  menuText: { fontSize: 14, color: colors.muted, fontWeight: '700' },
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
  main: { flex: 1, flexDirection: 'row', gap: 12, padding: 16 },
  mainMobile: { flexDirection: 'column' },
  leftPanel: { width: 320, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#deebf7', padding: 12 },
  leftPanelMobile: { width: '100%' },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: colors.dark, marginBottom: 10 },
  searchInput: { backgroundColor: '#f4f8fc', borderWidth: 1, borderColor: '#e3edf7', borderRadius: 10, height: 40, paddingHorizontal: 12, marginBottom: 12, color: colors.dark, fontWeight: '600' },
  loadingText: { color: colors.muted, fontWeight: '700', paddingVertical: 8, lineHeight: 18 },
  chatRow: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 10, marginBottom: 4 },
  chatRowActive: { backgroundColor: '#eef6ff' },
  chatAvatar: { width: 42, height: 42, borderRadius: 42 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontWeight: '800', color: colors.dark, fontSize: 14 },
  chatTime: { color: '#8aa7bf', fontSize: 10, fontWeight: '700' },
  chatMsg: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  chatPanel: { flex: 1, backgroundColor: '#f8fbff', borderRadius: 16, borderWidth: 1, borderColor: '#deebf7', overflow: 'hidden' },
  chatHeader: { height: 62, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5edf6', justifyContent: 'center', paddingHorizontal: 14 },
  chatHeaderTitle: { fontSize: 14, fontWeight: '900', color: colors.dark },
  messagesWrap: { padding: 12, gap: 10 },
  msgWrap: { maxWidth: '82%' },
  msgWrapMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  oldDateLabel: {
    alignSelf: 'center',
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#eef4fa',
    color: '#6f8aa4',
    fontSize: 10,
    fontWeight: '800',
  },
  msgBubble: { backgroundColor: '#fff', borderRadius: 14, borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#e2edf8', paddingHorizontal: 12, paddingVertical: 10 },
  msgBubbleMe: { backgroundColor: colors.primary, borderColor: colors.primary, borderTopLeftRadius: 14, borderTopRightRadius: 4 },
  msgText: { color: colors.dark, fontWeight: '600', fontSize: 13, lineHeight: 18 },
  msgTextMe: { color: '#fff' },
  msgTime: { marginTop: 3, fontSize: 10, color: '#8da8c0', fontWeight: '700' },
  inputRow: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5edf6', flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10 },
  input: { flex: 1, backgroundColor: '#f4f8fc', borderWidth: 1, borderColor: '#e3edf7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 120, fontSize: 13, fontWeight: '600', color: colors.dark },
  sendBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.55 },
});

export default PacienteChatScreen;




