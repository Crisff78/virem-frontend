import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Share,
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { useLanguage } from './localization/LanguageContext';
import type { RootStackParamList } from './navigation/types';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');
const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  light: '#B3CFE5',
  white: '#FFFFFF',
};

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

type DocumentItem = {
  title: string;
  doctor: string;
  date: string;
  icon: string;
  tint: string;
  bg: string;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const recetas: DocumentItem[] = [
  {
    title: 'Tratamiento Hipertensión',
    doctor: 'Dr. Alejandro García',
    date: 'Emitido el 15 Oct, 2023',
    icon: 'picture-as-pdf',
    tint: '#ef4444',
    bg: '#fef2f2',
  },
  {
    title: 'Receta_Gripe_Estacional',
    doctor: 'Dra. Marta Sánchez',
    date: 'Emitido el 12 Oct, 2023',
    icon: 'picture-as-pdf',
    tint: '#ef4444',
    bg: '#fef2f2',
  },
  {
    title: 'Antibióticos_Amoxicilina',
    doctor: 'Dr. Ricardo Ruiz',
    date: 'Emitido el 05 Sep, 2023',
    icon: 'picture-as-pdf',
    tint: '#ef4444',
    bg: '#fef2f2',
  },
];

const certificados: DocumentItem[] = [
  {
    title: 'Certificado de Aptitud Física',
    doctor: 'Dr. Ricardo Ruiz',
    date: 'Emitido el 01 Ago, 2023',
    icon: 'description',
    tint: '#1A3D63',
    bg: '#eef4fb',
  },
];

const sanitizeFileName = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-]/g, '');

const buildDocumentContent = (item: DocumentItem) =>
  `VIREM - Documento de ejemplo\n\nTítulo: ${item.title}\nEmitido por: ${item.doctor}\nFecha: ${item.date}\n\nNota: Este archivo es una demostración de descarga para pruebas de interfaz.`;

const downloadExampleDocument = (item: DocumentItem) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([buildDocumentContent(item)], {
      type: 'text/plain;charset=utf-8',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(item.title)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return;
  }

  Share.share({
    title: item.title,
    message: `${buildDocumentContent(item)}\n\n(Documento de ejemplo VIREM)`,
  }).catch(() => {
    Alert.alert('Error', 'No se pudo compartir el documento en este dispositivo.');
  });
};

const DocumentRow: React.FC<{ item: DocumentItem }> = ({ item }) => (
  <TouchableOpacity
    style={styles.docCard}
    activeOpacity={0.9}
    onPress={() => downloadExampleDocument(item)}
  >
    <View style={[styles.docIconWrap, { backgroundColor: item.bg }]}>
      <MaterialIcons name={item.icon} size={20} color={item.tint} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.docTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.docSub} numberOfLines={1}>
        {item.doctor}
      </Text>
      <Text style={styles.docMeta}>{item.date}</Text>
    </View>
    <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadExampleDocument(item)}>
      <MaterialIcons name="download" size={18} color={colors.blue} />
    </TouchableOpacity>
  </TouchableOpacity>
);

const SectionBlock: React.FC<{
  icon: string;
  title: string;
  count: string;
  items: DocumentItem[];
}> = ({ icon, title, count, items }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadLeft}>
        <View style={styles.sectionIcon}>
          <MaterialIcons name={icon} size={18} color={colors.blue} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
    <View style={styles.sectionGrid}>
      {items.map((item) => (
        <DocumentRow key={item.title} item={item} />
      ))}
    </View>
  </View>
);

