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
import { MaterialIcons } from '@expo/vector-icons';

import { useLanguage } from './localization/LanguageContext';
import type { DoctorRouteSnapshot, RootStackParamList } from './navigation/types';
import { apiUrl } from './config/backend';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';
const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';

type User = {
  id?: number | string;
  usuarioid?: number | string;
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
  permitePresencial: boolean;
  permiteVirtual: boolean;
};

type BackendMedico = {
  medicoid?: string;
  nombreCompleto?: string;
  especialidad?: string;
  permitePresencial?: boolean;
  permiteVirtual?: boolean;
  genero?: string;
  cedula?: string;
  telefono?: string;
  fotoUrl?: string | null;
};

type AgendaSlot = {
  disponibilidadId: number;
  horaInicio: string;
  horaFin: string;
  modalidad: 'presencial' | 'virtual';
  slotMinutos: number;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const sanitizeFotoUrl = (value: unknown) => {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};

const resolveDoctorImage = (value: { fotoUrl?: string | null }): ImageSourcePropType => {
  const clean = sanitizeFotoUrl(value.fotoUrl);
  if (clean) {
    return { uri: clean };
  }
  return DefaultAvatar;
};

const toDoctorProfile = (value: {
  id?: string;
  specialty?: string;
  name?: string;
  focus?: string;
  years?: string;
  rating?: string;
  reviews?: string;
  languages?: string;
  license?: string;
  price?: string;
  fotoUrl?: string | null;
  image?: ImageSourcePropType;
  about?: string;
  services?: string[];
  permitePresencial?: boolean;
  permiteVirtual?: boolean;
}): DoctorProfile => {
  const specialty = String(value.specialty || 'Medicina General').trim() || 'Medicina General';
  const name = String(value.name || '').trim() || 'Doctor';
  const focus = String(value.focus || '').trim() || `Especialista en ${specialty}`;
  const years = String(value.years || '').trim() || 'No disponible';
  const rating = String(value.rating || '').trim() || 'N/D';
  const reviews = String(value.reviews || '').trim() || 'N/D';
  const languages = String(value.languages || '').trim() || 'Español';
  const license = String(value.license || '').trim() || 'No disponible';
  const price = String(value.price || '').trim() || 'N/D';
  const about =
    String(value.about || '').trim() ||
    `Especialista en ${specialty}. Puedes agendar una consulta virtual para evaluacion y seguimiento clinico.`;
  const services =
    Array.isArray(value.services) && value.services.length
      ? value.services
      : [
          `Consulta de ${specialty}`,
          'Orientacion clinica y plan de manejo',
          'Seguimiento por plataforma',
        ];

  return {
    id: String(value.id || '').trim(),
    specialty,
    name,
    focus,
    years,
    rating,
    reviews,
    languages,
    license,
    price,
    image: value.image || resolveDoctorImage({ fotoUrl: value.fotoUrl }),
    about,
    services,
    permitePresencial: value.permitePresencial !== false,
    permiteVirtual: value.permiteVirtual !== false,
  };
};

const mapBackendMedicoToProfile = (
  medico: BackendMedico,
  fallbackSpecialty: string
): DoctorProfile => {
  const specialty = String(medico?.especialidad || fallbackSpecialty || 'Medicina General').trim() || 'Medicina General';
  const name = String(medico?.nombreCompleto || '').trim() || 'Doctor';
  const cedula = String(medico?.cedula || '').trim();
  const telefono = String(medico?.telefono || '').trim();
  const fotoUrl = sanitizeFotoUrl(medico?.fotoUrl);

  return toDoctorProfile({
    id: String(medico?.medicoid || ''),
    specialty,
    name,
    focus: specialty,
    years: 'No disponible',
    rating: 'N/D',
    reviews: 'N/D',
    languages: 'Español',
    license: cedula || 'No disponible',
    price: 'N/D',
    fotoUrl: fotoUrl || null,
    image: resolveDoctorImage({ fotoUrl }),
    about: `Especialista en ${specialty}. Puedes agendar una consulta virtual para evaluacion y seguimiento clinico.`,
    services: [
      `Consulta de ${specialty}`,
      'Orientacion clinica y plan de manejo',
      telefono ? `Contacto: ${telefono}` : 'Seguimiento por plataforma',
    ],
    permitePresencial: medico?.permitePresencial !== false,
    permiteVirtual: medico?.permiteVirtual !== false,
  });
};

const mapRouteSnapshotToProfile = (
  snapshot: DoctorRouteSnapshot,
  fallbackSpecialty: string,
  doctorId: string
): DoctorProfile => {
  const specialty =
    String(fallbackSpecialty || '').trim() || String(snapshot?.focus || '').trim() || 'Medicina General';
  return toDoctorProfile({
    id: doctorId,
    specialty,
    name: snapshot.name,
    focus: snapshot.focus || specialty,
    years: snapshot.exp,
    rating: snapshot.rating,
    reviews: snapshot.reviews,
    languages: 'Español',
    license: 'No disponible',
    price: snapshot.price,
    fotoUrl: sanitizeFotoUrl(snapshot?.fotoUrl),
    image: resolveDoctorImage({ fotoUrl: sanitizeFotoUrl(snapshot?.fotoUrl) }),
    about: `Especialista en ${specialty}. Consulta virtual disponible para evaluacion y seguimiento.`,
    services:
      Array.isArray(snapshot.tags) && snapshot.tags.length
        ? snapshot.tags
        : [`Consulta de ${specialty}`, 'Seguimiento por plataforma'],
    permitePresencial: true,
    permiteVirtual: true,
  });
};

const createGenericFallbackDoctor = (specialty: string, doctorId: string): DoctorProfile =>
  toDoctorProfile({
    id: doctorId,
    specialty,
    name: 'Especialista disponible',
    focus: specialty,
    years: 'No disponible',
    rating: 'N/D',
    reviews: 'N/D',
    languages: 'Español',
    license: 'No disponible',
    price: 'N/D',
    image: DefaultAvatar,
    about: `Perfil temporal para ${specialty}. Actualiza la lista de especialistas para ver el perfil completo.`,
    services: [`Consulta de ${specialty}`, 'Atencion virtual'],
    permitePresencial: true,
    permiteVirtual: true,
  });

const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatSlotHour = (isoValue: string) => {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getAuthToken = async (): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      return (
        localStorage.getItem(AUTH_TOKEN_KEY) ||
        localStorage.getItem(LEGACY_TOKEN_KEY) ||
        ''
      ).trim();
    }

    const secureToken =
      (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
      (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
    if (secureToken && secureToken.trim()) return secureToken.trim();

    const asyncToken =
      (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
      (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    return String(asyncToken || '').trim();
  } catch {
    return '';
  }
};

const PerfilEspecialistaAgendarScreen: React.FC = () => {

  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PerfilEspecialistaAgendar'>>();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedModalidad, setSelectedModalidad] = useState<'all' | 'presencial' | 'virtual'>('all');
  const [creatingCita, setCreatingCita] = useState(false);
  const [backendDoctor, setBackendDoctor] = useState<DoctorProfile | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<AgendaSlot[]>([]);

  const specialty = route.params?.specialty || 'Cardiologia';
  const routeDoctorId = String(route.params?.doctorId || '').trim();
  const fallbackDoctor = useMemo(() => {
    if (route.params?.doctorSnapshot) {
      return mapRouteSnapshotToProfile(route.params.doctorSnapshot, specialty, routeDoctorId);
    }
    return createGenericFallbackDoctor(specialty, routeDoctorId);
  }, [route.params?.doctorSnapshot, routeDoctorId, specialty]);
  const doctor = backendDoctor || fallbackDoctor;

  const availableDays = useMemo(() => {
    const now = new Date();
    const list: Date[] = [];
    for (let offset = 0; offset < 10; offset += 1) {
      list.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
    }
    return list;
  }, []);

  const selectedDate = useMemo(
    () => availableDays[selectedDayOffset] || availableDays[0] || new Date(),
    [availableDays, selectedDayOffset]
  );

  const selectedDateIso = useMemo(() => toIsoDate(selectedDate), [selectedDate]);
  const modalidadOptions = useMemo(() => {
    const options: Array<{ id: 'all' | 'virtual' | 'presencial'; label: string }> = [
      { id: 'all', label: 'Todas' },
    ];
    if (doctor.permiteVirtual) {
      options.push({ id: 'virtual', label: 'Virtual' });
    }
    if (doctor.permitePresencial) {
      options.push({ id: 'presencial', label: 'Presencial' });
    }
    return options;
  }, [doctor.permitePresencial, doctor.permiteVirtual]);

  useEffect(() => {
    const allowed = new Set(modalidadOptions.map((option) => option.id));
    if (!allowed.has(selectedModalidad)) {
      setSelectedModalidad('all');
    }
  }, [modalidadOptions, selectedModalidad]);

  useEffect(() => {
    const loadAvailability = async () => {
      const doctorId = String(doctor.id || '').trim();
      if (!doctorId) {
        setAvailableSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const token = await getAuthToken();
        if (!token) {
          setAvailableSlots([]);
          return;
        }

        const query = new URLSearchParams();
        query.set('medicoId', doctorId);
        query.set('fecha', selectedDateIso);
        query.set('especialidad', String(doctor.specialty || specialty).trim() || specialty);
        if (selectedModalidad !== 'all') {
          query.set('modalidad', selectedModalidad);
        }

        const response = await fetch(apiUrl(`/api/agenda/disponibilidades?${query.toString()}`), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => null);
        if (!(response.ok && payload?.success && Array.isArray(payload?.slots))) {
          setAvailableSlots([]);
          return;
        }

        const parsedSlots = payload.slots
          .map((item: any) => {
            const disponibilidadId = Number(item?.disponibilidadId);
            const horaInicio = String(item?.horaInicio || '').trim();
            const horaFin = String(item?.horaFin || '').trim();
            const modalidadRaw = String(item?.modalidad || '').trim().toLowerCase();
            const modalidad =
              modalidadRaw === 'virtual' || modalidadRaw === 'presencial'
                ? modalidadRaw
                : 'presencial';
            const slotMinutos = Number(item?.slotMinutos || 30);
            if (!Number.isFinite(disponibilidadId) || !horaInicio || !horaFin) return null;
            if (String(item?.medicoId || '').trim() !== doctorId) return null;
            return {
              disponibilidadId,
              horaInicio,
              horaFin,
              modalidad: modalidad as 'presencial' | 'virtual',
              slotMinutos: Number.isFinite(slotMinutos) ? slotMinutos : 30,
            } as AgendaSlot;
          })
          .filter((slot: AgendaSlot | null): slot is AgendaSlot => Boolean(slot))
          .sort((a: AgendaSlot, b: AgendaSlot) => new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime());

        setAvailableSlots(parsedSlots);
      } catch {
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    loadAvailability();
  }, [doctor.id, doctor.specialty, selectedDateIso, selectedModalidad, specialty]);

  const availableTimes = useMemo(
    () =>
      availableSlots.map((slot) => ({
        id: `${slot.disponibilidadId}-${slot.horaInicio}`,
        label: formatSlotHour(slot.horaInicio),
        slot,
      })),
    [availableSlots]
  );

  const selectedSlot = useMemo(
    () => availableTimes.find((slot) => slot.id === selectedTime)?.slot || null,
    [availableTimes, selectedTime]
  );

  useEffect(() => {
    if (!availableTimes.length) {
      setSelectedTime('');
      return;
    }

    if (!availableTimes.some((slot) => slot.id === selectedTime)) {
      setSelectedTime(availableTimes[0].id);
    }
  }, [availableTimes, selectedTime]);

  const selectedMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('es-DO', {
        month: 'long',
        year: 'numeric',
      }).format(selectedDate),
    [selectedDate]
  );

  useEffect(() => {
    const loadUser = async () => {
      try {
        let sessionUser: User | null = null;

        if (Platform.OS === 'web') {
          const localStorageUser = parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY));
          if (localStorageUser) sessionUser = localStorageUser;
        }

        if (!sessionUser) {
          const secureStoreUser = parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY));
          if (secureStoreUser) sessionUser = secureStoreUser;
        }

        if (!sessionUser) {
          const asyncUser = parseUser(await AsyncStorage.getItem(STORAGE_KEY));
          if (asyncUser) sessionUser = asyncUser;
        }

        sessionUser = ensurePatientSessionUser(sessionUser);

        const token = await getAuthToken();
        if (token) {
          const profileResponse = await fetch(apiUrl('/api/users/me/paciente-profile'), {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          const profilePayload = await profileResponse.json().catch(() => null);
          if (profileResponse.ok && profilePayload?.success && profilePayload?.profile) {
            const profileUser = profilePayload.profile as User;
            const cachedUserId = String((sessionUser as any)?.usuarioid || (sessionUser as any)?.id || '').trim();
            const profileUserId = String((profileUser as any)?.usuarioid || (profileUser as any)?.id || '').trim();
            if (cachedUserId && profileUserId && cachedUserId !== profileUserId) {
              sessionUser = null;
            }
            sessionUser = {
              ...(sessionUser || {}),
              ...profileUser,
              nombres: String((profileUser as any)?.nombres || '').trim(),
              apellidos: String((profileUser as any)?.apellidos || '').trim(),
              nombre: String((profileUser as any)?.nombres || (profileUser as any)?.nombre || '').trim(),
              apellido: String((profileUser as any)?.apellidos || (profileUser as any)?.apellido || '').trim(),
              fotoUrl: sanitizeFotoUrl((profileUser as any)?.fotoUrl),
            };
          } else {
            const response = await fetch(apiUrl('/api/auth/me'), {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => null);
            if (response.ok && payload?.success && payload?.user) {
              const apiUser = payload.user as User;
              const cachedUserId = String((sessionUser as any)?.usuarioid || (sessionUser as any)?.id || '').trim();
              const apiUserId = String((apiUser as any)?.usuarioid || (apiUser as any)?.id || '').trim();
              if (cachedUserId && apiUserId && cachedUserId !== apiUserId) {
                sessionUser = null;
              }
              const apiRoleId = Number((apiUser as any)?.rolid ?? (apiUser as any)?.rolId ?? (apiUser as any)?.roleId);
              if (apiRoleId === 2) {
                sessionUser = null;
              } else {
                sessionUser = {
                  ...(sessionUser || {}),
                  ...apiUser,
                  fotoUrl: sanitizeFotoUrl((apiUser as any)?.fotoUrl),
                };
              }
            }
          }

          if (sessionUser) {
            const rawNextUser = JSON.stringify(sessionUser);
            await AsyncStorage.setItem(STORAGE_KEY, rawNextUser);
            await AsyncStorage.setItem(LEGACY_USER_STORAGE_KEY, rawNextUser);
            if (Platform.OS === 'web') {
              localStorage.setItem(STORAGE_KEY, rawNextUser);
              localStorage.setItem(LEGACY_USER_STORAGE_KEY, rawNextUser);
            } else {
              await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, rawNextUser);
            }
          }
        }

        setUser(sessionUser);
      } catch {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadDoctorFromBackend = async () => {
      const doctorId = routeDoctorId;
      if (!doctorId) {
        setBackendDoctor(null);
        return;
      }

      const token = await getAuthToken();
      if (!token) {
        setBackendDoctor(null);
        return;
      }

      setLoadingDoctor(true);
      try {
        const response = await fetch(apiUrl(`/api/medicos/${doctorId}`), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => null);

        if (response.ok && payload?.success && payload?.medico) {
          setBackendDoctor(mapBackendMedicoToProfile(payload.medico as BackendMedico, specialty));
          return;
        }

        const fallbackResponse = await fetch(apiUrl('/api/medicos'), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const fallbackPayload = await fallbackResponse.json().catch(() => null);
        if (fallbackResponse.ok && fallbackPayload?.success && Array.isArray(fallbackPayload?.medicos)) {
          const byId = fallbackPayload.medicos.find(
            (item: any) => String(item?.medicoid || '').trim() === doctorId
          );
          if (byId) {
            setBackendDoctor(mapBackendMedicoToProfile(byId as BackendMedico, specialty));
            return;
          }

          const byNameAndSpecialty = fallbackPayload.medicos.find((item: any) => {
            const itemName = normalizeText(item?.nombreCompleto);
            const itemSpecialty = normalizeText(item?.especialidad);
            const doctorName = normalizeText(route.params?.doctorSnapshot?.name);
            const targetSpecialty = normalizeText(specialty);
            if (!itemName || !itemSpecialty) return false;
            const sameSpecialty =
              itemSpecialty === targetSpecialty ||
              itemSpecialty.includes(targetSpecialty) ||
              targetSpecialty.includes(itemSpecialty);
            return itemName === doctorName && sameSpecialty;
          });
          if (byNameAndSpecialty) {
            setBackendDoctor(mapBackendMedicoToProfile(byNameAndSpecialty as BackendMedico, specialty));
            return;
          }
        }

        setBackendDoctor(null);
      } catch {
        setBackendDoctor(null);
      } finally {
        setLoadingDoctor(false);
      }
    };

    loadDoctorFromBackend();
  }, [route.params?.doctorSnapshot?.name, routeDoctorId, specialty]);

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    return resolveDoctorImage({ fotoUrl: user?.fotoUrl || null });
  }, [user]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(LEGACY_USER_STORAGE_KEY);

    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
      } else {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_USER_STORAGE_KEY);
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      }
    } catch {}

    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleCreateAppointment = async () => {
    if (!selectedSlot) {
      Alert.alert('Horario no disponible', 'Selecciona otro dia u horario para continuar.');
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      Alert.alert('Sesion expirada', 'Inicia sesion nuevamente para agendar tu cita.');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    const appointmentDate = new Date(selectedSlot.horaInicio);
    if (Number.isNaN(appointmentDate.getTime())) {
      Alert.alert('Horario invalido', 'Selecciona un horario valido.');
      return;
    }

    setCreatingCita(true);
    try {
      const parsedPrice = Number.parseFloat(String(doctor.price || '').replace(/[^\d.]/g, ''));
      const requestSpecialty = String(doctor.specialty || specialty).trim() || specialty;
      const requestDoctorId = String(doctor.id || '').trim();
      const body: any = {
        disponibilidadId: selectedSlot.disponibilidadId,
        fechaHoraInicio: selectedSlot.horaInicio,
        duracionMin: selectedSlot.slotMinutos,
        modalidad: selectedSlot.modalidad,
        motivoConsulta: `Solicitud desde portal paciente - ${doctor.focus}`,
        especialidad: requestSpecialty,
      };
      if (requestDoctorId) {
        body.medicoId = requestDoctorId;
      }
      if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
        body.precio = parsedPrice;
      }

      const response = await fetch(apiUrl('/api/agenda/me/citas'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const raw = await response.text();
      let payload: any = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success) {
        Alert.alert('No se pudo agendar', payload?.message || 'Intenta nuevamente en unos minutos.');
        return;
      }

      const finalDateRaw = payload?.cita?.fechaHoraInicio || appointmentDate.toISOString();
      const finalDate = new Date(finalDateRaw);
      const finalDateText = new Intl.DateTimeFormat('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(finalDate);
      const medicoAsignado = String(payload?.cita?.medico?.nombreCompleto || doctor.name).trim();
      const modalidadLabel =
        String(payload?.cita?.modalidad || selectedSlot.modalidad || 'presencial')
          .replace(/^\w/, (m: string) => m.toUpperCase());

      Alert.alert(
        'Cita agendada',
        `Tu cita quedó creada con ${medicoAsignado} para ${finalDateText} (${modalidadLabel}).`
      );
      navigation.navigate('DashboardPaciente');
    } catch {
      Alert.alert('Error de red', 'No se pudo conectar con el backend para crear la cita.');
    } finally {
      setCreatingCita(false);
    }
  };

  if (loadingUser || loadingDoctor) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>
          {loadingDoctor ? 'Cargando especialista...' : 'Cargando informacion...'}
        </Text>
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

          <View style={styles.sidebarUserBox}>
            <Image source={userAvatarSource} style={styles.sidebarUserAvatar} />
            <Text style={styles.sidebarUserName}>{fullName}</Text>
            <Text style={styles.sidebarUserPlan}>{planLabel}</Text>
          </View>

          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('DashboardPaciente')}
            >
              <MaterialIcons name="grid-view" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.home')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('NuevaConsultaPaciente')}
            >
              <MaterialIcons name="person-search" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>{t('menu.searchDoctor')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteCitas')}
            >
              <MaterialIcons name="calendar-month" size={20} color={colors.muted} />
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

      <View style={{ flex: 1 }}>
        <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={styles.header}>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color={colors.muted} />
              <TextInput
                placeholder="Busca un medico para consulta online"
                placeholderTextColor="#8aa7bf"
                style={styles.searchInput}
              />
            </View>

            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => navigation.navigate('PacienteNotificaciones')}
            >
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
                  <Text style={styles.priceValue}>
                    {doctor.price === 'N/D' ? 'N/D' : `$${doctor.price}`}
                  </Text>
                </View>
                <View style={styles.bookingBody}>
                  <Text style={styles.sectionTitle}>Selecciona fecha de cita</Text>
                  <View style={styles.calendarCard}>
                    <Text style={styles.calendarMonth}>{selectedMonthLabel}</Text>
                    <View style={styles.daysGrid}>
                      {availableDays.map((day, index) => (
                        <TouchableOpacity
                          key={`${day.toISOString()}-${index}`}
                          style={[styles.dayBtn, selectedDayOffset === index && styles.dayBtnActive]}
                          onPress={() => setSelectedDayOffset(index)}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              selectedDayOffset === index && styles.dayTextActive,
                            ]}
                          >
                            {day.getDate()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Horarios disponibles</Text>
                  <View style={styles.modeRow}>
                    {modalidadOptions.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        style={[styles.modeBtn, selectedModalidad === option.id && styles.modeBtnActive]}
                        onPress={() => setSelectedModalidad(option.id)}
                      >
                        <Text style={[styles.modeText, selectedModalidad === option.id && styles.modeTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {loadingSlots ? (
                    <View style={styles.noTimeWrap}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.noTimeText}>Cargando disponibilidad real...</Text>
                    </View>
                  ) : availableTimes.length ? (
                    <View style={styles.timeGrid}>
                      {availableTimes.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.timeBtn, selectedTime === item.id && styles.timeBtnActive]}
                          onPress={() => setSelectedTime(item.id)}
                        >
                          <Text style={[styles.timeText, selectedTime === item.id && styles.timeTextActive]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.slotMeta, selectedTime === item.id && styles.slotMetaActive]}>
                            {item.slot.modalidad}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noTimeWrap}>
                      <Text style={styles.noTimeText}>
                        No hay horarios disponibles para este dia con esos filtros.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.confirmBtn, (creatingCita || !selectedTime) && styles.confirmBtnDisabled]}
                    onPress={handleCreateAppointment}
                    disabled={creatingCita || !selectedTime}
                  >
                    {creatingCita ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.confirmText}>Confirmar y Agendar</Text>
                        <MaterialIcons name="event-available" size={16} color="#fff" />
                      </>
                    )}
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
  logoSubtitle: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  sidebarUserBox: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 12,
  },
  sidebarUserAvatar: {
    width: 76,
    height: 76,
    borderRadius: 76,
    borderWidth: 4,
    borderColor: '#f5f7fb',
    marginBottom: 10,
  },
  sidebarUserName: {
    color: colors.dark,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  sidebarUserPlan: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
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
  menuText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  menuTextActive: { color: colors.primary, fontWeight: '800' },

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
  searchInput: {
    flex: 1,
    color: colors.dark,
    fontWeight: '600',
  },
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

  main: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 26 : 14,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
  },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 12 },
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

  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dfeaf5',
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modeBtnActive: { borderColor: colors.blue, backgroundColor: '#f2f8ff' },
  modeText: { color: colors.muted, fontWeight: '700', fontSize: 11 },
  modeTextActive: { color: colors.blue },

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
  slotMeta: { color: '#6b8ca8', fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'capitalize' },
  slotMetaActive: { color: colors.blue },
  noTimeWrap: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d7e5f4',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fcff',
  },
  noTimeText: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
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
  confirmBtnDisabled: {
    opacity: 0.65,
  },
  confirmText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});

export default PerfilEspecialistaAgendarScreen;




