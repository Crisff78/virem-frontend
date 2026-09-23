import React, { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { MedicoModuleProvider, useMedicoModule, MEDICO_PORTAL_MODULES, type MedicoPortalModule } from './navigation/MedicoModuleContext';
import MedicoSidebar from './components/MedicoSidebar';

// Import every sidebar module screen
import DashboardMedico from './DashboardMedico';
import MedicoCitasScreen from './MedicoCitasScreen';
import MedicoPacientesScreen from './MedicoPacientesScreen';
import MedicoChatScreen from './MedicoChatScreen';
import MedicoPerfilScreen from './MedicoPerfilScreen';
import MedicoHorariosScreen from './MedicoHorariosScreen';
import MedicoFinanzasScreen from './MedicoFinanzasScreen';
import MedicoRecetasScreen from './MedicoRecetasScreen';
import MedicoConfiguracionScreen from './MedicoConfiguracionScreen';
import MedicoConsultaVirtualScreen from './screens/medico/MedicoConsultaVirtualScreen';
import MedicoNotificationDrawer from './components/MedicoNotificationDrawer';

const MODULE_COMPONENTS: Record<MedicoPortalModule, React.ComponentType<any>> = {
  DashboardMedico: DashboardMedico,
  MedicoCitas: MedicoCitasScreen,
  MedicoPacientes: MedicoPacientesScreen,
  MedicoChat: MedicoChatScreen,
  MedicoPerfil: MedicoPerfilScreen,
  MedicoHorarios: MedicoHorariosScreen,
  MedicoRecetas: MedicoRecetasScreen,
  MedicoFinanzas: MedicoFinanzasScreen,
  MedicoConfiguracion: MedicoConfiguracionScreen,
  MedicoConsultaVirtual: MedicoConsultaVirtualScreen,
};

/**
 * Portal container that keeps all medico sidebar modules mounted simultaneously.
 * Only the active module is visible (display: flex); the rest are hidden (display: none).
 */
const MedicoPortalInner: React.FC = () => {
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;
  const { isSidebarOpen, toggleSidebar } = useMedicoModule();

  return (
    <View style={[styles.container, isDesktopLayout ? styles.containerDesktop : styles.containerMobile]}>
      <MedicoSidebar
        isMobileMenuOpen={isSidebarOpen}
        onToggleMobileMenu={toggleSidebar}
        onCloseMobileMenu={toggleSidebar}
      />

      <View style={styles.modulesContainer}>
        {MEDICO_PORTAL_MODULES.map((moduleName) => (
          <ModuleSlot key={moduleName} moduleName={moduleName} />
        ))}
      </View>

      <MedicoNotificationDrawer />
    </View>
  );
};

/**
 * Renders a single module inside a show/hide wrapper driven by context.
 */
const ModuleSlot: React.FC<{ moduleName: MedicoPortalModule }> = React.memo(({ moduleName }) => {
  const Component = MODULE_COMPONENTS[moduleName];

  return (
    <ModuleVisibility moduleName={moduleName}>
      <Component />
    </ModuleVisibility>
  );
});
ModuleSlot.displayName = 'MedicoModuleSlot';

/**
 * Subscribes to context and toggles display for its child.
 */
const ModuleVisibility: React.FC<{ moduleName: MedicoPortalModule; children: React.ReactNode }> = ({
  moduleName,
  children,
}) => {
  const { activeModule } = useMedicoModule();
  const isVisible = activeModule === moduleName;

  return (
    <View 
      style={[
        { flex: 1 },
        !isVisible && { display: 'none', height: 0, width: 0, opacity: 0 }
      ]}
    >
      {children}
    </View>
  );
};

const MedicoPortalScreen: React.FC = () => (
  <MedicoModuleProvider>
    <MedicoPortalInner />
  </MedicoModuleProvider>
);

export default MedicoPortalScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6FAFD' },
  containerDesktop: { flexDirection: 'row' },
  containerMobile: { flexDirection: 'column' },

  modulesContainer: { flex: 1 },
});
