import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';

const Doctor1: ImageSourcePropType = { uri: 'https://i.pravatar.cc/240?img=12' };
const Doctor2: ImageSourcePropType = { uri: 'https://i.pravatar.cc/240?img=32' };
const Doctor3: ImageSourcePropType = { uri: 'https://i.pravatar.cc/240?img=18' };

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

type DoctorProfile = {
  id: string;
  specialty: string;
  name: string;
  focus: string;
  years: string;
  rating: string;
  reviews: string;
  languages: string;
  license: string;
  price: string;
  image: ImageSourcePropType;
  about: string;
  services: string[];
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const doctorProfiles: DoctorProfile[] = [
  {
    id: 'cardio-1',
    specialty: 'Cardiologia',
    name: 'Dr. Alejandro Mendez',
    focus: 'Especialista en Cardiologia Intervencionista',
    years: '12 años',
    rating: '4.9',
    reviews: '124',
    languages: 'Español, Ingles',
    license: '282855',
    price: '65',
    image: Doctor1,
    about:
      'El Dr. Alejandro Mendez es un cardiologo con amplia experiencia en afecciones cardiovasculares complejas. Su enfoque combina medicina preventiva y procedimientos de minima invasion.',
    services: [
      'Tratamiento de arritmias',
      'Control de hipertension',
      'Ecografia doppler',
      'Pruebas de esfuerzo',
      'Chequeo cardiovascular completo',
    ],
  },
  {
    id: 'cardio-2',
    specialty: 'Cardiologia',
    name: 'Dra. Elena Rodriguez',
    focus: 'Cardiologia Pediatrica',
    years: '8 años',
    rating: '4.8',
    reviews: '89',
    languages: 'Español',
    license: '192021',
    price: '80',
    image: Doctor2,
    about:
      'Especialista en cardiologia pediatrica, con enfoque humanizado y seguimiento continuo para niños con patologias cardiacas.',
    services: ['Soplos', 'Prevencion infantil', 'Electrocardiograma pediatrico'],
  },
  {
    id: 'cardio-3',
    specialty: 'Cardiologia',
    name: 'Dr. Javier Santos',
    focus: 'Cardiologia Clinica y Rehabilitacion',
    years: '20 años',
    rating: '5.0',
    reviews: '210',
    languages: 'Español, Ingles',
    license: '887744',
    price: '55',
    image: Doctor3,
    about:
      'Experto en prevencion secundaria y rehabilitacion cardiaca para pacientes post-evento.',
    services: ['Infartos', 'Rehabilitacion', 'Control de riesgo cardiovascular'],
  },
];

const PerfilEspecialistaAgendarScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PerfilEspecialistaAgendar'>>();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [selectedDay, setSelectedDay] = useState(4);
  const [selectedTime, setSelectedTime] = useState('10:30');

  const specialty = route.params?.specialty || 'Cardiologia';
  const doctor = useMemo(() => {
    return (
      doctorProfiles.find((profile) => profile.id === route.params?.doctorId) ||
      doctorProfiles.find((profile) => profile.specialty === specialty) ||
      doctorProfiles[0]
    );
  }, [route.params?.doctorId, specialty]);

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

          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('DashboardPaciente')}
            >
              <MaterialIcons name="grid-view" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('NuevaConsultaPaciente')}
            >
              <MaterialIcons name="person-search" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>Buscar Especialista</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="calendar-month" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Mis Citas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="videocam" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Telemedicina</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Recetas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItemRow}>
              <MaterialIcons name="folder-shared" size={20} color={colors.muted} />
              <Text style={styles.menuText}>Historial Clinico</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Soporte 24/7</Text>
            <Text style={styles.supportSub}>Necesitas ayuda con tu agendamiento?</Text>
            <TouchableOpacity style={styles.supportBtn}>
              <Text style={styles.supportBtnText}>Contactar Soporte</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={18} color="#fff" />
            <Text style={styles.logoutText}>Cerrar Sesion</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <TextInput
            placeholder="Busca un medico para consulta online"
            placeholderTextColor="#8aa7bf"
            style={styles.searchInput}
          />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifBtn}>
              <MaterialIcons name="notifications" size={20} color={colors.dark} />
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <View>
                <Text style={styles.userName}>{fullName}</Text>
                <Text style={styles.userPlan}>{planLabel}</Text>
              </View>
              <Image source={userAvatarSource} style={styles.userAvatar} />
            </View>
          </View>
        </View>

        <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={styles.breadcrumbRow}>
            <TouchableOpacity onPress={() => navigation.navigate('DashboardPaciente')}>
              <Text style={styles.breadcrumbLink}>Inicio</Text>
            </TouchableOpacity>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
            <TouchableOpacity onPress={() => navigation.navigate('NuevaConsultaPaciente')}>
              <Text style={styles.breadcrumbLink}>Especialidades</Text>
            </TouchableOpacity>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
            <TouchableOpacity onPress={() => navigation.navigate('EspecialistasPorEspecialidad', { specialty })}>
              <Text style={styles.breadcrumbLink}>{specialty}</Text>
            </TouchableOpacity>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
            <Text style={styles.breadcrumbCurrent}>{doctor.name}</Text>
          </View>

          <View style={styles.contentRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.profileCard}>
                <View style={styles.profileTop}>
                  <View style={styles.docImageWrap}>
                    <Image source={doctor.image} style={styles.docImage} />
                    <View style={styles.onlineDot} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.docName}>{doctor.name}</Text>
                      <MaterialIcons name="verified" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.docFocus}>{doctor.focus}</Text>

                    <View style={styles.dataItem}>
                      <MaterialIcons name="work-outline" size={16} color={colors.blue} />
                      <Text style={styles.dataText}>Experiencia: {doctor.years}</Text>
                    </View>
                    <View style={styles.dataItem}>
                      <MaterialIcons name="star" size={16} color="#fbbf24" />
                      <Text style={styles.dataText}>
                        Valoracion: {doctor.rating} ({doctor.reviews} reseñas)
                      </Text>
                    </View>
                    <View style={styles.dataItem}>
                      <MaterialIcons name="language" size={16} color={colors.blue} />
                      <Text style={styles.dataText}>Idiomas: {doctor.languages}</Text>
                    </View>

                    <View style={styles.tagsRow}>
                      <View style={styles.tagBlue}>
                        <Text style={styles.tagBlueText}>Colegiado {doctor.license}</Text>
                      </View>
                      <View style={styles.tagGreen}>
                        <Text style={styles.tagGreenText}>Videoconsulta disponible</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Sobre mi</Text>
                <Text style={styles.cardText}>{doctor.about}</Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Especialidades y servicios</Text>
                {doctor.services.map((service) => (
                  <View key={service} style={styles.serviceRow}>
                    <MaterialIcons name="check-circle" size={16} color={colors.blue} />
                    <Text style={styles.serviceText}>{service}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.bookingCol}>
              <View style={styles.bookingCard}>
                <View style={styles.bookingTop}>
                  <Text style={styles.priceLabel}>Precio de consulta</Text>
                  <Text style={styles.priceValue}>${doctor.price}</Text>
                </View>
                <View style={styles.bookingBody}>
                  <Text style={styles.sectionTitle}>Selecciona fecha de cita</Text>
                  <View style={styles.calendarCard}>
                    <Text style={styles.calendarMonth}>Noviembre 2024</Text>
                    <View style={styles.daysGrid}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[styles.dayBtn, selectedDay === day && styles.dayBtnActive]}
                          onPress={() => setSelectedDay(day)}
                        >
                          <Text style={[styles.dayText, selectedDay === day && styles.dayTextActive]}>{day}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Horarios disponibles</Text>
                  <View style={styles.timeGrid}>
                    {['09:00', '10:30', '12:00', '15:30', '16:15', '18:00'].map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[styles.timeBtn, selectedTime === time && styles.timeBtnActive]}
                        onPress={() => setSelectedTime(time)}
                      >
                        <Text style={[styles.timeText, selectedTime === time && styles.timeTextActive]}>{time}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={() =>
                      Alert.alert(
                        'Cita agendada',
                        `Cita con ${doctor.name} el ${selectedDay}/11/2024 a las ${selectedTime}.`
                      )
                    }
                  >
                    <Text style={styles.confirmText}>Confirmar y Agendar</Text>
                    <MaterialIcons name="event-available" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: colors.bg,
  },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loaderText: { marginTop: 8, color: colors.muted, fontWeight: '700' },

  sidebar: {
    width: Platform.OS === 'web' ? 240 : '100%',
    backgroundColor: colors.white,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderRightColor: '#e9eff6',
    borderBottomColor: '#e9eff6',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 12 },
  logo: { width: 30, height: 30, resizeMode: 'contain' },
  logoTitle: { fontSize: 20, fontWeight: '900', color: colors.dark, letterSpacing: 0.5 },
  logoSubtitle: { fontSize: 10, color: colors.muted, fontWeight: '700' },
  menu: { gap: 4, flexDirection: Platform.OS === 'web' ? 'column' : 'row', flexWrap: 'wrap' },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    minWidth: Platform.OS === 'web' ? 0 : 150,
  },
  menuItemActive: { backgroundColor: 'rgba(19,127,236,0.08)' },
  menuText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  menuTextActive: { color: colors.primary, fontWeight: '800' },
  supportCard: {
    backgroundColor: '#f2f7fc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dae8f5',
    padding: 10,
  },
  supportTitle: { color: colors.blue, fontWeight: '900', fontSize: 12, marginBottom: 4 },
  supportSub: { color: colors.muted, fontWeight: '600', fontSize: 11, marginBottom: 8 },
  supportBtn: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#d3e2f0', paddingVertical: 8 },
  supportBtnText: { textAlign: 'center', color: colors.blue, fontWeight: '800', fontSize: 11 },

  header: {
    height: 60,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#e9eff6',
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f4f8fc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.dark,
    fontWeight: '600',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f7fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { color: colors.dark, fontWeight: '800', fontSize: 12, textAlign: 'right' },
  userPlan: { color: colors.muted, fontWeight: '600', fontSize: 10, textAlign: 'right' },
  userAvatar: { width: 32, height: 32, borderRadius: 32, borderWidth: 2, borderColor: '#d9e7f4' },

  main: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 18 : 12,
    paddingTop: 14,
  },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  breadcrumbLink: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  breadcrumbCurrent: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  contentRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
    alignItems: 'flex-start',
  },
  bookingCol: { width: Platform.OS === 'web' ? 340 : '100%' },

  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e4edf6',
    padding: 16,
    marginBottom: 12,
  },
  profileTop: { flexDirection: 'row', gap: 14 },
  docImageWrap: { width: 122, height: 122, position: 'relative' },
  docImage: { width: '100%', height: '100%', borderRadius: 16 },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#22c55e',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docName: { color: colors.dark, fontWeight: '900', fontSize: 28, lineHeight: 32 },
  docFocus: { color: colors.blue, fontWeight: '700', fontSize: 18, marginTop: 2, marginBottom: 8 },
  dataItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dataText: { color: colors.dark, fontWeight: '700', fontSize: 12 },
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  tagBlue: { backgroundColor: '#e9f1fb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tagBlueText: { color: colors.blue, fontSize: 11, fontWeight: '700' },
  tagGreen: { backgroundColor: '#eaf8ef', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tagGreenText: { color: '#15803d', fontSize: 11, fontWeight: '700' },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4edf6',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: colors.dark, fontWeight: '900', fontSize: 16, marginBottom: 8 },
  cardText: { color: colors.muted, fontWeight: '600', fontSize: 12, lineHeight: 18 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  serviceText: { color: colors.dark, fontSize: 12, fontWeight: '600' },
  logoutButton: {
    marginTop: 10,
    backgroundColor: colors.blue,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4edf6',
    overflow: 'hidden',
    shadowColor: colors.dark,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  bookingTop: { backgroundColor: colors.blue, padding: 14 },
  priceLabel: { color: '#c9dcf0', fontWeight: '800', fontSize: 10, textTransform: 'uppercase' },
  priceValue: { color: '#fff', fontWeight: '900', fontSize: 28, marginTop: 2 },
  bookingBody: { padding: 14 },
  sectionTitle: { color: colors.dark, fontWeight: '800', fontSize: 12, marginBottom: 8 },
  calendarCard: {
    borderRadius: 12,
    backgroundColor: '#f4f8fc',
    borderWidth: 1,
    borderColor: '#e2edf7',
    padding: 10,
  },
  calendarMonth: { color: colors.blue, fontWeight: '800', fontSize: 11, marginBottom: 8 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfeaf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  dayText: { color: colors.dark, fontWeight: '700', fontSize: 11 },
  dayTextActive: { color: '#fff' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeBtn: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#dfeaf5',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  timeBtnActive: { borderColor: colors.blue, borderWidth: 2, backgroundColor: '#f2f8ff' },
  timeText: { color: colors.muted, fontWeight: '800', fontSize: 11 },
  timeTextActive: { color: colors.blue },
  confirmBtn: {
    marginTop: 14,
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});

export default PerfilEspecialistaAgendarScreen;

