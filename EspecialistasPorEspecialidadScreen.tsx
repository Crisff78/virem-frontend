import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const Doctor1: ImageSourcePropType = { uri: 'https://i.pravatar.cc/240?img=12' };
const Doctor2: ImageSourcePropType = { uri: 'https://i.pravatar.cc/240?img=32' };
const Doctor3: ImageSourcePropType = { uri: 'https://i.pravatar.cc/240?img=18' };

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
  focus: string;
  exp: string;
  rating: string;
  reviews: string;
  city: string;
  price: string;
  tags: string[];
  availability: AvailabilityFilter[];
  image: ImageSourcePropType;
  availableNow?: boolean;
  verified?: boolean;
};
type AvailabilityFilter = 'today' | 'week' | 'weekend';

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const doctorsBySpecialty: Record<string, Doctor[]> = {
  Cardiologia: [
    {
      id: 'cardio-1',
      name: 'Dr. Alejandro Mendez',
      focus: 'Cardiologia Intervencionista',
      exp: '12 años exp.',
      rating: '4.9',
      reviews: '124',
      city: 'Santo Domingo',
      price: '65',
      tags: ['Arritmias', 'Hipertension', 'Ecografia'],
      availability: ['today', 'week'],
      image: Doctor1,
      availableNow: true,
      verified: true,
    },
    {
      id: 'cardio-2',
      name: 'Dra. Elena Rodriguez',
      focus: 'Cardiologia Pediatrica',
      exp: '8 años exp.',
      rating: '4.8',
      reviews: '89',
      city: 'Santiago',
      price: '80',
      tags: ['Soplos', 'Prevencion Infantil'],
      availability: ['week'],
      image: Doctor2,
      verified: true,
    },
    {
      id: 'cardio-3',
      name: 'Dr. Javier Santos',
      focus: 'Cardiologia Clinica y Rehabilitacion',
      exp: '20 años exp.',
      rating: '5.0',
      reviews: '210',
      city: 'La Romana',
      price: '55',
      tags: ['Infartos', 'Rehabilitacion'],
      availability: ['today', 'week'],
      image: Doctor3,
      availableNow: true,
    },
  ],
  Pediatria: [
    {
      id: 'pedia-1',
      name: 'Dra. Laura Jimenez',
      focus: 'Pediatria General',
      exp: '10 años exp.',
      rating: '4.9',
      reviews: '170',
      city: 'Santo Domingo',
      price: '45',
      tags: ['Control niño sano', 'Vacunas'],
      availability: ['today', 'week', 'weekend'],
      image: Doctor2,
      availableNow: true,
      verified: true,
    },
    {
      id: 'pedia-2',
      name: 'Dr. Carlos Pena',
      focus: 'Neumologia Pediatrica',
      exp: '14 años exp.',
      rating: '4.7',
      reviews: '96',
      city: 'Bani',
      price: '60',
      tags: ['Asma', 'Alergias'],
      availability: ['week', 'weekend'],
      image: Doctor3,
      verified: true,
    },
  ],
  Neurologia: [
    {
      id: 'neuro-1',
      name: 'Dra. Sofia Acosta',
      focus: 'Neurologia Clinica',
      exp: '11 años exp.',
      rating: '4.8',
      reviews: '122',
      city: 'Santo Domingo',
      price: '75',
      tags: ['Migrana', 'Neuroimagen'],
      availability: ['today', 'week'],
      image: Doctor1,
      verified: true,
    },
    {
      id: 'neuro-2',
      name: 'Dr. Miguel Perez',
      focus: 'Trastornos del Sueno',
      exp: '9 años exp.',
      rating: '4.6',
      reviews: '77',
      city: 'Santiago',
      price: '70',
      tags: ['Insomnio', 'Apnea'],
      availability: ['weekend'],
      image: Doctor3,
    },
  ],
  Dermatologia: [
    {
      id: 'derma-1',
      name: 'Dra. Camila Ortiz',
      focus: 'Dermatologia Clinica',
      exp: '7 años exp.',
      rating: '4.9',
      reviews: '140',
      city: 'Santo Domingo',
      price: '50',
      tags: ['Acne', 'Rosacea'],
      availability: ['today', 'week'],
      image: Doctor2,
      availableNow: true,
      verified: true,
    },
    {
      id: 'derma-2',
      name: 'Dr. Hugo Mena',
      focus: 'Dermatologia Estetica',
      exp: '13 años exp.',
      rating: '4.7',
      reviews: '91',
      city: 'San Pedro',
      price: '65',
      tags: ['Manchas', 'Peelings'],
      availability: ['week', 'weekend'],
      image: Doctor1,
    },
  ],
  'Medicina General': [
    {
      id: 'gen-1',
      name: 'Dr. Ricardo Ruiz',
      focus: 'Atencion Primaria Integral',
      exp: '16 años exp.',
      rating: '4.8',
      reviews: '203',
      city: 'Santo Domingo',
      price: '35',
      tags: ['Chequeo', 'Control presion'],
      availability: ['today', 'week', 'weekend'],
      image: Doctor3,
      availableNow: true,
    },
    {
      id: 'gen-2',
      name: 'Dra. Marta Sanchez',
      focus: 'Medicina Familiar',
      exp: '12 años exp.',
      rating: '4.9',
      reviews: '188',
      city: 'La Vega',
      price: '40',
      tags: ['Prevencion', 'Dolor cronico'],
      availability: ['week'],
      image: Doctor2,
      verified: true,
    },
  ],
  Oftalmologia: [
    {
      id: 'oftal-1',
      name: 'Dr. Adrian Lopez',
      focus: 'Oftalmologia General',
      exp: '15 años exp.',
      rating: '4.8',
      reviews: '147',
      city: 'Santo Domingo',
      price: '58',
      tags: ['Miopia', 'Glaucoma'],
      availability: ['today', 'weekend'],
      image: Doctor1,
      availableNow: true,
      verified: true,
    },
  ],
  Nutricion: [
    {
      id: 'nutri-1',
      name: 'Lic. Ana Paula Reyes',
      focus: 'Nutricion Clinica',
      exp: '9 años exp.',
      rating: '4.9',
      reviews: '166',
      city: 'Santiago',
      price: '42',
      tags: ['Perdida de peso', 'Plan alimenticio'],
      availability: ['week', 'weekend'],
      image: Doctor2,
      verified: true,
    },
  ],
  Endocrinologia: [
    {
      id: 'endo-1',
      name: 'Dra. Patricia Paredes',
      focus: 'Endocrinologia y Metabolismo',
      exp: '12 años exp.',
      rating: '4.8',
      reviews: '110',
      city: 'Santo Domingo',
      price: '68',
      tags: ['Diabetes', 'Tiroides'],
      availability: ['today', 'week'],
      image: Doctor3,
      verified: true,
    },
  ],
};

const EspecialistasPorEspecialidadScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EspecialistasPorEspecialidad'>>();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('today');
  const [ratingMin, setRatingMin] = useState<'4.5' | '4.0' | null>('4.5');

  const specialty = route.params?.specialty || 'Cardiologia';
  const doctors = doctorsBySpecialty[specialty] || doctorsBySpecialty.Cardiologia;
  const availabilityLabel =
    availabilityFilter === 'today'
      ? 'hoy mismo'
      : availabilityFilter === 'week'
        ? 'esta semana'
        : 'fines de semana';
  const displayedDoctors = useMemo(
    () => doctors.filter((doctor) => doctor.availability.includes(availabilityFilter)),
    [availabilityFilter, doctors]
  );

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

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem(STORAGE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('DashboardPaciente')}
            >
              <MaterialIcons name="grid-view" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Inicio</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('NuevaConsultaPaciente')}
            >
              <MaterialIcons name="person-search" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>Buscar Medico</Text>
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

        <View style={styles.breadcrumbRow}>
          <TouchableOpacity onPress={() => navigation.navigate('DashboardPaciente')}>
            <Text style={styles.breadcrumbLink}>Inicio</Text>
          </TouchableOpacity>
          <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          <TouchableOpacity onPress={() => navigation.navigate('NuevaConsultaPaciente')}>
            <Text style={styles.breadcrumbLink}>Especialidades</Text>
          </TouchableOpacity>
          <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          <Text style={styles.breadcrumbCurrent}>{specialty}</Text>
        </View>

        <Text style={styles.pageTitle}>Seleccionar especialista en {specialty}</Text>
        <Text style={styles.pageSubtitle}>
          Encontramos {displayedDoctors.length} medicos disponibles para atenderte.
        </Text>

        <View style={styles.layoutRow}>
          <View style={styles.filtersCol}>
            <View style={styles.filtersCard}>
              <View style={styles.filtersHeader}>
                <Text style={styles.filtersTitle}>Filtros</Text>
                <TouchableOpacity
                  onPress={() => {
                    setAvailabilityFilter('today');
                    setRatingMin('4.5');
                  }}
                >
                  <Text style={styles.clearText}>Limpiar</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.filterLabel}>Disponibilidad</Text>
              <TouchableOpacity style={styles.optionRow} onPress={() => setAvailabilityFilter('today')}>
                <View style={[styles.checkBox, availabilityFilter === 'today' && styles.checkBoxActive]} />
                <Text style={styles.optionText}>Hoy mismo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionRow} onPress={() => setAvailabilityFilter('week')}>
                <View style={[styles.checkBox, availabilityFilter === 'week' && styles.checkBoxActive]} />
                <Text style={styles.optionText}>Esta semana</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionRow} onPress={() => setAvailabilityFilter('weekend')}>
                <View style={[styles.checkBox, availabilityFilter === 'weekend' && styles.checkBoxActive]} />
                <Text style={styles.optionText}>Fines de semana</Text>
              </TouchableOpacity>

              <Text style={[styles.filterLabel, { marginTop: 16 }]}>Valoracion</Text>
              <TouchableOpacity style={styles.optionRow} onPress={() => setRatingMin('4.5')}>
                <View style={[styles.radio, ratingMin === '4.5' && styles.radioActive]} />
                <Text style={styles.optionText}>4.5 +</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionRow} onPress={() => setRatingMin('4.0')}>
                <View style={[styles.radio, ratingMin === '4.0' && styles.radioActive]} />
                <Text style={styles.optionText}>4.0 +</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.resultsCol}>
            <View style={styles.resultsHeadCard}>
              <Text style={styles.resultsText}>
                Mostrando resultados para <Text style={styles.resultsStrong}>{specialty}</Text>
              </Text>
              <Text style={styles.orderText}>Ordenar por: Mas relevante</Text>
            </View>

            {displayedDoctors.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="event-busy" size={36} color={colors.muted} />
                <Text style={styles.emptyTitle}>No hay especialistas disponibles</Text>
                <Text style={styles.emptySub}>
                  No encontramos disponibilidad para {availabilityLabel} en esta especialidad.
                </Text>
              </View>
            ) : (
              displayedDoctors.map((doc) => (
                <View key={doc.id} style={styles.docCard}>
                  <View style={styles.docLeft}>
                    <View style={styles.docImageWrap}>
                      <Image source={doc.image} style={styles.docImage} />
                      {doc.availableNow ? <View style={styles.docOnlineDot} /> : null}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.docNameRow}>
                        <Text style={styles.docName}>{doc.name}</Text>
                        {doc.verified ? (
                          <MaterialIcons name="verified" size={16} color={colors.primary} />
                        ) : null}
                      </View>
                      <Text style={styles.docFocus}>{doc.focus}</Text>
                      <View style={styles.docMetaRow}>
                        <Text style={styles.docMeta}>{doc.exp}</Text>
                        <Text style={styles.docMeta}> {doc.rating} ({doc.reviews})</Text>
                        <Text style={styles.docMeta}> {doc.city}</Text>
                      </View>
                      <View style={styles.tagsRow}>
                        {doc.tags.map((tag) => (
                          <View key={tag} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.docRight}>
                    <Text style={styles.priceLabel}>Consulta desde</Text>
                    <Text style={styles.priceValue}>${doc.price}</Text>
                    <TouchableOpacity
                      style={styles.bookBtn}
                      onPress={() =>
                        navigation.navigate('PerfilEspecialistaAgendar', {
                          specialty,
                          doctorId: doc.id,
                        })
                      }
                    >
                      <Text style={styles.bookBtnText}>Ver Perfil y Agendar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <View style={styles.paginationRow}>
              <TouchableOpacity style={styles.pageBtn}>
                <MaterialIcons name="chevron-left" size={16} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pageBtn, styles.pageBtnActive]}>
                <Text style={styles.pageBtnActiveText}>1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pageBtn}>
                <Text style={styles.pageBtnText}>2</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pageBtn}>
                <Text style={styles.pageBtnText}>3</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pageBtn}>
                <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
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

  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  breadcrumbLink: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  breadcrumbCurrent: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  pageTitle: { color: colors.dark, fontSize: 28, fontWeight: '900', marginTop: 12 },
  pageSubtitle: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 14,
    marginTop: 2,
    marginBottom: 16,
  },

  layoutRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  filtersCol: { width: 240 },
  resultsCol: { flex: 1 },

  filtersCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4edf6',
    padding: 14,
  },
  filtersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filtersTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  clearText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  filterLabel: { color: colors.dark, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optionText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  checkBox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#b8d0e4',
    backgroundColor: '#fff',
  },
  checkBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  radio: {
    width: 15,
    height: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#b8d0e4',
    backgroundColor: '#fff',
  },
  radioActive: { borderColor: colors.primary, borderWidth: 5 },

  resultsHeadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4edf6',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  resultsStrong: { color: colors.dark, fontWeight: '900' },
  orderText: { color: colors.muted, fontSize: 12, fontWeight: '700' },

  docCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4edf6',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  docLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  docImageWrap: { width: 92, height: 92 },
  docImage: { width: '100%', height: '100%', borderRadius: 12 },
  docOnlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  docNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  docName: { color: colors.dark, fontSize: 18, fontWeight: '900' },
  docFocus: { color: colors.blue, fontWeight: '700', marginBottom: 6 },
  docMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  docMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#edf4fb', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: colors.blue, fontSize: 10, fontWeight: '700' },

  docRight: { width: 160, alignItems: 'flex-end', justifyContent: 'space-between' },
  priceLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: { color: colors.blue, fontSize: 28, fontWeight: '900', marginTop: 2 },
  bookBtn: {
    backgroundColor: colors.blue,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 8,
  },
  bookBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  paginationRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  pageBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9e6f2',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  pageBtnText: { color: colors.dark, fontWeight: '700', fontSize: 12 },
  pageBtnActiveText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4edf6',
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    marginTop: 10,
    color: colors.dark,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default EspecialistasPorEspecialidadScreen;

