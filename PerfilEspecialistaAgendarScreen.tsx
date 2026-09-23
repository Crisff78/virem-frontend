import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useResponsive } from './hooks/useResponsive';
import type { ImageSourcePropType } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useLanguage } from './localization/LanguageContext';
import type { DoctorRouteSnapshot, RootStackParamList } from './navigation/types';
import { usePacienteModule, PacienteModuleProvider } from './navigation/PacienteModuleContext';
import { useAuth } from './providers/AuthProvider';
import { apiClient } from './utils/api';
import { usePatientSessionProfile, type PatientSessionUser } from './hooks/usePatientSessionProfile';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';
import PacienteSidebar from './components/PacienteSidebar';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

type User = PatientSessionUser;

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
  precio?: number;
  precio_chat?: number;
  precio_videollamada?: number;
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
  precio?: number;
  precio_chat?: number;
  precio_videollamada?: number;
};

type AgendaSlot = {
  disponibilidadId: number;
  horaInicio: string;
  horaFin: string;
  modalidad: 'presencial' | 'virtual';
  slotMinutos: number;
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
  genero?: string;
  precio?: number;
  precio_chat?: number;
  precio_videollamada?: number;
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
    `Especialista en ${specialty}. Puedes agendar una consulta virtual para evaluación y seguimiento clínico.`;
  const services =
    Array.isArray(value.services) && value.services.length
      ? value.services
      : [
          `Consulta de ${specialty}`,
          'Orientación clínica y plan de manejo',
          'Seguimiento por plataforma',
        ];

  const isFemale = String(value.genero || '').toLowerCase().startsWith('m') || String(value.genero || '').toLowerCase() === 'f';
  const title = isFemale ? 'Dra.' : 'Dr.';
  const nameWithTitle = name.toLowerCase().startsWith('dr') ? name : `${title} ${name}`;

  return {
    id: String(value.id || '').trim(),
    specialty,
    name: nameWithTitle,
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
    precio: value.precio,
    precio_chat: value.precio_chat,
    precio_videollamada: value.precio_videollamada,
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
    name: name,
    genero: medico?.genero,
    focus: specialty,
    years: 'No disponible',
    rating: 'N/D',
    reviews: 'N/D',
    languages: 'Español',
    license: cedula || 'No disponible',
    price: String(medico?.precio || 0),
    fotoUrl: fotoUrl || null,
    image: resolveDoctorImage({ fotoUrl }),
    about: `Especialista en ${specialty}. Puedes agendar una consulta virtual para evaluación y seguimiento clínico.`,
    services: [
      `Consulta de ${specialty}`,
      'Orientación clínica y plan de manejo',
      telefono ? `Contacto: ${telefono}` : 'Seguimiento por plataforma',
    ],
    permitePresencial: medico?.permitePresencial !== false,
    permiteVirtual: medico?.permiteVirtual !== false,
    precio: medico?.precio,
    precio_chat: medico?.precio_chat,
    precio_videollamada: medico?.precio_videollamada,
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
    about: `Especialista en ${specialty}. Consulta virtual disponible para evaluación y seguimiento.`,
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
    services: [`Consulta de ${specialty}`, 'Atención virtual'],
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

const formatPrice = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Consultar';
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(n);
};

const PerfilEspecialistaAgendarScreen: React.FC = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PerfilEspecialistaAgendar'>>();
  const { isInsidePortal, isSidebarOpen, toggleSidebar } = usePacienteModule();
  const closeSidebar = useCallback(() => {
    if (isSidebarOpen) toggleSidebar();
  }, [isSidebarOpen, toggleSidebar]);
  const { signOut } = useAuth();
  const { sessionUser, syncProfile } = usePatientSessionProfile();
  const { isDesktop, isTablet, isMobile, select } = useResponsive();
  const [user, setUser] = useState<User | null>(() => (ensurePatientSessionUser(sessionUser) as User | null) || null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedModalidad, setSelectedModalidad] = useState<'all' | 'presencial' | 'virtual'>('all');
  const [virtualSubtype, setVirtualSubtype] = useState<'chat' | 'videollamada'>('videollamada');
  const [creatingCita, setCreatingCita] = useState(false);
  const [backendDoctor, setBackendDoctor] = useState<DoctorProfile | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<AgendaSlot[]>([]);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [slotsLimit, setSlotsLimit] = useState(6);
  const isDesktopLayout = isDesktop;
  
  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const specialty = route.params?.specialty || 'Cardiología';
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
        const query = new URLSearchParams();
        query.set('medicoId', doctorId);
        query.set('fecha', selectedDateIso);
        query.set('especialidad', String(doctor.specialty || specialty).trim() || specialty);
        if (selectedModalidad !== 'all') {
          query.set('modalidad', selectedModalidad);
        }

        const payload = await apiClient.get<any>('/api/agenda/disponibilidades', {
          authenticated: true,
          query: Object.fromEntries(query.entries()),
        });
        if (!(payload?.success && Array.isArray(payload?.slots))) {
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
  
  const visibleTimes = useMemo(() => availableTimes.slice(0, slotsLimit), [availableTimes, slotsLimit]);

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
    if (sessionUser) {
      setUser((ensurePatientSessionUser(sessionUser) as User | null) || null);
      setLoadingUser(false);
    }
  }, [sessionUser]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const nextSessionUser = (await syncProfile()) as User | null;
        setUser((ensurePatientSessionUser(nextSessionUser) as User | null) || null);
      } catch {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };

    loadUser();
  }, [syncProfile]);

  useEffect(() => {
    const loadDoctorFromBackend = async () => {
      const doctorId = routeDoctorId;
      if (!doctorId) {
        setBackendDoctor(null);
        return;
      }

      setLoadingDoctor(true);
      try {
        const payload = await apiClient.get<any>(`/api/medicos/${doctorId}`, {
          authenticated: true,
        });
        if (payload?.success && payload?.medico) {
          setBackendDoctor(mapBackendMedicoToProfile(payload.medico as BackendMedico, specialty));
          return;
        }

        const fallbackPayload = await apiClient.get<any>('/api/medicos', {
          authenticated: true,
        });
        if (fallbackPayload?.success && Array.isArray(fallbackPayload?.medicos)) {
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

  const currentCalculatedPrice = useMemo(() => {
    if (!selectedSlot) return 0;
    
    // Usamos el precio que se muestra en el perfil para que coincida exactamente
    const displayedPrice = Number(String(doctor.price || '0').replace(/[^\d.]/g, ''));
    
    return displayedPrice;
  }, [doctor, selectedSlot]);

  const commissionAmount = useMemo(() => {
    return Number((currentCalculatedPrice * 0.15).toFixed(2));
  }, [currentCalculatedPrice]);

  const netDoctorProfit = useMemo(() => {
    return Number((currentCalculatedPrice - commissionAmount).toFixed(2));
  }, [currentCalculatedPrice, commissionAmount]);

  const handleBookingConfirm = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleCreateAppointment = async () => {
    if (!selectedSlot) {
      Alert.alert('Horario no disponible', 'Selecciona otro dia u horario para continuar.');
      return;
    }

    const appointmentDate = new Date(selectedSlot.horaInicio);
    if (Number.isNaN(appointmentDate.getTime())) {
      Alert.alert('Horario inválido', 'Selecciona un horario válido.');
      return;
    }

    const finalPriceToPay = currentCalculatedPrice;
    if (finalPriceToPay > 0 && !paymentModalVisible) {
      setPaymentModalVisible(true);
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
        virtualSubtype: selectedSlot.modalidad === 'virtual' ? virtualSubtype : null,
        motivoConsulta: `Solicitud desde portal paciente - ${doctor.focus}`,
        especialidad: requestSpecialty,
        precio: currentCalculatedPrice,
      };
      if (paymentModalVisible && currentCalculatedPrice > 0) {
        body.pagoInfo = {
          metodo: 'tarjeta',
          titular: cardHolder,
          terminacion: cardNumber.slice(-4),
        };
      }
      if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
        body.precio = currentCalculatedPrice; // Use the UI calculated price
        if (selectedSlot.modalidad === 'virtual') {
          body.virtualSubtype = virtualSubtype;
        }
        if (currentCalculatedPrice > 0) {
          body.pagoInfo = {
            metodo: 'tarjeta',
            titular: cardHolder,
            terminacion: cardNumber.slice(-4),
          };
        }
      }
 
      const payload = await apiClient.post<any>('/api/agenda/me/citas', {
        authenticated: true,
        body,
      });
      if (!payload?.success) {
        setPaymentModalVisible(false);
        Alert.alert('No se pudo agendar', payload?.message || 'Intenta nuevamente en unos minutos.');
        return;
      }
 
      setPaymentModalVisible(false);

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
          {loadingDoctor ? 'Cargando especialista...' : 'Cargando información...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, !isInsidePortal && isDesktop && { flexDirection: 'row' }]}>
      {!isInsidePortal && (
        <PacienteSidebar
          isMobileMenuOpen={isSidebarOpen}
          onToggleMobileMenu={toggleSidebar}
          onCloseMobileMenu={closeSidebar}
        />
      )}
      <View style={{ flex: 1 }}>
        <View style={[styles.header, !isDesktop && styles.headerMobile]}>
          {!isSidebarOpen && (
            <TouchableOpacity 
              style={styles.hamburgerBtn} 
              onPress={toggleSidebar}
            >
              <MaterialIcons name="menu" size={26} color={colors.dark} />
            </TouchableOpacity>
          )}

          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              placeholder="Busca servicios, medicos..."
              placeholderTextColor="#8aa7bf"
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => setIsNotificationsOpen(true)}
          >
            <MaterialIcons name="notifications" size={22} color={colors.dark} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={[styles.main, !isDesktop && styles.mainMobile]}
          contentContainerStyle={{ paddingBottom: 28 }}
        >
          <View style={[styles.breadcrumbRow, (isTablet || isMobile) && styles.breadcrumbRowMobile]}>
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

          <View style={[styles.contentRow, (isTablet || isMobile) && styles.contentRowMobile]}>
            <View style={{ flex: 1 }}>
              <View style={styles.profileCard}>
                <View style={[styles.profileTop, (isTablet || isMobile) && styles.profileTopMobile]}>
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

                    {doctor.years !== 'No disponible' && (
                      <View style={styles.dataItem}>
                        <MaterialIcons name="work-outline" size={16} color={colors.blue} />
                        <Text style={styles.dataText}>Experiencia: {doctor.years}</Text>
                      </View>
                    )}
                    
                    {doctor.rating !== 'N/D' && (
                      <View style={styles.dataItem}>
                        <MaterialIcons name="star" size={16} color="#fbbf24" />
                        <Text style={styles.dataText}>
                          Valoración: {doctor.rating} ({doctor.reviews} reseñas)
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.dataItem}>
                      <MaterialIcons name="language" size={16} color={colors.blue} />
                      <Text style={styles.dataText}>Idiomas: {doctor.languages}</Text>
                    </View>

                    <View style={styles.tagsRow}>
                      {doctor.license !== 'No disponible' && (
                        <View style={styles.tagBlue}>
                          <Text style={styles.tagBlueText}>Colegiado {doctor.license}</Text>
                        </View>
                      )}
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

            <View style={[styles.bookingCol, !isDesktop && styles.bookingColMobile]}>
              <View style={styles.bookingCard}>
                <View style={styles.bookingTop}>
                  <Text style={styles.priceLabel}>Precio de consulta</Text>
                  <Text style={styles.priceValue}>
                    {doctor.price === 'N/D' ? 'Consultar' : `$${doctor.price}`}
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
                  <View style={[styles.modeRow, !isDesktop && styles.modeRowMobile]}>
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
                    <View>
                      <View style={styles.timeGrid}>
                        {visibleTimes.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.timeBtn,
                              !isDesktop && styles.timeBtnMobile,
                              selectedTime === item.id && styles.timeBtnActive,
                            ]}
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
                      {availableTimes.length > 6 && (
                        <TouchableOpacity
                          style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
                          onPress={() => {
                            if (slotsLimit >= availableTimes.length) {
                              setSlotsLimit(6);
                            } else {
                              setSlotsLimit(prev => prev + 10);
                            }
                          }}
                        >
                          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                            {slotsLimit >= availableTimes.length ? 'Ver menos horarios' : 'Ver más horarios'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.noTimeWrap}>
                      <Text style={styles.noTimeText}>
                        No hay horarios disponibles para este día con esos filtros.
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
          {/* Modal de Simulación de Pago */}
          <Modal
            visible={paymentModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setPaymentModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContainer}
              >
                <View style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                      <MaterialIcons name="close" size={24} color={colors.dark} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginBottom: 20, alignItems: 'center' }}>
                    <MaterialIcons name="info-outline" size={20} color={colors.primary} />
                    <Text style={[styles.selectorBtnSubtext, { marginTop: 4, fontSize: 12 }]}>
                      El servicio de Chat de coordinación está incluido con tu consulta.
                    </Text>
                  </View>

                  <View style={styles.paymentBreakdown}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Total a pagar</Text>
                      <Text style={styles.breakdownValue}>${currentCalculatedPrice}</Text>
                    </View>
                    <View style={styles.breakdownDivider} />
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownSubLabel}>Comisión plataforma (15%)</Text>
                      <Text style={styles.breakdownSubValue}>-${commissionAmount}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownSubLabel}>Neto para especialista</Text>
                      <Text style={styles.breakdownSubValue}>${netDoctorProfit}</Text>
                    </View>
                  </View>

                  <Text style={styles.paymentInstructions}>
                    Esta es una simulación. Puedes ingresar datos de prueba.
                  </Text>

                  <View style={styles.cardInputGroup}>
                    <Text style={styles.inputLabel}>Titular de la tarjeta</Text>
                    <TextInput
                      style={styles.paymentInput}
                      placeholder="Ej. Juan Pérez"
                      value={cardHolder}
                      onChangeText={setCardHolder}
                    />
                  </View>

                  <View style={styles.cardInputGroup}>
                    <Text style={styles.inputLabel}>Número de tarjeta</Text>
                    <TextInput
                      style={styles.paymentInput}
                      placeholder="0000 0000 0000 0000"
                      keyboardType="numeric"
                      value={cardNumber}
                      onChangeText={(t) => {
                        const digits = t.replace(/\D/g, '');
                        const formatted = digits.replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
                        setCardNumber(formatted);
                      }}
                      maxLength={19}
                    />
                  </View>

                  <View style={styles.rowInputs}>
                    <View style={[styles.cardInputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Expiración</Text>
                      <TextInput
                        style={styles.paymentInput}
                        placeholder="MM/AA"
                        keyboardType="numeric"
                        value={cardExpiry}
                        onChangeText={(t) => {
                          const digits = t.replace(/\D/g, '');
                          if (digits.length <= 2) {
                            setCardExpiry(digits);
                          } else {
                            setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2, 4)}`);
                          }
                        }}
                        maxLength={5}
                      />
                    </View>
                    <View style={[styles.cardInputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>CVV</Text>
                      <TextInput
                        style={styles.paymentInput}
                        placeholder="000"
                        keyboardType="numeric"
                        secureTextEntry
                        value={cardCVV}
                        onChangeText={(t) => {
                          setCardCVV(t.replace(/\D/g, '').slice(0, 3));
                        }}
                        maxLength={3}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.payBtn,
                      (!cardHolder || !cardNumber) && styles.payBtnDisabled,
                    ]}
                    onPress={handleCreateAppointment}
                    disabled={creatingCita || !cardHolder || !cardNumber}
                  >
                    {creatingCita ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="lock" size={18} color="#fff" />
                        <Text style={styles.payBtnText}>Pagar y Agendar Cita</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.securityBox}>
                    <MaterialIcons name="security" size={14} color={colors.muted} />
                    <Text style={styles.securityText}>Pago 100% seguro y encriptado</Text>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        </ScrollView>
        {/* Notificaciones Modal Overlay */}
        <Modal
          visible={isNotificationsOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsNotificationsOpen(false)}
        >
          <View style={styles.modalRoot}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setIsNotificationsOpen(false)}
            />
            <View style={[styles.drawerRight]}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>Notificaciones</Text>
                <TouchableOpacity onPress={() => setIsNotificationsOpen(false)}>
                  <MaterialIcons name="close" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                <View style={[styles.emptyCard, { borderStyle: 'solid', marginTop: 40, borderWidth: 0 }]}>
                  <MaterialIcons name="notifications-none" size={40} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontWeight: '600', marginTop: 10, fontSize: 14 }}>
                    No tienes notificaciones
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  containerDesktop: { flexDirection: 'row' },
  containerTablet: { flexDirection: 'row' },
  containerMobile: { flexDirection: 'column' },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loaderText: { marginTop: 8, color: colors.muted, fontWeight: '700' },
  sidebar: {
    backgroundColor: colors.white,
    borderRightColor: '#eef2f7',
    borderBottomColor: '#eef2f7',
    padding: 20,
    justifyContent: 'space-between',
  },
  sidebarDesktop: {
    width: 280,
    borderRightWidth: 1,
    borderBottomWidth: 0,
  },
  sidebarTablet: {
    width: 80,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 8,
  },
  sidebarMobile: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    padding: 14,
  },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  closeSidebarBtn: {
    padding: 5,
    marginRight: -5,
  },
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
  menuDesktop: { flexDirection: 'column' },
  menuMobile: { flexDirection: 'column', paddingBottom: 20 },
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
  mainMobile: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 12 },
  breadcrumbRowMobile: { flexWrap: 'wrap' },
  breadcrumbLink: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  breadcrumbCurrent: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  contentRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
    alignItems: 'flex-start',
  },
  contentRowMobile: {
    flexDirection: 'column',
  },
  bookingCol: { width: Platform.OS === 'web' ? 340 : '100%' },
  bookingColMobile: { width: '100%' },

  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e4edf6',
    padding: 16,
    marginBottom: 12,
  },
  profileTop: { flexDirection: 'row', gap: 14 },
  profileTopMobile: { flexDirection: 'column' },
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
    padding: 0,
  },
  dayBtnActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  dayText: { color: colors.dark, fontWeight: '700', fontSize: 11 },
  dayTextActive: { color: '#fff' },

  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  modeRowMobile: { flexWrap: 'wrap' },
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
  timeBtnMobile: {
    width: '48%',
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
  
  // Modal de Pago
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 49, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 450,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  paymentTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.dark,
  },
  paymentInstructions: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modalidadSelector: {
    marginBottom: 20,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 10,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  selectorBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  selectorBtnActiveText: {
    color: '#fff',
  },
  selectorBtnSubtext: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    marginTop: -2,
  },
  selectorPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  paymentBreakdown: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  breakdownValue: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primary,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#cbd5e1',
    marginVertical: 8,
  },
  breakdownSubLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  breakdownSubValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  cardInputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 6,
    marginLeft: 4,
  },
  paymentInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.dark,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 16,
  },
  payBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  payBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  securityText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '700',
  },
  hamburgerBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerMobile: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  drawerRight: {
    backgroundColor: '#fff',
    width: Platform.OS === 'web' ? 320 : '100%',
    height: Platform.OS === 'web' ? '100%' : 400,
    borderTopLeftRadius: Platform.OS === 'web' ? 0 : 20,
    borderTopRightRadius: Platform.OS === 'web' ? 0 : 20,
    padding: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.dark,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
  },
});

const PerfilEspecialistaAgendarScreenWrapper: React.FC = (props) => (
  <PacienteModuleProvider initialModule="NuevaConsultaPaciente">
    <PerfilEspecialistaAgendarScreen {...props} />
  </PacienteModuleProvider>
);

export default PerfilEspecialistaAgendarScreenWrapper;
