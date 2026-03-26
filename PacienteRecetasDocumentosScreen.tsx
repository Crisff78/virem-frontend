import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useLanguage } from './localization/LanguageContext';
import type { RootStackParamList } from './navigation/types';
import { apiUrl } from './config/backend';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';
import { getAuthToken } from './utils/auth';

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
  url?: string | null;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const sanitizeFotoUrl = (value: unknown) => {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};

const FALLBACK_RECETAS: DocumentItem[] = [
  {
    title: 'Tratamiento Hipertension',
    doctor: 'Dr. Alejandro Garcia',
    date: 'Emitido el 15 Oct, 2023',
    icon: 'picture-as-pdf',
    tint: '#ef4444',
    bg: '#fef2f2',
  },
];

const FALLBACK_CERTIFICADOS: DocumentItem[] = [
  {
    title: 'Certificado de Aptitud Fisica',
    doctor: 'Dr. Ricardo Ruiz',
    date: 'Emitido el 01 Ago, 2023',
    icon: 'description',
    tint: '#1A3D63',
    bg: '#eef4fb',
  },
];

const mapApiDocToItem = (doc: any, tipo: 'receta' | 'certificado'): DocumentItem => {
  const dateRaw = doc?.fechaEmision || doc?.createdAt || '';
  let dateLabel = '';
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (!Number.isNaN(d.getTime())) {
      dateLabel = `Emitido el ${new Intl.DateTimeFormat('es-DO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d)}`;
    }
  }
  return {
    title: String(doc?.titulo || doc?.title || 'Documento'),
    doctor: String(doc?.medicoNombre || doc?.doctor || 'Medico'),
    date: dateLabel || String(doc?.date || 'Sin fecha'),
    icon: tipo === 'receta' ? 'picture-as-pdf' : 'description',
    tint: tipo === 'receta' ? '#ef4444' : '#1A3D63',
    bg: tipo === 'receta' ? '#fef2f2' : '#eef4fb',
    url: doc?.archivoUrl || doc?.url || null,
  };
};

const sanitizeFileName = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-]/g, '');

const buildDocumentContent = (item: DocumentItem) =>
  `VIREM - Documento de ejemplo\n\nTítulo: ${item.title}\nEmitido por: ${item.doctor}\nFecha: ${item.date}\n\nNota: Este archivo es una demostración de descarga para pruebas de interfaz.`;

const downloadDocument = (item: DocumentItem) => {
  // If there's a real URL from the API, open it directly
  if (item.url) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(item.url, '_blank');
    } else {
      Linking.openURL(item.url).catch(() => {
        Alert.alert('Error', 'No se pudo abrir el documento.');
      });
    }
    return;
  }

  // Fallback: generate a demo text file
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
    message: `${buildDocumentContent(item)}\n\n(Documento VIREM)`,
  }).catch(() => {
    Alert.alert('Error', 'No se pudo compartir el documento en este dispositivo.');
  });
};

const DocumentRow: React.FC<{ item: DocumentItem }> = ({ item }) => (
  <TouchableOpacity
    style={styles.docCard}
    activeOpacity={0.9}
    onPress={() => downloadDocument(item)}
  >
    <View style={[styles.docIconWrap, { backgroundColor: item.bg }]}>
      <MaterialIcons name={item.icon as any} size={20} color={item.tint} />
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
    <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadDocument(item)}>
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
          <MaterialIcons name={icon as any} size={18} color={colors.blue} />
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
  const [recetas, setRecetas] = useState<DocumentItem[]>(FALLBACK_RECETAS);
  const [certificados, setCertificados] = useState<DocumentItem[]>(FALLBACK_CERTIFICADOS);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [searchText, setSearchText] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(apiUrl('/api/documentos/me'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.success && Array.isArray(payload?.documentos)) {
        const apiRecetas: DocumentItem[] = [];
        const apiCertificados: DocumentItem[] = [];

        for (const doc of payload.documentos) {
          const tipo = String(doc?.tipo || '').toLowerCase();
          if (tipo.includes('certificado') || tipo.includes('constancia')) {
            apiCertificados.push(mapApiDocToItem(doc, 'certificado'));
          } else {
            apiRecetas.push(mapApiDocToItem(doc, 'receta'));
          }
        }

        if (apiRecetas.length > 0) setRecetas(apiRecetas);
        if (apiCertificados.length > 0) setCertificados(apiCertificados);
      }
    } catch {
      // Keep fallback data on error
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const localStorageUser = ensurePatientSessionUser(
          parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY))
        );
        if (localStorageUser) {
          setUser(localStorageUser);
        }
      }
      const secureStoreUser = ensurePatientSessionUser(
        parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY))
      );
      if (secureStoreUser) {
        setUser(secureStoreUser);
      } else {
        const asyncUser = ensurePatientSessionUser(parseUser(await AsyncStorage.getItem(STORAGE_KEY)));
        setUser(asyncUser);
      }
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadDocuments();
    }, [loadUser, loadDocuments])
  );

  const filteredRecetas = useMemo(() => {
    if (!searchText.trim()) return recetas;
    const q = searchText.toLowerCase();
    return recetas.filter(
      (r) => r.title.toLowerCase().includes(q) || r.doctor.toLowerCase().includes(q)
    );
  }, [recetas, searchText]);

  const filteredCertificados = useMemo(() => {
    if (!searchText.trim()) return certificados;
    const q = searchText.toLowerCase();
    return certificados.filter(
      (c) => c.title.toLowerCase().includes(q) || c.doctor.toLowerCase().includes(q)
    );
  }, [certificados, searchText]);

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    const fotoUrl = sanitizeFotoUrl(user?.fotoUrl);
    if (fotoUrl) return { uri: fotoUrl };
    return DefaultAvatar;
  }, [user?.fotoUrl]);
  const hasProfilePhoto = useMemo(() => Boolean(sanitizeFotoUrl(user?.fotoUrl)), [user?.fotoUrl]);

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
            <Image source={userAvatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userPlan}>{planLabel}</Text>
            {loadingUser ? <Text style={styles.syncText}>Actualizando perfil...</Text> : null}
            {!hasProfilePhoto ? (
              <Text style={styles.hintText}>No tienes foto. Ve a Perfil para agregarla.</Text>
            ) : null}
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

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              placeholder="Buscar por nombre o fecha..."
              placeholderTextColor="#8aa7bf"
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
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

        {loadingDocs ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : null}

        <SectionBlock
          icon="description"
          title="Recetas Medicas"
          count={`${filteredRecetas.length} ARCHIVO${filteredRecetas.length !== 1 ? 'S' : ''}`}
          items={filteredRecetas}
        />
        <SectionBlock
          icon="verified"
          title="Certificados y Otros"
          count={`${filteredCertificados.length} ARCHIVO${filteredCertificados.length !== 1 ? 'S' : ''}`}
          items={filteredCertificados}
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
  syncText: { marginTop: 6, color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  hintText: { marginTop: 6, color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
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




