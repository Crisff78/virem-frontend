import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePortalAwareNavigation } from './navigation/usePortalAwareNavigation';
import { usePacienteModule, PacienteModuleProvider } from './navigation/PacienteModuleContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootStackParamList } from './navigation/types';
import { useAuth } from './providers/AuthProvider';
import { apiClient } from './utils/api';

import { useLanguage } from './localization/LanguageContext';
import { usePatientSessionProfile, type PatientSessionUser } from './hooks/usePatientSessionProfile';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';
import { useResponsive } from './hooks/useResponsive';
import PacienteSidebar from './components/PacienteSidebar';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

type User = PatientSessionUser;

type SpecialtyItem = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  description: string;
  totalMedicos: number;
};

type SpecialtyCardProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  description: string;
  onPress: () => void;
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

const resolveAvatarSource = (value: unknown): ImageSourcePropType => {
  const clean = sanitizeFotoUrl(value);
  if (clean) {
    return { uri: clean };
  }
  return DefaultAvatar;
};

const FALLBACK_SPECIALTIES: SpecialtyItem[] = [
  { icon: 'heart-outline', label: 'Cardiologia', description: 'Corazon y sistema circulatorio', totalMedicos: 0 },
  { icon: 'baby-face-outline', label: 'Pediatria', description: 'Atencion integral para niños', totalMedicos: 0 },
  { icon: 'brain', label: 'Neurologia', description: 'Cerebro y sistema nervioso', totalMedicos: 0 },
  { icon: 'face-man-outline', label: 'Dermatologia', description: 'Cuidado de la piel y cabello', totalMedicos: 0 },
  { icon: 'stethoscope', label: 'Medicina General', description: 'Atencion primaria inicial', totalMedicos: 0 },
  { icon: 'eye-outline', label: 'Oftalmologia', description: 'Salud visual y ocular', totalMedicos: 0 },
  { icon: 'food-apple-outline', label: 'Nutricion', description: 'Dieta y bienestar alimenticio', totalMedicos: 0 },
  { icon: 'pill', label: 'Endocrinologia', description: 'Hormonas y metabolismo', totalMedicos: 0 },
];

const getSpecialtyIcon = (specialtyName: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] => {
  const key = normalizeText(specialtyName);
  if (key.includes('cardio')) return 'heart-outline';
  if (key.includes('pedia')) return 'baby-face-outline';
  if (key.includes('neuro')) return 'brain';
  if (key.includes('derma')) return 'face-man-outline';
  if (key.includes('general')) return 'stethoscope';
  if (key.includes('oftal')) return 'eye-outline';
  if (key.includes('nutri')) return 'food-apple-outline';
  if (key.includes('endo')) return 'pill';
  if (key.includes('psico')) return 'head-cog-outline';
  if (key.includes('gine')) return 'human-female';
  if (key.includes('odonto')) return 'tooth-outline';
  return 'stethoscope';
};

