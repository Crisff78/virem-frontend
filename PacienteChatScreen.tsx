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
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import PacienteHeader from './components/PacienteHeader';
import PacienteSidebar from './components/PacienteSidebar';
import { usePacienteModule, PacienteModuleProvider } from './navigation/PacienteModuleContext';
import { useResponsive } from './hooks/useResponsive';
import { useAuth } from './providers/AuthProvider';
import { apiClient } from './utils/api';
import { useSocketEvent } from './hooks/useSocketEvent';
import { useSocketRoom } from './hooks/useSocketRoom';
import type { RootStackParamList } from './navigation/types';

const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

type Message = {
  id: string;
  from: 'me' | 'other';
  text: string;
  time: string;
};

type ChatContact = {
  id: string;
  medicoId: string;
  name: string;
  especialidad: string;
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

const PacienteChatScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'PacienteChat'>>();
  const { user } = useAuth();
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
  const { isInsidePortal, isSidebarOpen, toggleSidebar } = usePacienteModule();
  const { isDesktop: isDesktopLayout } = useResponsive();

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
          const mId = normalizeText(conv?.medico?.medicoid);
          const convId = normalizeText(conv?.conversacionId);
          if (!mId || !convId) return null;
          return {
            id: convId,
            medicoId: mId,
            name: normalizeText(conv?.medico?.nombreCompleto || 'Medico'),
            especialidad: normalizeText(conv?.medico?.especialidad || 'Medicina General'),
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

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
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
        const from = sender === 'paciente' ? 'me' : 'other';
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
    if (!selectedChatId) return;
    loadMessages(selectedChatId);
  }, [loadMessages, selectedChatId]);

  useEffect(() => {
    const routeDoctorId = normalizeText(route.params?.doctorId);
    if (!routeDoctorId) return;

    const existing = contacts.find((c) => c.medicoId === routeDoctorId);
    if (existing) {
      setSelectedChatId(existing.id);
      setViewMode('chat');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const payload = await apiClient.post<any>('/api/agenda/me/conversaciones', {
          authenticated: true,
          body: { medicoId: routeDoctorId },
        });
        if (cancelled) return;
        if (payload?.success && payload?.conversacion?.conversacionId) {
          await loadContacts();
          setSelectedChatId(normalizeText(payload.conversacion.conversacionId));
          setViewMode('chat');
        }
      } catch (err: any) {
        if (cancelled) return;
        const message =
          err?.status === 403
            ? err?.data?.message ||
              'No puedes iniciar un chat con este medico hasta tener una consulta registrada.'
            : err?.data?.message || err?.message || 'No se pudo iniciar el chat.';
        Alert.alert('No se puede iniciar el chat', message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contacts, loadContacts, route.params?.doctorId]);

  useSocketRoom('conversation', selectedChatId, Boolean(selectedChatId));

  useSocketEvent('mensaje_nuevo', (payload: any) => {
    const conversationId = normalizeText(payload?.conversacionId);
    if (!conversationId) return;
    const rawMessage = payload?.mensaje;
    if (conversationId === selectedChatId && rawMessage) {
      const sender = normalizeText(rawMessage?.emisorTipo).toLowerCase();
      const from = sender === 'paciente' ? 'me' : 'other';
      const nextMessage: Message = {
        id: normalizeText(rawMessage?.mensajeId || `${Date.now()}-${Math.random()}`),
        from,
        text: normalizeText(rawMessage?.contenido),
        time: formatDateTime(rawMessage?.createdAt),
      };
      
      setMessagesByChat((prev) => {
        const current = prev[conversationId] || [];
        if (current.some((m) => m.id === nextMessage.id)) return prev;
        return { ...prev, [conversationId]: [...current, nextMessage] };
      });

      apiClient.patch(`/api/agenda/me/conversaciones/${conversationId}/leido`, {
        authenticated: true,
      }).catch(() => null);
    }
    loadContacts();
  });

  useSocketEvent('typing', (payload: any) => {
    const conversationId = normalizeText(payload?.conversacionId);
    if (conversationId === selectedChatId && normalizeText(payload?.emisorTipo).toLowerCase() !== 'paciente') {
      setIsTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
    }
  });

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setIsTyping(false);
  }, [selectedChatId]);

  const filteredContacts = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q));
  }, [contacts, searchText]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedChatId) || null,
    [contacts, selectedChatId]
  );

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

      setMessagesByChat((prev) => {
        const current = prev[selectedChatId] || [];
        if (current.some((m) => m.id === nextMessage.id)) return prev;
        return { ...prev, [selectedChatId]: [...current, nextMessage] };
      });
      setReply('');
      loadContacts();
    } catch (err: any) {
      const message =
        err?.status === 403
          ? err?.data?.message ||
            'No puedes enviar mensajes a este medico hasta tener una consulta registrada.'
          : err?.data?.message || err?.message || 'No se pudo enviar el mensaje.';
      Alert.alert('No se pudo enviar', message);
    }
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
        <View style={styles.headerWrap}>
          <PacienteHeader title="Mensajes" />
        </View>

        <View style={[styles.chatShell, !isDesktopLayout && styles.chatShellMobile]}>
          {(viewMode === 'list' || isDesktopLayout) && (
            <View style={[styles.contactsPane, !isDesktopLayout && styles.contactsPaneMobile]}>
              <View style={styles.searchRow}>
                <MaterialIcons name="search" size={18} color={colors.muted} />
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Buscar medico"
                  placeholderTextColor="#8ca7bd"
                  style={styles.searchInput}
                />
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                {loadingContacts ? <Text style={styles.loadingText}>Cargando medicos...</Text> : null}
                {!loadingContacts && !filteredContacts.length ? (
                  <Text style={styles.loadingText}>No tienes medicos para chat aun.</Text>
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
                          {chat.especialidad} · {chat.timeLabel}
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
                        {selectedContact.especialidad} · {selectedContact.status}
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
                    ) : !(messagesByChat[selectedChatId] || []).length ? (
                      <Text style={styles.emptyConversation}>
                        Inicia la conversacion con {selectedContact.name}.
                      </Text>
                    ) : (
                      (messagesByChat[selectedChatId] || []).map((message) => (
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
                  <Text style={styles.loadingText}>Selecciona un medico para iniciar chat.</Text>
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
  container: { flex: 1, backgroundColor: colors.bg },
  main: { flex: 1, paddingHorizontal: 20 },
  headerWrap: { paddingTop: Platform.OS === 'web' ? 32 : 14, paddingBottom: 12 },
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
  chatShellMobile: { flexDirection: 'column' },
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
  contactsPaneMobile: { width: '100%', borderRightWidth: 0, borderBottomWidth: 1 },
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
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
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
  backBtn: { padding: 4, marginRight: 6 },
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
  emptyChatState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});

const PacienteChatScreenWrapper: React.FC = (props) => (
  <PacienteModuleProvider initialModule="PacienteChat">
    <PacienteChatScreen {...props} />
  </PacienteModuleProvider>
);

export default PacienteChatScreenWrapper;
