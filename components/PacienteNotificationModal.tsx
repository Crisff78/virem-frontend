import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useResponsive } from '../hooks/useResponsive';
import { apiClient } from '../utils/api';
import colors from '../theme/colors';

type NotificationItem = {
  id: string;
  titulo: string;
  contenido: string;
  leida: boolean;
  createdAt: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PacienteNotificationModal: React.FC<Props> = ({ visible, onClose }) => {
  const { rs, fs } = useResponsive();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<any>('/api/agenda/me/notificaciones', { 
        authenticated: true, 
        query: { limit: 20 } 
      });
      if (response?.success) {
        setNotifications(response.notificaciones || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    try {
      await apiClient.put(`/api/agenda/me/notificaciones/${id}/leer`, { authenticated: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.drawer, styles.drawerRight, { width: rs(340) }]}>
          <View style={styles.drawerHeader}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="notifications" size={24} color={colors.primary} />
              <Text style={[styles.drawerTitle, { fontSize: fs(18) }]}>Notificaciones</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color={colors.dark} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {loading && notifications.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.infoText}>Cargando...</Text>
              </View>
            ) : notifications.length > 0 ? (
              notifications.map((n) => (
                <TouchableOpacity 
                  key={n.id} 
                  style={[styles.notifItem, !n.leida && styles.notifUnread]}
                  onPress={() => !n.leida && markAsRead(n.id)}
                >
                  <View style={styles.notifHeader}>
                    <Text style={styles.notifTitle}>{n.titulo}</Text>
                    {!n.leida && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifMsg} numberOfLines={3}>{n.contenido}</Text>
                  <Text style={styles.notifTime}>Reciente</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <MaterialIcons name="notifications-none" size={48} color={colors.muted} />
                </View>
                <Text style={styles.emptyTitle}>Sin notificaciones</Text>
                <Text style={styles.emptySub}>Te avisaremos cuando tengas novedades sobre tus citas o recetas.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default PacienteNotificationModal;

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawer: {
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  drawerRight: {
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerTitle: {
    fontWeight: '900',
    color: colors.dark,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  infoText: {
    color: colors.muted,
    fontWeight: '600',
  },
  notifItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  notifUnread: {
    backgroundColor: 'rgba(19,127,236,0.04)',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontWeight: '800',
    color: colors.dark,
    fontSize: 14,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  notifMsg: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  notifTime: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 8,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
