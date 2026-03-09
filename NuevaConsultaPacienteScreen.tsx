import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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

type SpecialtyCardProps = {
  icon: string;
  label: string;
  description: string;
  onPress: () => void;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const SpecialtyCard: React.FC<SpecialtyCardProps> = ({ icon, label, description, onPress }) => (
  <SpecialtyCardInner icon={icon} label={label} description={description} onPress={onPress} />
);

const SpecialtyCardInner: React.FC<SpecialtyCardProps> = ({
  icon,
  label,
  description,
  onPress,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.specialtyCard,
        hovered && styles.specialtyCardHover,
        pressed && styles.specialtyCardPressed,
      ]}
    >
      <View style={[styles.specialtyIconBox, hovered && styles.specialtyIconBoxHover]}>
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={hovered ? colors.white : colors.blue}
        />
      </View>
      <Text style={[styles.specialtyTitle, hovered && styles.specialtyTitleHover]}>{label}</Text>
      <Text style={styles.specialtyDescription}>{description}</Text>
    </Pressable>
  );
};

const NuevaConsultaPacienteScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (Platform.OS === 'web') {
          const localStorageUser = parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY));
          if (localStorageUser) {
            setUser(localStorageUser);
            return;
          }
        }

        const secureStoreUser = parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY));
        if (secureStoreUser) {
          setUser(secureStoreUser);
          return;
        }

        const asyncUser = parseUser(await AsyncStorage.getItem(STORAGE_KEY));
        setUser(asyncUser);
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
  }, [user]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    if (user?.fotoUrl && user.fotoUrl.trim().length > 0) {
      return { uri: user.fotoUrl.trim() };
    }
    return DefaultAvatar;
  }, [user]);

  const specialtyList = [
    { icon: 'heart-outline', label: 'Cardiologia', description: 'Corazon y sistema circulatorio' },
    { icon: 'baby-face-outline', label: 'Pediatria', description: 'Atencion integral para niños' },
    { icon: 'brain', label: 'Neurologia', description: 'Cerebro y sistema nervioso' },
    { icon: 'face-man-outline', label: 'Dermatologia', description: 'Cuidado de la piel y cabello' },
    { icon: 'stethoscope', label: 'Medicina General', description: 'Atencion primaria inicial' },
    { icon: 'eye-outline', label: 'Oftalmologia', description: 'Salud visual y ocular' },
    { icon: 'food-apple-outline', label: 'Nutricion', description: 'Dieta y bienestar alimenticio' },
    { icon: 'pill', label: 'Endocrinologia', description: 'Hormonas y metabolismo' },
  ];

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem(STORAGE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const onSelectSpecialty = (label: string) => {
    navigation.navigate('EspecialistasPorEspecialidad', { specialty: label });
  };

  if (loadingUser) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Cargando informacion...</Text>
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
            {!user?.fotoUrl ? (
              <Text style={styles.hintText}>No tienes foto. Ve a Perfil para agregarla.</Text>
            ) : null}
          </View>

          <View style={styles.menu}>
            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('DashboardPaciente')}
            >
              <MaterialIcons name="grid-view" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>Inicio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="person-search" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Buscar Medico</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="calendar-today" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Mis Citas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="videocam" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Videollamada</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="chat-bubble" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Recetas / Documentos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacientePerfil')}
            >
              <MaterialIcons name="account-circle" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Perfil</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>Cerrar Sesion</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              placeholder="Busca un medico para consulta online"
              placeholderTextColor="#8aa7bf"
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity style={styles.notifBtn}>
            <MaterialIcons name="notifications" size={22} color={colors.dark} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.centerHeader}>
          <Text style={styles.pageTitle}>Solicitar Nueva Consulta</Text>
          <Text style={styles.pageSubtitle}>
            En que podemos ayudarte hoy? Selecciona una especialidad para comenzar.
          </Text>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={19} color={colors.muted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchField}
            placeholder="Busca sintomas (ej. dolor de cabeza), especialidades o doctores"
            placeholderTextColor="#8ca7bd"
          />
        </View>

        <View style={styles.quickSearchRow}>
          <Text style={styles.quickSearchLabel}>Busquedas frecuentes:</Text>
          <Text style={styles.quickSearchItem}>Gripe</Text>
          <Text style={styles.quickSearchItem}>Chequeo anual</Text>
          <Text style={styles.quickSearchItem}>Dermatologia</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Especialidades Medicas</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.specialtiesGrid}>
          {specialtyList.map((item) => (
            <SpecialtyCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              description={item.description}
              onPress={() => onSelectSpecialty(item.label)}
            />
          ))}
        </View>

        <View style={styles.expressCard}>
          <View style={styles.expressLeft}>
            <View style={styles.expressIconWrap}>
              <MaterialIcons name="emergency" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.expressTitle}>Necesitas atencion inmediata?</Text>
              <Text style={styles.expressSubtitle}>
                Contamos con medicos de guardia disponibles 24/7 para videoconsultas de urgencia.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.expressBtn}
            onPress={() => Alert.alert('Consulta Express', 'Te conectaremos con un medico en breve.')}
          >
            <MaterialIcons name="bolt" size={18} color="#fff" />
            <Text style={styles.expressBtnText}>Consulta Express</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  light: '#B3CFE5',
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
  hintText: { marginTop: 6, color: colors.muted, fontSize: 11, fontWeight: '700' },

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

  main: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 26 : 14,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.dark,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchInput: { flex: 1, color: colors.dark, fontWeight: '600' },
  notifBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  notifDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },

  centerHeader: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  pageTitle: {
    color: colors.dark,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
  },
  pageSubtitle: {
    marginTop: 9,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 14,
    maxWidth: 620,
  },
  searchWrap: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bfd4e6',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  searchField: {
    flex: 1,
    color: colors.dark,
    fontWeight: '600',
    paddingVertical: 6,
  },
  quickSearchRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  quickSearchLabel: { color: '#7292ad', fontSize: 12 },
  quickSearchItem: { color: colors.blue, fontWeight: '700', fontSize: 12 },

  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  sectionLink: { color: colors.blue, fontWeight: '800', fontSize: 13 },

  specialtiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  specialtyCard: {
    width: '24%',
    minWidth: 190,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4edf6',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    cursor: 'pointer',
  },
  specialtyCardHover: {
    borderColor: 'rgba(19,127,236,0.45)',
    shadowColor: colors.dark,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  specialtyCardPressed: { transform: [{ scale: 0.995 }] },
  specialtyIconBox: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#eef5fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  specialtyIconBoxHover: { backgroundColor: colors.blue },
  specialtyTitle: {
    color: colors.dark,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  specialtyTitleHover: { color: colors.blue },
  specialtyDescription: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },

  expressCard: {
    marginTop: 18,
    backgroundColor: '#071c3c',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  expressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 260,
  },
  expressIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expressTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 20,
  },
  expressSubtitle: {
    marginTop: 2,
    color: '#bfd3ea',
    fontSize: 13,
  },
  expressBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expressBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
});

export default NuevaConsultaPacienteScreen;

