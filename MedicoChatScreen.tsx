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
  useWindowDimensions,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { usePortalAwareMedicoNavigation } from './navigation/usePortalAwareMedicoNavigation';
import { useMedicoModule } from './navigation/MedicoModuleContext';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MedicoHeader from './components/MedicoHeader';
import { useMedicoPortalSession } from './hooks/useMedicoPortalSession';

import type { RootStackParamList } from './navigation/types';
import { useSocketEvent } from './hooks/useSocketEvent';
import { useSocketRoom } from './hooks/useSocketRoom';
import { useAuth } from './providers/AuthProvider';
import { apiClient } from './utils/api';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

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

const MedicoChatScreen: React.FC = () => {
  const navigation = usePortalAwareMedicoNavigation();
  const { isInsidePortal, isSidebarOpen, toggleSidebar } = useMedicoModule();
  const route = useRoute<RouteProp<RootStackParamList, 'MedicoChat'>>();
  const { user: sessionUser, signOut } = useAuth<SessionUser>();
  const { loadingUser, refreshUser, doctorName, doctorSpec, fotoUrl: doctorFotoUrl } =
    useMedicoPortalSession({ syncOnMount: true, addDoctorPrefix: true });
  const { width: viewportWidth } = useWindowDimensions();

  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [searchText, setSearchText] = useState('');
  const [reply, setReply] = useState('');
  const [selectedChatId, setSelectedChatId] = useState('');
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [viewMode, setViewMode] = useState<'list' | 'chat'>('list');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef(0);
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;

  const loadUser = useCallback(async () => {
    try {
      await refreshUser();
    } catch {
      // noop
    }
  }, [refreshUser]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const payload = await apiClient.get<any>('/api/agenda/me/conversaciones', {
        authenticated: true,
        query: { limit: 150 },
      });
      if (!(payload?.success && Array.isArray(payload?.conversaciones))) {
        setContacts([]);
        return;
      }

      // El servidor ya devuelve una conversacion por par paciente/medico
      const mapped: ChatContact[] = (payload.conversaciones as any[])
        .map((conv) => {
          const pId = normalizeText(conv?.paciente?.pacienteid);
          const convId = normalizeText(conv?.conversacionId);
          if (!pId || !convId) return null;
          return {
            id: convId,
            patientId: pId,
            name: normalizeText(conv?.paciente?.nombreCompleto || 'Paciente'),
            status: normalizeText(conv?.cita?.estadoCodigo || 'sin cita'),
            citaId: normalizeText(conv?.citaId),
            unreadCount: Number(conv?.unreadCount || 0),
            nextDateMs: parseDateMs(conv?.cita?.fechaHoraInicio || null),
            timeLabel: conv?.cita?.fechaHoraInicio
              ? formatDateTime(conv?.cita?.fechaHoraInicio)
              : 'Sin cita programada',
          } as ChatContact;
        })
        .filter((c): c is ChatContact => Boolean(c))
        .sort((a, b) => {
          if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
          return a.nextDateMs - b.nextDateMs;
        });

      setContacts(mapped);
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
      const payload = await apiClient.get<any>(
        `/api/agenda/me/conversaciones/${cleanConversationId}/mensajes`,
        {
          authenticated: true,
          query: { limit: 120 },
        }
      );
      if (!(payload?.success && Array.isArray(payload?.mensajes))) {
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

      await apiClient.patch(`/api/agenda/me/conversaciones/${cleanConversationId}/leido`, {
        authenticated: true,
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

    if (routePatientId) {
      const byPatientId = contacts.find((c) => normalizeText(c.patientId) === routePatientId);
      if (byPatientId) {
        setSelectedChatId(byPatientId.id);
        setViewMode('chat');
        return;
      }
      // No existe conversacion aun: la creamos con el endpoint del backend
      let cancelled = false;
      (async () => {
        try {
          const payload = await apiClient.post<any>('/api/agenda/me/conversaciones', {
            authenticated: true,
            body: { pacienteId: routePatientId },
          });
          if (cancelled) return;
          if (payload?.success && payload?.conversacion?.conversacionId) {
            await loadContacts();
            setSelectedChatId(normalizeText(payload.conversacion.conversacionId));
            setViewMode('chat');
          }
        } catch {
          // noop
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (!contacts.length) {
      setSelectedChatId('');
      return;
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

    const exists = contacts.some((c) => c.id === selectedChatId);
    if (!exists && contacts.length > 0) {
      if (viewMode === 'chat') setViewMode('list');
    }
  }, [
    contacts,
    loadContacts,
    route.params?.patientId,
    route.params?.patientName,
    selectedChatId,
    viewMode,
  ]);

  useEffect(() => {
    if (!selectedChatId) return;
    loadMessages(selectedChatId);
  }, [loadMessages, selectedChatId]);

  const appendMessage = useCallback((conversationId: string, nextMessage: Message) => {
    const cleanConversationId = normalizeText(conversationId);
    if (!cleanConversationId || !nextMessage.id) return;

    setMessagesByChat((prev) => {
      const current = prev[cleanConversationId] || [];
      if (current.some((message) => message.id === nextMessage.id)) {
        return prev;
      }

      return {
        ...prev,
        [cleanConversationId]: [...current, nextMessage],
      };
    });
  }, []);

  useSocketRoom('conversation', selectedChatId, Boolean(selectedChatId));

  useSocketEvent('mensaje_nuevo', (payload: any) => {
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
      appendMessage(conversationId, nextMessage);
      apiClient.patch(`/api/agenda/me/conversaciones/${conversationId}/leido`, {
        authenticated: true,
      }).catch(() => null);
    }
    scheduleContactsReload();
  });
  
  useSocketEvent('typing', (payload: any) => {
    const conversationId = normalizeText(payload?.conversacionId);
    if (conversationId === selectedChatId && normalizeText(payload?.emisorTipo).toLowerCase() !== 'medico') {
      setIsTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
    }
  });

  useSocketEvent('cita_actualizada', () => scheduleContactsReload());

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const filteredContacts = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) => normalizeText(contact.name).toLowerCase().includes(q));
  }, [contacts, searchText]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedChatId) || null,
    [contacts, selectedChatId]
  );

  const currentMessages = messagesByChat[selectedChatId] || [];

  const sendMessage = async () => {
    const text = normalizeText(reply);
    if (!text || !selectedChatId) return;

    try {
      const payload = await apiClient.post<any>(
        `/api/agenda/me/conversaciones/${selectedChatId}/mensajes`,
        {
          authenticated: true,
          body: { contenido: text, tipo: 'texto' },
        }
      );
      if (!payload?.success || !payload?.mensaje) {
        Alert.alert('No se pudo enviar', payload?.message || 'No se pudo enviar el mensaje.');
        return;
      }

      const nextMessage: Message = {
        id: normalizeText(payload?.mensaje?.mensajeId || `${Date.now()}`),
        from: 'me',
        text,
        time: formatDateTime(payload?.mensaje?.createdAt),
      };

      appendMessage(selectedChatId, nextMessage);
      setReply('');
      loadContacts();
    } catch (err: any) {
      const message = err?.data?.message || err?.message || 'No se pudo enviar el mensaje.';
      Alert.alert('No se pudo enviar', message);
    }
  };

  useEffect(() => {
    setIsTyping(false);
  }, [selectedChatId]);

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.loadingText}>Cargando chat medico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <View style={styles.headerWrap}>
          <MedicoHeader title="Mensajes" />
        </View>

        <View style={[styles.chatShell, !isDesktopLayout && styles.chatShellMobile]}>
          {(viewMode === 'list' || isDesktopLayout) && (
            <View style={[styles.contactsPane, !isDesktopLayout && styles.contactsPaneMobile]}>
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
                      onPress={() => {
                        setSelectedChatId(chat.id);
                        setViewMode('chat');
                      }}
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
          )}

          {(viewMode === 'chat' || isDesktopLayout) && (
            <View style={styles.messagesPane}>
              {selectedContact ? (
                <>
                  <View style={styles.chatHeader}>
                    {!isDesktopLayout && (
                      <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('list')}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.dark} />
                      </TouchableOpacity>
                    )}
                    <Image source={DefaultAvatar} style={styles.chatHeaderAvatar} />
                    <View>
                      <Text style={styles.chatHeaderName}>{selectedContact.name}</Text>
                      <Text style={styles.chatHeaderSub}>
                        Ultima referencia: {selectedContact.status} · {selectedContact.timeLabel}
                      </Text>
                    </View>
                  </View>

                  {isTyping && selectedContact && (
                    <View style={styles.typingBar}>
                      <View style={styles.typingDots}>
                        <View style={styles.typingDot} /><View style={[styles.typingDot, styles.typingDot2]} /><View style={[styles.typingDot, styles.typingDot3]} />
                      </View>
                      <Text style={styles.typingText}>{selectedContact.name.split(' ')[0]} está escribiendo…</Text>
                    </View>
                  )}

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
                          style={[styles.msgWrap, message.from === 'me' && styles.msgWrapMe]}
                        >
                          <View style={[styles.msgBubble, message.from === 'me' && styles.msgBubbleMe]}>
                            <Text style={[styles.msgText, message.from === 'me' && styles.msgTextMe]}>
                              {message.text}
                            </Text>
                            <View style={styles.msgMetaRow}>
                              <Text style={[styles.msgTime, message.from === 'me' && styles.msgTimeMe]}>
                                {message.time}
                              </Text>
                              {message.from === 'me' && (
                                <MaterialIcons 
                                  name="done" 
                                  size={14} 
                                  color={colors.muted} 
                                  style={{ marginLeft: 4 }}
                                />
                              )}
                            </View>
                          </View>
                        </View>
                      ))
                    )}
                  </ScrollView>

                  <View style={styles.inputRow}>
                    <TouchableOpacity style={styles.attachBtn}>
                      <MaterialIcons name="insert-emoticon" size={24} color={colors.muted} />
                    </TouchableOpacity>
                    <TextInput
                      value={reply}
                      onChangeText={setReply}
                      placeholder={`Escribe a ${selectedContact.name}`}
                      placeholderTextColor="#8ca7bd"
                      style={styles.replyInput}
                      editable={Boolean(selectedContact)}
                      multiline
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
                  <MaterialIcons name="chat" size={48} color="#e1edf8" />
                  <Text style={styles.loadingText}>Selecciona un paciente para iniciar chat.</Text>
                </View>
              )}
            </View>
          )}
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
  bubbleMe: '#137fec',
  bubbleOther: '#E1EDF8',
  chatBg: '#F8FBFF',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  main: { flex: 1, paddingHorizontal: 20 },
  headerWrap: {
    paddingTop: Platform.OS === 'web' ? 32 : 14,
    paddingBottom: 12,
  },
  chatShell: {
    flex: 1,
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe8f5',
    overflow: 'hidden',
    backgroundColor: '#fff',
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  chatShellMobile: {
    flexDirection: 'column',
  },
  contactsPane: {
    width: Platform.OS === 'web' ? 320 : '100%',
    flex: 1,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderRightColor: '#e4edf7',
    borderBottomColor: '#e4edf7',
    padding: 12,
    backgroundColor: '#f8fbff',
  },
  contactsPaneMobile: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
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
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  contactRowActive: { borderColor: colors.primary, backgroundColor: '#eef6ff' },
  contactAvatar: { width: 42, height: 42, borderRadius: 42 },
  contactName: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  contactNameActive: { color: colors.primary },
  contactMeta: { color: colors.muted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  messagesPane: { flex: 1, padding: 12, backgroundColor: colors.chatBg },
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
  msgWrap: { maxWidth: '85%', marginBottom: 6, alignSelf: 'flex-start' },
  msgWrapMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgBubble: { 
    backgroundColor: colors.bubbleOther, 
    borderRadius: 16, 
    borderTopLeftRadius: 4, 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    shadowColor: '#000', 
    shadowOpacity: 0.03, 
    shadowRadius: 3, 
    elevation: 1 
  },
  msgBubbleMe: { 
    backgroundColor: colors.bubbleMe, 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 4,
  },
  msgText: { color: colors.dark, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  msgTime: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  msgTimeMe: { color: 'rgba(255,255,255,0.8)' },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    backgroundColor: '#fff', 
    gap: 8,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e1edf8'
  },
  replyInput: { 
    flex: 1, 
    backgroundColor: '#f1f5fb', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    fontSize: 14, 
    color: colors.dark, 
    maxHeight: 100 
  },
  sendBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: colors.primary, 
    alignItems: 'center', 
    justifyContent: 'center', 
    elevation: 2 
  },
  sendBtnDisabled: { opacity: 0.6, backgroundColor: '#8aa7bf' },
  attachBtn: { padding: 8 },
  typingBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    backgroundColor: 'rgba(255,255,255,0.8)', 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginTop: 4
  },
  typingDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, opacity: 0.5 },
  typingDot2: { opacity: 0.7 },
  typingDot3: { opacity: 0.9 },
  typingText: { fontSize: 11, fontWeight: '700', color: colors.muted, fontStyle: 'italic' },
  backBtn: {
    padding: 4,
    marginRight: 6,
  },
  emptyChatState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});

export default MedicoChatScreen;
