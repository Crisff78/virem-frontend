import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';

import { useLanguage } from './localization/LanguageContext';

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

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  city: string;
  country: string;
  rating: string;
  reviews: string;
  focus: string;
  avatar: ImageSourcePropType;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const filters = ['Cardiología', 'Psicología', 'Pediatría', 'Dermatología', 'Ginecología', 'Neurología'];

const resolveFilterFromSpecialty = (specialty: string): string => {
  const lower = specialty.toLowerCase();
  if (lower.includes('cardio')) return 'Cardiología';
  if (lower.includes('psico')) return 'Psicología';
  if (lower.includes('pedia')) return 'Pediatría';
  if (lower.includes('derma')) return 'Dermatología';
  if (lower.includes('gine')) return 'Ginecología';
  if (lower.includes('neuro')) return 'Neurología';
  return 'Más';
};

const doctors: Doctor[] = [
  {
    id: 'dr-alejandro-sanz',
    name: 'Dr. Alejandro Sanz',
    specialty: 'Cardiología',
    city: 'Madrid',
    country: 'España',
    rating: '4.9',
    reviews: '120 reseñas',
    focus: 'Especialista en arritmias',
    avatar: { uri: 'https://i.pravatar.cc/360?img=12' },
  },
  {
    id: 'dra-beatriz-luna',
    name: 'Dra. Beatriz Luna',
    specialty: 'Psicología Clínica',
    city: 'Barcelona',
    country: 'España',
    rating: '4.8',
    reviews: '85 reseñas',
    focus: 'Terapia Cognitiva',
    avatar: { uri: 'https://i.pravatar.cc/360?img=47' },
  },
  {
    id: 'dr-carlos-ruiz',
    name: 'Dr. Carlos Ruiz',
    specialty: 'Pediatría',
    city: 'Valencia',
    country: 'España',
    rating: '5.0',
    reviews: '200 reseñas',
    focus: 'Atención integral',
    avatar: { uri: 'https://i.pravatar.cc/360?img=33' },
  },
  {
    id: 'dra-elena-soler',
    name: 'Dra. Elena Soler',
    specialty: 'Dermatología',
    city: 'Sevilla',
    country: 'España',
    rating: '4.7',
    reviews: '94 reseñas',
    focus: 'Estética y salud',
    avatar: { uri: 'https://i.pravatar.cc/360?img=45' },
  },
  {
    id: 'dr-hugo-silva',
    name: 'Dr. Hugo Silva',
    specialty: 'Neurología',
    city: 'Madrid',
    country: 'España',
    rating: '4.9',
    reviews: '56 reseñas',
    focus: 'Medicina del sueño',
    avatar: { uri: 'https://i.pravatar.cc/360?img=14' },
  },
  {
    id: 'dra-maria-pons',
    name: 'Dra. Maria Pons',
    specialty: 'Ginecología',
    city: 'Valencia',
    country: 'España',
    rating: '4.6',
    reviews: '112 reseñas',
    focus: 'Salud femenina',
    avatar: { uri: 'https://i.pravatar.cc/360?img=48' },
  },
];