const getSpecialtyDescription = (specialtyName: string, totalMedicos: number) => {
  const key = normalizeText(specialtyName);
  if (key.includes('cardio')) return 'Corazon y sistema circulatorio';
  if (key.includes('pedia')) return 'Atencion integral para niños';
  if (key.includes('neuro')) return 'Cerebro y sistema nervioso';
  if (key.includes('derma')) return 'Cuidado de la piel y cabello';
  if (key.includes('general')) return 'Atencion primaria inicial';
  if (key.includes('oftal')) return 'Salud visual y ocular';
  if (key.includes('nutri')) return 'Dieta y bienestar alimenticio';
  if (key.includes('endo')) return 'Hormonas y metabolismo';
  if (key.includes('psico')) return 'Salud mental y emocional';
  if (key.includes('gine')) return 'Salud femenina y reproductiva';
  if (key.includes('odonto')) return 'Salud oral y dental';
  if (totalMedicos > 0) return `${totalMedicos} medico(s) disponible(s)`;
  return 'Consulta medica especializada';
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

  const { t, tx } = useLanguage();
  const navigation = usePortalAwareNavigation();
  const { signOut } = useAuth();
  const { isInsidePortal, isSidebarOpen, toggleSidebar, setIsNotificationsOpen } = usePacienteModule();
  const closeSidebar = useCallback(() => {
    if (isSidebarOpen) toggleSidebar();
  }, [isSidebarOpen, toggleSidebar]);
  const { isDesktop: isDesktopLayout, isTablet: isTabletLayout } = useResponsive();
  const { sessionUser, syncProfile } = usePatientSessionProfile();
  const { width: viewportWidth } = useWindowDimensions();
  const [user, setUser] = useState<User | null>(() => (ensurePatientSessionUser(sessionUser) as User | null) || null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [specialtyList, setSpecialtyList] = useState<SpecialtyItem[]>(FALLBACK_SPECIALTIES);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);

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
    const loadSpecialties = async () => {
      setLoadingSpecialties(true);
      try {
        const byCatalogPayload = await apiClient.get<any>('/api/medicos/especialidades', {
          authenticated: true,
        });
        if (
          byCatalogPayload?.success &&
          Array.isArray(byCatalogPayload?.especialidades)
        ) {
          const items: SpecialtyItem[] = byCatalogPayload.especialidades
            .map((item: any) => {
              const name = String(item?.nombre || '').trim();
              const total = Number(item?.totalMedicos || 0);
              if (!name) return null;
              return {
                icon: getSpecialtyIcon(name),
                label: name,
                description: getSpecialtyDescription(name, total),
                totalMedicos: Number.isFinite(total) ? total : 0,
              } as SpecialtyItem;
            })
            .filter((item: SpecialtyItem | null): item is SpecialtyItem => Boolean(item))
            .sort((a: SpecialtyItem, b: SpecialtyItem) => b.totalMedicos - a.totalMedicos || a.label.localeCompare(b.label, 'es'));

          if (items.length) {
            setSpecialtyList(items);
            return;
          }
        }

        const byMedicosPayload = await apiClient.get<any>('/api/medicos', {
          authenticated: true,
        });
        if (byMedicosPayload?.success && Array.isArray(byMedicosPayload?.medicos)) {
          const counts = new Map<string, number>();
          for (const medico of byMedicosPayload.medicos) {
            const name = String(medico?.especialidad || 'Medicina General').trim() || 'Medicina General';
            counts.set(name, (counts.get(name) || 0) + 1);
          }

          const items: SpecialtyItem[] = Array.from(counts.entries())
            .map(([name, total]) => ({
              icon: getSpecialtyIcon(name),
              label: name,
              description: getSpecialtyDescription(name, total),
              totalMedicos: total,
            }))
            .sort((a, b) => b.totalMedicos - a.totalMedicos || a.label.localeCompare(b.label, 'es'));

          if (items.length) {
            setSpecialtyList(items);
            return;
          }
        }

        setSpecialtyList(FALLBACK_SPECIALTIES);
      } catch {
        setSpecialtyList(FALLBACK_SPECIALTIES);
      } finally {
        setLoadingSpecialties(false);
      }
    };

    loadSpecialties();
  }, []);

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user]);

  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    return resolveAvatarSource(user?.fotoUrl);
  }, [user]);

  const filteredSpecialties = useMemo(() => {
    const query = normalizeText(searchText);
    if (!query) return specialtyList;
    return specialtyList.filter((item) => {
      return (
        normalizeText(item.label).includes(query) ||
        normalizeText(item.description).includes(query)
      );
    });
  }, [searchText, specialtyList]);

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const onSelectSpecialty = (label: string) => {
    navigation.navigate('EspecialistasPorEspecialidad', { specialty: label });
  };

  const specialtyColumnStyle = isDesktopLayout
    ? styles.specialtyColumnDesktop
    : isTabletLayout
      ? styles.specialtyColumnTablet
      : styles.specialtyColumnMobile;

  const [showAllSpecialties, setShowAllSpecialties] = useState(false);
  const displayLimit = isDesktopLayout ? 8 : 4;

  const displayedSpecialties = useMemo(() => {
    // Si hay búsqueda, mostramos todo lo que coincida
    if (searchText.trim().length > 0) return filteredSpecialties;
    // Si no, mostramos el límite (8 en PC, 4 en móvil) o todas según el botón
    return showAllSpecialties ? filteredSpecialties : filteredSpecialties.slice(0, displayLimit);
  }, [filteredSpecialties, searchText, showAllSpecialties, displayLimit]);

  return (
    <View style={[styles.container, !isInsidePortal && isDesktopLayout && { flexDirection: 'row' }]}>
      {!isInsidePortal && (
        <PacienteSidebar
          isMobileMenuOpen={isSidebarOpen}
          onToggleMobileMenu={toggleSidebar}
          onCloseMobileMenu={closeSidebar}
        />
      )}
      <View style={{ flex: 1 }}>
        {/* Header Fijo fuera del ScrollView */}
        <View style={[styles.header, !isDesktopLayout && styles.headerMobile]}>
          {!isSidebarOpen && (
            <TouchableOpacity 
              style={styles.hamburgerBtn} 
              onPress={toggleSidebar}
            >
              <MaterialIcons name="menu" size={26} color={colors.dark} />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => setIsNotificationsOpen(true)}
          >
            <MaterialIcons name="notifications" size={22} color={colors.dark} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

      <ScrollView
        style={[styles.main, !isDesktopLayout && styles.mainMobile]}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View style={styles.centerHeader}>
          <Text style={styles.pageTitle}>
            {tx({
              es: 'Solicitar Nueva Consulta',
              en: 'Request New Consultation',
              pt: 'Solicitar Nova Consulta',
            })}
          </Text>
          <Text style={styles.pageSubtitle}>
            ¿En qué podemos ayudarte hoy? Selecciona una especialidad para comenzar.
          </Text>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={19} color={colors.muted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchField}
            placeholder="Busca síntomas o especialidades..."
            placeholderTextColor="#8ca7bd"
          />
        </View>

        <View style={styles.quickSearchRow}>
          <Text style={styles.quickSearchLabel}>Populares:</Text>
          {specialtyList.slice(0, 3).map((item) => (
            <Text key={item.label} style={styles.quickSearchItem}>
              {item.label}
            </Text>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Especialidades Médicas</Text>
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Text style={styles.sectionLink}>
              {loadingSpecialties ? 'Actualizando...' : `${specialtyList.length} disponibles`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.specialtiesGrid}>
          {displayedSpecialties.map((item) => (
            <View key={item.label} style={specialtyColumnStyle}>
              <SpecialtyCard
                icon={item.icon}
                label={item.label}
                description={item.description}
                onPress={() => onSelectSpecialty(item.label)}
              />
              <Text style={styles.specialtyCountText}>
                {item.totalMedicos > 0
                  ? `${item.totalMedicos} médicos`
                  : 'Disponible'}
              </Text>
            </View>
          ))}
          
          {!displayedSpecialties.length ? (
            <View style={styles.emptySpecialtyWrap}>
              <Text style={styles.emptySpecialtyText}>
                No se encontraron resultados para "{searchText.trim()}".
              </Text>
            </View>
          ) : null}
        </View>

        {/* Botón Ver Más / Ver Menos */}
        {!searchText.trim() && specialtyList.length > displayLimit && (
          <TouchableOpacity 
            style={styles.showMoreBtn} 
            onPress={() => setShowAllSpecialties(!showAllSpecialties)}
          >
            <Text style={styles.showMoreText}>
              {showAllSpecialties ? 'Ver menos' : `Ver todas (${specialtyList.length})`}
            </Text>
            <MaterialIcons 
              name={showAllSpecialties ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={20} 
              color={colors.primary} 
            />
          </TouchableOpacity>
        )}

        <View style={styles.expressCard}>
          <View style={styles.expressLeft}>
            <View style={styles.expressIconWrap}>
              <MaterialIcons name="emergency" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.expressTitle}>¿Atención inmediata?</Text>
              <Text style={styles.expressSubtitle}>
                Médicos de guardia 24/7 para videoconsultas de urgencia.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.expressBtn}
            onPress={() =>
              navigation.navigate('EspecialistasPorEspecialidad', { specialty: 'Medicina General' })
            }
          >
            <MaterialIcons name="bolt" size={18} color="#fff" />
            <Text style={styles.expressBtnText}>Consulta Express</Text>
          </TouchableOpacity>
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
  light: '#B3CFE5',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 2000,
  },
  drawerContent: {
    width: 280,
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 20,
  },
  sidebarContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  hamburgerBtn: {
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
  menuScroll: {
    flex: 1,
    marginTop: 20,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: 'rgba(19,127,236,0.1)',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  menuTextActive: {
    color: colors.primary,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 30,
    paddingHorizontal: 5,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1,
  },
  logoSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    marginTop: -2,
    textTransform: 'uppercase',
  },
  userBox: {
    padding: 16,
    backgroundColor: '#f8fbff',
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eef4fb',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
    textAlign: 'center',
  },
  userPlan: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '800',
  },

  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Platform.OS === 'web' ? 26 : 14,
    paddingVertical: 12,
    backgroundColor: colors.bg,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef4fb',
  },
  headerMobile: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: colors.dark,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchInput: { flex: 1, color: colors.dark, fontWeight: '600', fontSize: 13 },
  notifBtn: {
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
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },

  centerHeader: { alignItems: 'center', marginBottom: 20, marginTop: 15 },
  pageTitle: {
    color: colors.dark,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 30,
  },
  pageSubtitle: {
    marginTop: 6,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 13,
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
  quickSearchLabel: { color: '#7292ad', fontSize: 11 },
  quickSearchItem: { color: colors.blue, fontWeight: '700', fontSize: 11 },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.dark, fontSize: 15, fontWeight: '900' },
  sectionLink: { color: colors.blue, fontWeight: '800', fontSize: 12 },

  specialtiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  specialtyColumnDesktop: {
    width: '24%',
    minWidth: 180,
  },
  specialtyColumnTablet: {
    width: '48%',
    minWidth: 0,
  },
  specialtyColumnMobile: {
    width: '48%',
    minWidth: 0,
  },
  specialtyCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4edf6',
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  specialtyCardHover: {
    borderColor: 'rgba(19,127,236,0.45)',
    shadowColor: colors.dark,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  specialtyCardPressed: { transform: [{ scale: 0.98 }] },
  specialtyIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#eef5fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  specialtyIconBoxHover: { backgroundColor: colors.blue },
  specialtyTitle: {
    color: colors.dark,
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
  specialtyTitleHover: { color: colors.blue },
  specialtyDescription: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  specialtyCountText: {
    marginTop: 5,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  emptySpecialtyWrap: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#dbe7f2',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#f9fcff',
  },
  emptySpecialtyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
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
  showMoreBtn: {
    marginTop: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  showMoreText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
});

const NuevaConsultaPacienteScreenWrapper: React.FC = (props) => (
  <PacienteModuleProvider initialModule="NuevaConsultaPaciente">
    <NuevaConsultaPacienteScreen {...props} />
  </PacienteModuleProvider>
);

export default NuevaConsultaPacienteScreenWrapper;