const PacienteRecetasDocumentosScreen: React.FC = () => {

  const { t, tx } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (Platform.OS === 'web') {
          const localStorageUser = ensurePatientSessionUser(
            parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY))
          );
          if (localStorageUser) {
            setUser(localStorageUser);
            return;
          }
        }
        const secureStoreUser = ensurePatientSessionUser(
          parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY))
        );
        if (secureStoreUser) {
          setUser(secureStoreUser);
          return;
        }
        const asyncUser = ensurePatientSessionUser(parseUser(await AsyncStorage.getItem(STORAGE_KEY)));
        setUser(asyncUser);
      } catch {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };
    loadUser();
  }, []);

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    if (user?.fotoUrl && user.fotoUrl.trim().length > 0) return { uri: user.fotoUrl.trim() };
    return DefaultAvatar;
  }, [user]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem(STORAGE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Cargando tus documentos...</Text>
      </View>
    );
  }

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
              <Text style={styles.menuText}>Buscar Médico</Text>
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
              onPress={() => navigation.navigate('PacienteChat')}
            >
              <MaterialIcons name="chat-bubble" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.chat')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('PacienteRecetasDocumentos')}
            >
              <MaterialIcons name="description" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>{t('menu.recipesDocs')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacientePerfil')}
            >
              <MaterialIcons name="account-circle" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.profile')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              placeholder="Buscar por nombre o fecha..."
              placeholderTextColor="#8aa7bf"
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() =>
              Alert.alert(
                'Filtros',
                'Puedes buscar por nombre o fecha usando la barra de busqueda.'
              )
            }
          >
            <MaterialIcons name="filter-list" size={16} color="#fff" />
            <Text style={styles.filterBtnText}>Filtrar</Text>
          </TouchableOpacity>
        </View>

          <Text style={styles.pageTitle}>
            {tx({
              es: 'Mis Recetas y Documentos',
              en: 'My Prescriptions and Documents',
              pt: 'Minhas Receitas e Documentos',
            })}
          </Text>
        <Text style={styles.pageSubtitle}>
          Accede y descarga tu historial médico organizado por categorías.
        </Text>

        <SectionBlock icon="description" title="Recetas Médicas" count="3 ARCHIVOS" items={recetas} />
        <SectionBlock
          icon="verified"
          title="Certificados y Otros"
          count="1 ARCHIVO"
          items={certificados}
        />

        <View style={styles.noticeCard}>
          <MaterialIcons name="info-outline" size={18} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Nota sobre la privacidad</Text>
            <Text style={styles.noticeText}>
              Tus documentos médicos están encriptados y protegidos. Solo tú y tus médicos
              autorizados tienen acceso a esta información.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: colors.bg,
  },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loaderText: { marginTop: 10, color: colors.muted, fontWeight: '700' },
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
  userAvatar: { width: 76, height: 76, borderRadius: 76, marginBottom: 10, borderWidth: 4, borderColor: '#f5f7fb' },
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
  menuItemActive: { backgroundColor: 'rgba(19,127,236,0.10)', borderRightWidth: 3, borderRightColor: colors.primary },
  menuText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  menuTextActive: { color: colors.primary },
  logoutButton: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue, paddingVertical: 12, borderRadius: 12 },
  logoutText: { color: '#fff', fontWeight: '800' },
  main: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 24 : 14,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  searchBox: {
    minWidth: Platform.OS === 'web' ? 300 : 0,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d7e6f3',
  },
  searchInput: { flex: 1, color: colors.dark, fontWeight: '600', fontSize: 12 },
  filterBtn: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  pageTitle: { color: colors.dark, fontSize: 28, fontWeight: '900' },
  pageSubtitle: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#e9f1fb', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  sectionCount: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  docCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce9f5',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: Platform.OS === 'web' ? 300 : 0,
    flex: 1,
  },
  docIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docTitle: { color: colors.dark, fontWeight: '800', fontSize: 14 },
  docSub: { color: colors.muted, fontWeight: '600', fontSize: 12, marginTop: 2 },
  docMeta: { color: colors.muted, fontWeight: '700', fontSize: 10, marginTop: 2 },
  downloadBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#edf4fb', alignItems: 'center', justifyContent: 'center' },
  noticeCard: { marginTop: 8, borderWidth: 1, borderColor: '#dce9f5', borderRadius: 12, backgroundColor: '#eef4fb', padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noticeTitle: { color: colors.dark, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  noticeText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});

export default PacienteRecetasDocumentosScreen;




