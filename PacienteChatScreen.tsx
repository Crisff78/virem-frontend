import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { useLanguage } from './localization/LanguageContext';
import type { RootStackParamList } from './navigation/types';

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
  plan?: string;
  fotoUrl?: string;
};

type Message = { id: string; from: 'me' | 'other'; text: string; time: string; dateLabel?: string };

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
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

const chatList: Array<{
  id: string;
  name: string;
  msg: string;
  time: string;
  online?: boolean;
  avatar: ImageSourcePropType;
}> = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    msg: 'La receta fue actualizada.',
    time: '10:24 AM',
    online: true,
    avatar: { uri: 'https://i.pravatar.cc/150?img=47' },
  },
  {
    id: '2',
    name: 'Dr. Michael Chen',
    msg: 'Revisar laboratorio #402.',
    time: '9:45 AM',
    avatar: { uri: 'https://i.pravatar.cc/150?img=12' },
  },
  {
    id: '3',
    name: 'Robert Miller',
    msg: 'Gracias por la consulta.',
    time: 'Ayer',
    avatar: { uri: 'https://i.pravatar.cc/150?img=15' },
  },
  {
    id: '4',
    name: 'Elena Rodríguez',
    msg: 'Nuevo reporte médico.',
    time: 'Lunes',
    avatar: { uri: 'https://i.pravatar.cc/150?img=48' },
  },
];

const initialMessages: Message[] = [
  { id: 'm1', from: 'other', text: 'Hola doctor, tengo una molestia en el tobillo.', time: '10:12 AM' },
  { id: 'm2', from: 'me', text: 'No subas dosis todavía. ¿Sientes dolor intenso?', time: '10:15 AM' },
  { id: 'm3', from: 'other', text: 'Es leve, te comparto foto en un momento.', time: '10:20 AM' },
];

const PacienteChatScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const [, setLoadingUser] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [reply, setReply] = useState('');
  const [selectedChatId, setSelectedChatId] = useState('1');

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (Platform.OS === 'web') {
          const webUser = parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY));
          if (webUser) {
            setUser(webUser);
            return;
          }
        }
        const secureUser = parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY));
        if (secureUser) {
          setUser(secureUser);
          return;
        }
        setUser(parseUser(await AsyncStorage.getItem(STORAGE_KEY)));
      } catch {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };
    loadUser();
  }, []);

  const fullName = useMemo(() => {
    const nombres = (user?.nombres || user?.nombre || user?.firstName || '').trim();
    const apellidos = (user?.apellidos || user?.apellido || user?.lastName || '').trim();
    const name = `${nombres} ${apellidos}`.trim();
    return name || 'Paciente';
  }, [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user?.plan]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    if (user?.fotoUrl && user.fotoUrl.trim().length > 0) return { uri: user.fotoUrl.trim() };
    return DefaultAvatar;
  }, [user?.fotoUrl]);

  const selectedChat = useMemo(
    () => chatList.find((chat) => chat.id === selectedChatId) ?? chatList[0],
    [selectedChatId]
  );

  const messages = useMemo(() => {
    if (selectedChatId === '2') {
      return [
        {
          id: 'm4',
          from: 'other',
          text: 'Solicito revisión del paciente #402.',
          time: '9:35 AM',
          dateLabel: 'Hoy, 9:35 AM',
        },
      ];
    }
    if (selectedChatId === '3') {
      return [
        {
          id: 'm5',
          from: 'other',
          text: 'Gracias por la consulta y recomendaciones.',
          time: '8:10 PM',
          dateLabel: 'Ayer, 8:10 PM',
        },
      ];
    }
    if (selectedChatId === '4') {
      return [
        {
          id: 'm6',
          from: 'other',
          text: 'Doctor, subí un nuevo reporte médico al sistema.',
          time: '3:45 PM',
          dateLabel: 'Lunes, 3:45 PM',
        },
      ];
    }
    return initialMessages;
  }, [selectedChatId]);

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
      <MaterialIcons name={icon} size={20} color={active ? colors.primary : colors.muted} />
      <Text style={[styles.menuText, active && styles.menuTextActive]}>{label}</Text>
    </Pressable>
  );

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
            <Image source={userAvatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userPlan}>{planLabel}</Text>
          </View>
          {renderMenuItem('grid-view', t('menu.home'), false, () => navigation.navigate('DashboardPaciente'))}
          {renderMenuItem('person-search', t('menu.searchDoctor'))}
          {renderMenuItem('calendar-today', t('menu.appointments'))}
          {renderMenuItem('videocam', t('menu.videocall'))}
          {renderMenuItem('chat-bubble', t('menu.chat'), true)}
          {renderMenuItem('description', t('menu.recipesDocs'), false, () => navigation.navigate('PacienteRecetasDocumentos'))}
          {renderMenuItem('account-circle', t('menu.profile'), false, () => navigation.navigate('PacientePerfil'))}
          {renderMenuItem('settings', t('menu.settings'), false, () => navigation.navigate('PacienteConfiguracion'))}
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            await AsyncStorage.removeItem('token');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
        >
          <MaterialIcons name="logout" size={18} color="#fff" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        <View style={styles.leftPanel}>
          <Text style={styles.sectionTitle}>Chats seguros</Text>
          <TextInput style={styles.searchInput} placeholder="Buscar pacientes o doctores" placeholderTextColor="#8aa7bf" />
          <ScrollView showsVerticalScrollIndicator={false}>
            {chatList.map((chat) => (
              <TouchableOpacity
                key={chat.id}
                style={[styles.chatRow, selectedChatId === chat.id && styles.chatRowActive]}
                onPress={() => setSelectedChatId(chat.id)}
                activeOpacity={0.88}
              >
                <Image source={chat.avatar ?? DefaultAvatar} style={styles.chatAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.chatName}>{chat.name}</Text>
                    <Text style={styles.chatTime}>{chat.time}</Text>
                  </View>
                  <Text style={styles.chatMsg} numberOfLines={1}>{chat.msg}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.chatPanel}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderTitle}>
              {selectedChat.name} • {selectedChat.id === '1' ? 'En línea' : 'Disponible'}
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.messagesWrap} showsVerticalScrollIndicator={false}>
            {messages.map((msg) => (
              <View key={msg.id} style={[styles.msgWrap, msg.from === 'me' && styles.msgWrapMe]}>
                {msg.dateLabel ? <Text style={styles.oldDateLabel}>{msg.dateLabel}</Text> : null}
                <View style={[styles.msgBubble, msg.from === 'me' && styles.msgBubbleMe]}>
                  <Text style={[styles.msgText, msg.from === 'me' && styles.msgTextMe]}>{msg.text}</Text>
                </View>
                <Text style={styles.msgTime}>{msg.time}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Escribe tu mensaje seguro aquí..."
              placeholderTextColor="#8aa7bf"
              style={styles.input}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn}>
              <MaterialIcons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column', backgroundColor: colors.bg },
  sidebar: {
    width: Platform.OS === 'web' ? 280 : '100%',
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    padding: 20,
    justifyContent: 'space-between',
  },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, resizeMode: 'contain' },
  logoTitle: { fontSize: 20, fontWeight: '800', color: colors.dark },
  logoSubtitle: { fontSize: 11, fontWeight: '700', color: colors.muted },
  userBox: { marginTop: 18, alignItems: 'center', paddingVertical: 12 },
  userAvatar: { width: 76, height: 76, borderRadius: 76, marginBottom: 10, borderWidth: 4, borderColor: '#f5f7fb' },
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14, textAlign: 'center' },
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
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
  main: { flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 12, padding: 16 },
  leftPanel: { width: Platform.OS === 'web' ? 320 : '100%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#deebf7', padding: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: colors.dark, marginBottom: 10 },
  searchInput: { backgroundColor: '#f4f8fc', borderWidth: 1, borderColor: '#e3edf7', borderRadius: 10, height: 40, paddingHorizontal: 12, marginBottom: 12, color: colors.dark, fontWeight: '600' },
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
});

export default PacienteChatScreen;

