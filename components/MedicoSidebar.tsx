import React, { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import type { RootStackParamList } from '../navigation/types';
import { useMedicoModule, type MedicoPortalModule } from '../navigation/MedicoModuleContext';
import { useMedicoPortalSession } from '../hooks/useMedicoPortalSession';
import { resolveRemoteImageSource } from '../utils/imageSources';

const ViremLogo = require('../assets/imagenes/descarga.png');
const DefaultAvatar = require('../assets/imagenes/avatar-default.jpg');

type MenuItem = {
  module: MedicoPortalModule;
  icon: string;
  label: string;
};

const MENU_ITEMS: MenuItem[] = [
  { module: 'DashboardMedico', icon: 'grid-view', label: 'Inicio' },
  { module: 'MedicoCitas', icon: 'calendar-today', label: 'Agenda' },
  { module: 'MedicoHorarios', icon: 'schedule', label: 'Horarios' },
  { module: 'MedicoPacientes', icon: 'group', label: 'Pacientes' },
  { module: 'MedicoRecetas', icon: 'description', label: 'Recetas y Órdenes' },
  { module: 'MedicoChat', icon: 'chat-bubble', label: 'Mensajes' },
  { module: 'MedicoConsultaVirtual', icon: 'video-call', label: 'Consulta Virtual' },
  { module: 'MedicoFinanzas', icon: 'account-balance-wallet', label: 'Finanzas' },
  { module: 'MedicoPerfil', icon: 'person', label: 'Perfil' },
  { module: 'MedicoConfiguracion', icon: 'settings', label: 'Configuración' },
];

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  white: '#FFFFFF',
};

type MedicoSidebarProps = {
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
};

const MedicoSidebar: React.FC<MedicoSidebarProps> = ({
  isMobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
}) => {
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeModule, setActiveModule, isSidebarOpen } = useMedicoModule();
  const { doctorName, doctorSpec, fotoUrl, signOut } = useMedicoPortalSession({
    syncOnMount: true,
    addDoctorPrefix: true,
  });

  const [overlayLocked, setOverlayLocked] = React.useState(false);
  const wasOpen = React.useRef(isMobileMenuOpen);
  React.useEffect(() => {
    if (!wasOpen.current && isMobileMenuOpen) {
      setOverlayLocked(true);
      const id = setTimeout(() => setOverlayLocked(false), 250);
      wasOpen.current = isMobileMenuOpen;
      return () => clearTimeout(id);
    }
    wasOpen.current = isMobileMenuOpen;
  }, [isMobileMenuOpen]);

  const handleOverlayPress = () => {
    if (overlayLocked) return;
    onCloseMobileMenu();
  };

  const userAvatarSource: ImageSourcePropType = useMemo(
    () => resolveRemoteImageSource(fotoUrl, DefaultAvatar),
    [fotoUrl]
  );

  const handleModulePress = (module: MedicoPortalModule) => {
    // Keep sidebar open on selection as per user request for consistency
    setActiveModule(module);
  };

  const handleLogout = async () => {
    onCloseMobileMenu();
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const sidebarContent = (
    <>
      <View style={styles.sidebarHeader}>
        <View style={styles.logoBox}>
          <Image source={ViremLogo} style={styles.logo} />
          <View>
            <Text style={styles.logoTitle}>VIREM</Text>
            <Text style={styles.logoSubtitle}>Portal Médico</Text>
          </View>
        </View>
        {!isDesktopLayout && (
          <TouchableOpacity onPress={onCloseMobileMenu} style={styles.closeBtn}>
            <MaterialIcons name="close" size={24} color={colors.dark} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.userBox}>
        <Image source={userAvatarSource} style={styles.userAvatar} />
        <Text style={styles.userName} numberOfLines={1}>{doctorName}</Text>
        <Text style={styles.userSpec} numberOfLines={1}>{doctorSpec}</Text>
      </View>

      <ScrollView style={{ flex: 1, marginTop: 10 }} showsVerticalScrollIndicator={false}>
        {MENU_ITEMS.map((item) => {
          const isActive = activeModule === item.module;
          return (
            <Pressable
              key={item.module}
              onPress={() => handleModulePress(item.module)}
              style={({ pressed, hovered }: any) => [
                styles.menuItem,
                isActive && styles.menuItemActive,
                hovered && !isActive && styles.menuItemHover,
                pressed && styles.menuItemPressed,
              ]}
            >
              <MaterialIcons
                name={item.icon}
                size={20}
                color={isActive ? colors.primary : colors.muted}
              />
              <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <MaterialIcons name="logout" size={18} color="#fff" />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <>
      {!isDesktopLayout && isMobileMenuOpen && (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleOverlayPress}
          />
          <View style={styles.drawerContent} onStartShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
            {sidebarContent}
          </View>
        </View>
      )}

      {isDesktopLayout && isSidebarOpen && (
        <View style={styles.sidebarDesktop}>
          {sidebarContent}
        </View>
      )}
    </>
  );
};

export default MedicoSidebar;

const styles = StyleSheet.create({
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 2000,
  },
  drawerContent: {
    width: 280,
    height: '100%',
    backgroundColor: '#fff',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarDesktop: {
    width: 280,
    height: '100%',
    backgroundColor: '#fff',
    padding: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
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
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14, textAlign: 'center' },
  userSpec: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },

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
    marginTop: 20,
  },
  logoutText: { color: '#fff', fontWeight: '800' },
});
