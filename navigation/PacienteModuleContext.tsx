import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Platform } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import PacienteNotificationModal from '../components/PacienteNotificationModal';

/**
 * List of sidebar modules that stay mounted inside the portal.
 * Any route not listed here navigates via the normal stack.
 */
export const PORTAL_MODULES = [
  'DashboardPaciente',
  'NuevaConsultaPaciente',
  'PacienteCitas',
  'WaitingRoom',
  'PacienteChat',
  'PacienteAsistente',
  'PacienteRecetasDocumentos',
  'PacientePerfil',
  'PacienteConfiguracion',
  'PacienteNotificaciones',
] as const;

export type PortalModule = (typeof PORTAL_MODULES)[number];

type PacienteModuleContextValue = {
  /** True when rendered inside the portal container */
  isInsidePortal: boolean;
  /** Currently visible sidebar module */
  activeModule: PortalModule;
  /** Switch to a different sidebar module (no unmount/remount) */
  setActiveModule: (module: PortalModule) => void;
  /**
   * Navigate: if the target is a sidebar module, switch without unmounting.
   * Otherwise, push onto the stack as usual.
   */
  portalNavigate: (route: string, params?: Record<string, unknown>) => void;
  /** Global sidebar toggle state (Desktop & Mobile) */
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  /** Notification drawer state */
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
};

const fallbackCtx: PacienteModuleContextValue = {
  isInsidePortal: false,
  activeModule: 'DashboardPaciente',
  setActiveModule: () => {
    console.warn('usePacienteModule: setActiveModule called outside of PacienteModuleProvider');
  },
  portalNavigate: () => {
    console.warn('usePacienteModule: portalNavigate called outside of PacienteModuleProvider');
  },
  isSidebarOpen: false,
  toggleSidebar: () => {
    console.warn('usePacienteModule: toggleSidebar called outside of PacienteModuleProvider');
  },
  isNotificationsOpen: false,
  setIsNotificationsOpen: () => {
    console.warn('usePacienteModule: setIsNotificationsOpen called outside of PacienteModuleProvider');
  },
};

export const PacienteModuleContext = createContext<PacienteModuleContextValue>(fallbackCtx);

export function usePacienteModule() {
  return useContext(PacienteModuleContext);
}

/**
 * Returns true when `route` is one of the sidebar portal modules.
 */
export function isPortalModule(route: string): route is PortalModule {
  return (PORTAL_MODULES as readonly string[]).includes(route);
}

type ProviderProps = {
  initialModule?: PortalModule;
  isPortal?: boolean;
  children: React.ReactNode;
};

export const PacienteModuleProvider: React.FC<ProviderProps> = ({
  initialModule = 'DashboardPaciente',
  isPortal = false,
  children,
}) => {
  const outerContext = useContext(PacienteModuleContext);
  const isAlreadyNested = outerContext !== fallbackCtx && outerContext.isInsidePortal;

  // If we are already inside a portal, we don't need to provide a new context.
  if (isAlreadyNested) {
    return <>{children}</>;
  }

  return (
    <PacienteModuleRootProvider initialModule={initialModule} isPortal={isPortal}>
      {children}
    </PacienteModuleRootProvider>
  );
};

const PacienteModuleRootProvider: React.FC<{ 
  initialModule?: PortalModule; 
  isPortal: boolean;
  children: React.ReactNode 
}> = ({
  initialModule = 'DashboardPaciente',
  isPortal,
  children,
}) => {
  const [activeModule, setActiveModuleRaw] = useState<PortalModule>(initialModule);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (Platform.OS !== 'web') return false;
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const setActiveModule = useCallback((mod: PortalModule) => {
    setActiveModuleRaw(mod);
  }, []);

  const portalNavigate = useCallback(
    (route: string, params?: Record<string, unknown>) => {
      if (isPortal) {
        if (isPortalModule(route)) {
          setActiveModuleRaw(route);
          return;
        }
      }
      (navigation.navigate as any)(route, params);
    },
    [navigation, isPortal]
  );
  
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const value = useMemo<PacienteModuleContextValue>(
    () => ({
      isInsidePortal: isPortal,
      activeModule,
      setActiveModule,
      portalNavigate,
      isSidebarOpen,
      toggleSidebar,
      isNotificationsOpen,
      setIsNotificationsOpen,
    }),
    [isPortal, activeModule, portalNavigate, setActiveModule, isSidebarOpen, toggleSidebar, isNotificationsOpen]
  );

  return (
    <PacienteModuleContext.Provider value={value}>
      {children}
      <PacienteNotificationModal 
        visible={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
      />
    </PacienteModuleContext.Provider>
  );
};
