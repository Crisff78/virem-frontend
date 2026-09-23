import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';

import { useLanguage } from '../localization/LanguageContext';
import type { RootStackParamList } from '../navigation/types';
import { usePacienteModule, type PortalModule } from '../navigation/PacienteModuleContext';
import { usePatientPortalSession } from '../hooks/usePatientPortalSession';
import { resolveRemoteImageSource } from '../utils/imageSources';

const ViremLogo = require('../assets/imagenes/descarga.png');
const DefaultAvatar = require('../assets/imagenes/avatar-default.jpg');

type MenuItem = {
  module: PortalModule;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  labelKey: string;
};

const MENU_ITEMS: MenuItem[] = [
  { module: 'DashboardPaciente', icon: 'grid-view', labelKey: 'menu.home' },
  { module: 'NuevaConsultaPaciente', icon: 'person-search', labelKey: 'menu.searchDoctor' },
  { module: 'PacienteCitas', icon: 'calendar-today', labelKey: 'menu.appointments' },
  { module: 'WaitingRoom', icon: 'videocam', labelKey: 'menu.videocall' },
  { module: 'PacienteChat', icon: 'chat-bubble', labelKey: 'menu.chat' },
  { module: 'PacienteAsistente', icon: 'auto-awesome', labelKey: 'menu.assistant' },
  { module: 'PacienteRecetasDocumentos', icon: 'description', labelKey: 'menu.recipesDocs' },
  { module: 'PacientePerfil', icon: 'account-circle', labelKey: 'menu.profile' },
  { module: 'PacienteConfiguracion', icon: 'settings', labelKey: 'menu.settings' },
];

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  white: '#FFFFFF',
};

type PacienteSidebarProps = {
  /** Controls whether the mobile menu is open (managed by parent). */
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
};

const PacienteSidebar: React.FC<PacienteSidebarProps> = ({
  isMobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
}) => {
  const { t } = useLanguage();
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeModule, portalNavigate } = usePacienteModule();
  const { fullName, planLabel, fotoUrl, hasProfilePhoto, signOut } = usePatientPortalSession({
    syncOnMount: true,
  });

  const userAvatarSource: ImageSourcePropType = useMemo(
    () => resolveRemoteImageSource(fotoUrl, DefaultAvatar),
    [fotoUrl]
  );

  // When the menu opens, ignore the first overlay tap for ~250ms so the same
  // click that triggered the open doesn't bubble through to the close handler.
  const [overlayLocked, setOverlayLocked] = useState(false);
  const wasOpen = useRef(isMobileMenuOpen);
  useEffect(() => {
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

  const handleModulePress = (module: PortalModule) => {
    portalNavigate(module);
    if (!isDesktopLayout) onCloseMobileMenu();
  };

  const handleLogout = async () => {
    onCloseMobileMenu();
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <>
      {/* Drawer Overlay for Mobile */}
      {!isDesktopLayout && isMobileMenuOpen && (
        <View style={styles.drawerOverlay}>
          {/* Overlay background - tapping here closes the menu */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleOverlayPress}
          />
          {/* Drawer panel - captures touches so they don't bubble to overlay */}
          <View
            style={styles.drawerContent}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Logo & Close Button */}
            <View style={styles.sidebarHeader}>
              <View style={styles.logoBox}>
                <Image source={ViremLogo} style={styles.logo} />
                <View>
                  <Text style={styles.logoTitle}>VIREM</Text>
                  <Text style={styles.logoSubtitle}>Portal Paciente</Text>
                </View>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={onCloseMobileMenu} style={styles.closeBtn}>
                <MaterialIcons name="close" size={24} color={colors.dark} />
              </TouchableOpacity>
            </View>

            {/* User mini */}
            <View style={styles.userBox}>
              <Image source={userAvatarSource} style={styles.userAvatar} />
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.userPlan}>{planLabel}</Text>
            </View>

            {/* Menu Items */}
            <ScrollView style={{ flex: 1, marginTop: 10 }}>
              {MENU_ITEMS.map((item) => {
                const isActive = activeModule === item.module;
                return (
                  <Pressable
                    key={item.module}
                    accessibilityRole="button"
                    accessibilityLabel={t(item.labelKey as any)}
                    accessibilityState={{ selected: isActive }}
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
                      {t(item.labelKey as any)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Logout */}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('menu.logout')} style={styles.logoutButton} onPress={handleLogout}>
              <MaterialIcons name="logout" size={18} color="#fff" />
              <Text style={styles.logoutText}>{t('menu.logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Persistent Sidebar for Desktop */}
      {isDesktopLayout && isMobileMenuOpen && (
        <View style={[styles.sidebar, styles.sidebarDesktop]}>
          <View>
            {/* Logo & Close Button */}
            <View style={styles.sidebarHeader}>
              <View style={styles.logoBox}>
                <Image source={ViremLogo} style={styles.logo} />
                <View>
                  <Text style={styles.logoTitle}>VIREM</Text>
                  <Text style={styles.logoSubtitle}>Portal Paciente</Text>
                </View>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={onCloseMobileMenu} style={styles.closeBtn}>
                <MaterialIcons name="close" size={24} color={colors.dark} />
              </TouchableOpacity>
            </View>

            {/* User mini */}
            <View style={styles.userBox}>
              <Image source={userAvatarSource} style={styles.userAvatar} />
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.userPlan}>{planLabel}</Text>
            </View>

            {/* Menu Items */}
            <View style={{ marginTop: 10 }}>
              {MENU_ITEMS.map((item) => {
                const isActive = activeModule === item.module;
                return (
                  <Pressable
                    key={item.module}
                    accessibilityRole="button"
                    accessibilityLabel={t(item.labelKey as any)}
                    accessibilityState={{ selected: isActive }}
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
                      {t(item.labelKey as any)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('menu.logout')} style={styles.logoutButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={18} color="#fff" />
            <Text style={styles.logoutText}>{t('menu.logout')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

export default PacienteSidebar;

const styles = StyleSheet.create({
  mobileMenuBar: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  mobileMenuButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8e4f0',
    backgroundColor: colors.white,
  },
  mobileMenuButtonText: { color: colors.dark, fontWeight: '700', fontSize: 13 },

  sidebar: {
    backgroundColor: colors.white,
    justifyContent: 'space-between',
  },
  sidebarDesktop: {
    width: 280,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    padding: 20,
  },
  sidebarMobile: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    padding: 14,
  },

  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  drawerContent: {
    width: 280,
    height: '100%',
    backgroundColor: colors.white,
    padding: 20,
    justifyContent: 'space-between',
  },

  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeBtn: {
    padding: 4,
  },
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
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  hintText: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

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
    borderRightWidth: 3,
    borderRightColor: colors.primary,
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
  },
  logoutText: { color: '#fff', fontWeight: '800' },
});
