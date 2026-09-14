import { apiClient } from '../utils/api';
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { useMedicoModule } from '../navigation/MedicoModuleContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useLanguage } from '../localization/LanguageContext';
import { apiUrl } from '../config/backend';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { getAuthToken } from '../utils/session';
import { useResponsive } from '../hooks/useResponsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Platform.OS === 'web' ? 280 : SCREEN_WIDTH * 0.85;

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

const toRelativeTime = (value: string | null | undefined) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Ahora';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return 'hace segs';
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour}h`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `hace ${diffDay}d`;
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
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
  if (tipo.includes('mensaje')) return { icon: 'mail', color: '#137fec', action: 'Responder' };
  if (tipo.includes('video')) return { icon: 'videocam', color: '#137fec', action: 'Entrar' };
  if (tipo.includes('reprogram')) return { icon: 'update', color: '#137fec', action: 'Ver' };
  if (tipo.includes('cancel')) return { icon: 'event-busy', color: '#ef4444', action: 'Ver' };
  return { icon: 'notifications', color: '#137fec', action: 'Ver' };
};

const mapNotification = (item: AgendaNotification): NotificationItem => {
  const createdAt = item?.createdAt || null;
  const iconData = mapIcon(String(item?.tipo || ''));
  return {
    id: normalizeText(item?.id || ''),
    title: normalizeText(item?.titulo || 'Notificación'),
    message: normalizeText(item?.contenido || ''),
    time: toRelativeTime(createdAt),
    unread: !Boolean(item?.leida),
    icon: iconData.icon,
    color: iconData.color,
    section: resolveSection(createdAt),
    type: mapApiType(String(item?.tipo || '')),
    action: iconData.action,
    createdAt,
  };
};

const MedicoNotificationDrawer: React.FC = () => {
  const { isNotificationOpen, toggleNotification, portalNavigate } = useMedicoModule();
  const { t } = useLanguage();
  const { rs, fs } = useResponsive();
  
  const [activeFilter, setActiveFilter] = useState<FilterType>('todas');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  const [visible, setVisible] = useState(isNotificationOpen);

  useEffect(() => {
    if (isNotificationOpen) setVisible(true);
    Animated.timing(slideAnim, {
      toValue: isNotificationOpen ? 0 : DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (!isNotificationOpen) setVisible(false);
    });
    if (isNotificationOpen) {
      loadNotifications();
    }
  }, [isNotificationOpen]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const response = await apiClient.fetch(apiUrl('/api/agenda/me/notificaciones?limit=80'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (payload?.success && Array.isArray(payload.notificaciones)) {
        const normalized = payload.notificaciones.map(mapNotification).filter((n: any) => n.id);
        setNotifications(normalized.sort((a: any, b: any) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        ));
      }
    } catch (e) {
      console.error('Drawer error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useSocketEvent('notificacion_nueva', loadNotifications);

  const filtered = useMemo(() => {
    const text = normalizeText(searchText).toLowerCase();
    let base = notifications;
    if (activeFilter === 'noleidas') base = base.filter(n => n.unread);
    else if (activeFilter !== 'todas') base = base.filter(n => n.type === activeFilter);
    if (!text) return base;
    return base.filter(n => n.title.toLowerCase().includes(text) || n.message.toLowerCase().includes(text));
  }, [activeFilter, notifications, searchText]);

  const grouped = useMemo(() => {
    return sectionOrder.map(section => ({
      section,
      items: filtered.filter(item => item.section === section),
    }));
  }, [filtered]);

  const markAllRead = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await apiClient.fetch(apiUrl('/api/agenda/me/notificaciones/leer-todas'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    } catch (e) {}
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      await apiClient.fetch(apiUrl(`/api/agenda/me/notificaciones/${id}/leida`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    } catch (e) {}
  }, []);

  const handleAction = (item: NotificationItem) => {
    markOneRead(item.id);
    toggleNotification();
    if (item.type === 'mensajes') portalNavigate('MedicoChat');
    else portalNavigate('MedicoCitas');
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isNotificationOpen ? 'auto' : 'none'}>
      <Pressable style={styles.overlay} onPress={toggleNotification}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', opacity: slideAnim.interpolate({ inputRange: [0, DRAWER_WIDTH], outputRange: [1, 0] }) }} />
      </Pressable>

      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontSize: fs(20) }]}>{t('notif.center')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={markAllRead} style={styles.markAllHeaderBtn}>
              <Text style={styles.markAllHeaderText}>Marcar leído</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleNotification} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#0A1931" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color="#4A7FA7" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar..."
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {['todas', 'citas', 'mensajes', 'noleidas'].map((f) => (
            <TouchableOpacity 
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f as FilterType)}
            >
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
                {f === 'todas' ? 'Todas' : f === 'citas' ? 'Citas' : f === 'mensajes' ? 'Chat' : 'Sin leer'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.list} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {grouped.map((group) => group.items.length > 0 && (
            <View key={group.section} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{
                  group.section === 'HOY' ? 'Hoy' :
                  group.section === 'AYER' ? 'Ayer' :
                  group.section === 'ESTA SEMANA' ? 'Esta semana' : 'Anterior'
                }</Text>
              </View>
              {group.items.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.card, !item.unread && styles.cardRead]}
                  onPress={() => handleAction(item)}
                >
                  <View style={[styles.bar, { backgroundColor: item.color }]} />
                  <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                    <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, !item.unread && styles.cardTitleRead]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.cardMsg, !item.unread && styles.cardMsgRead]} numberOfLines={2}>{item.message}</Text>
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardTime}>{item.time}</Text>
                      {item.unread && <View style={styles.unreadDot} />}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {filtered.length === 0 && !loading && (
            <View style={styles.empty}>
              <MaterialIcons name="notifications-none" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>No hay notificaciones</Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#F6FAFD',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontWeight: '900', color: '#0A1931' },
  closeBtn: { padding: 4 },
  controls: { padding: 20, paddingBottom: 10 },
  searchBox: {
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0A1931' },
  filters: { maxHeight: 50, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 36,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: '#137fec', borderColor: '#137fec' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#7b96ad' },
  filterChipTextActive: { color: '#fff' },
  list: { flex: 1 },
  section: { marginBottom: 24 },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 12 
  },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#9bb1c7', letterSpacing: 1 },
  markAllHeaderBtn: { backgroundColor: '#137fec15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  markAllHeaderText: { fontSize: 11, fontWeight: '800', color: '#137fec' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
    overflow: 'hidden',
  },
  cardRead: { backgroundColor: '#f9fbff', borderColor: '#f1f5f9', opacity: 0.8 },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0A1931' },
  cardTitleRead: { color: '#64748b' },
  cardMsg: { fontSize: 13, color: '#475569', marginTop: 2, lineHeight: 18 },
  cardMsgRead: { color: '#94a3b8' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cardTime: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#137fec' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#94a3b8', fontSize: 14, fontWeight: '600', marginTop: 12 },
});

export default MedicoNotificationDrawer;