const NuevaConsultaPacienteScreen: React.FC = () => {

  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<User | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('Cardiología');

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

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem(STORAGE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const filteredDoctors = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return doctors.filter((doctor) => {
      if (query) {
        const haystack = `${doctor.name} ${doctor.specialty} ${doctor.city} ${doctor.focus}`.toLowerCase();
        return haystack.includes(query);
      }

      const matchesFilter =
        selectedFilter === 'Más' ||
        doctor.specialty.toLowerCase().includes(selectedFilter.toLowerCase().replace('í', 'i')) ||
        doctor.specialty.toLowerCase().includes(selectedFilter.toLowerCase());

      return matchesFilter;
    });
  }, [searchText, selectedFilter]);

  useEffect(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return;

    const firstMatch = doctors.find((doctor) => {
      const haystack = `${doctor.name} ${doctor.specialty} ${doctor.city} ${doctor.focus}`.toLowerCase();
      return haystack.includes(query);
    });

    if (!firstMatch) return;
    const autoFilter = resolveFilterFromSpecialty(firstMatch.specialty);
    if (autoFilter !== selectedFilter) {
      setSelectedFilter(autoFilter);
    }
  }, [searchText, selectedFilter]);

  const handleOpenDoctor = (doctor: Doctor) => {
    navigation.navigate('PerfilEspecialistaAgendar', {
      specialty: doctor.specialty,
      doctorId: doctor.id,
    });
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
            {!user?.fotoUrl ? (
              <Text style={styles.hintText}>No tienes foto. Ve a Perfil para agregarla.</Text>
            ) : null}
          </View>

          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('DashboardPaciente')}
            >
              <MaterialIcons name="grid-view" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.home')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItemRow, styles.menuItemActive]}>
              <MaterialIcons name="person-search" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>{t('menu.searchDoctor')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('DashboardPaciente', { initialSection: 'appointments' })}
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
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteRecetasDocumentos')}
            >
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.recipesDocs')}</Text>
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

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.searchHeaderCard}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Busca un médico para consulta online"
              placeholderTextColor="#8aa7bf"
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Text style={styles.filterLabel}>Filtros:</Text>
            {filters.map((filter) => {
              const active = selectedFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSelectedFilter(filter)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.filterMoreChip} onPress={() => setSelectedFilter('Más')}>
              <MaterialIcons name="tune" size={14} color="#6b7f95" />
              <Text style={styles.filterMoreText}>Más</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            Médicos Disponibles <Text style={styles.resultsCount}>({filteredDoctors.length})</Text>
          </Text>
          <TouchableOpacity style={styles.sortRow}>
            <Text style={styles.sortLabel}>Ordenar por:</Text>
            <Text style={styles.sortValue}>Relevancia</Text>
            <MaterialIcons name="keyboard-arrow-down" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.doctorGrid}>
          {filteredDoctors.map((doctor) => (
            <View key={doctor.id} style={styles.doctorCard}>
              <View style={styles.doctorImageWrap}>
                <Image source={doctor.avatar} style={styles.doctorImage} />
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={12} color="#f59e0b" />
                  <Text style={styles.ratingText}>{doctor.rating}</Text>
                </View>
              </View>

              <Text style={styles.doctorName}>{doctor.name}</Text>
              <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>

              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={13} color={colors.muted} />
                <Text style={styles.locationText}>
                  {doctor.city}, {doctor.country}
                </Text>
              </View>

              <Text style={styles.metaText}>
                {doctor.reviews} • {doctor.focus}
              </Text>

              <TouchableOpacity style={styles.cardButton} onPress={() => handleOpenDoctor(doctor)}>
                <Text style={styles.cardButtonText}>Ver Perfil y Agendar</Text>
                <MaterialIcons name="arrow-forward" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
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
  searchHeaderCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3ebf5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f4f8fc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  filterRow: { alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: 2 },
  filterLabel: { color: '#90a4b8', fontSize: 12, fontWeight: '800', marginRight: 4 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8e3ee',
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterChipText: { color: '#5e748a', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },
  filterMoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#edf2f7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterMoreText: { color: '#6b7f95', fontSize: 12, fontWeight: '700' },
  resultsHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultsTitle: { color: colors.dark, fontSize: 28, fontWeight: '900' },
  resultsCount: { color: colors.muted, fontSize: 28, fontWeight: '700' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortLabel: { color: '#95a6b7', fontSize: 12, fontWeight: '700' },
  sortValue: { color: colors.dark, fontSize: 13, fontWeight: '800' },
  doctorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  doctorCard: {
    width: Platform.OS === 'web' ? '24%' : '100%',
    minWidth: Platform.OS === 'web' ? 220 : 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1eaf4',
    borderRadius: 14,
    padding: 10,
  },
  doctorImageWrap: { position: 'relative' },
  doctorImage: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    backgroundColor: '#f3f6fa',
  },
  ratingBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: { color: colors.dark, fontSize: 11, fontWeight: '900' },
  doctorName: { marginTop: 10, color: colors.dark, fontSize: 16, fontWeight: '900' },
  doctorSpecialty: { marginTop: 2, color: colors.primary, fontSize: 14, fontWeight: '800' },
  locationRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  metaText: { marginTop: 4, color: '#9badbe', fontSize: 11, fontWeight: '600' },
  cardButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  cardButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },

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




