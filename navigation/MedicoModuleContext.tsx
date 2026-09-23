import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Platform } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

/**
 * List of sidebar modules that stay mounted inside the medico portal.
 * Any route not listed here navigates via the normal stack.
 */
export const MEDICO_PORTAL_MODULES = [
  'DashboardMedico',
  'MedicoCitas',
  'MedicoPacientes',
  'MedicoChat',
  'MedicoPerfil',
  'MedicoHorarios',
  'MedicoRecetas',
  'MedicoFinanzas',
  'MedicoConfiguracion',
  'MedicoConsultaVirtual',
] as const;

export type MedicoPortalModule = (typeof MEDICO_PORTAL_MODULES)[number];

type MedicoModuleContextValue = {
  /** True when rendered inside the medico portal container */
  isInsidePortal: boolean;
  /** Currently visible sidebar module */
  activeModule: MedicoPortalModule;
  /** Params for the active module */
  activeModuleParams: Record<string, any> | undefined;
  /** Switch to a different sidebar module (no unmount/remount) */
  setActiveModule: (module: MedicoPortalModule, params?: Record<string, any>) => void;
  /**
   * Navigate: if the target is a sidebar module, switch without unmounting.
   * Otherwise, push onto the stack as usual.
   */
  portalNavigate: (route: string, params?: Record<string, any>) => void;
  /** Global sidebar toggle state (Desktop & Mobile) */
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  /** Global notification drawer toggle state */
  isNotificationOpen: boolean;
  toggleNotification: () => void;
};

const fallbackCtx: MedicoModuleContextValue = {
  isInsidePortal: false,
  activeModule: 'DashboardMedico',
  activeModuleParams: undefined,
  setActiveModule: () => undefined,
  portalNavigate: () => undefined,
  isSidebarOpen: true,
  toggleSidebar: () => undefined,
  isNotificationOpen: false,
  toggleNotification: () => undefined,
};

export const MedicoModuleContext = createContext<MedicoModuleContextValue>(fallbackCtx);

export function useMedicoModule() {
  return useContext(MedicoModuleContext);
}

/**
 * Returns true when `route` is one of the medico sidebar portal modules.
 */
export function isMedicoPortalModule(route: string): route is MedicoPortalModule {
  return (MEDICO_PORTAL_MODULES as readonly string[]).includes(route);
}

type ProviderProps = {
  initialModule?: MedicoPortalModule;
  children: React.ReactNode;
};

export const MedicoModuleProvider: React.FC<ProviderProps> = ({
  initialModule = 'DashboardMedico',
  children,
}) => {
  const [activeModule, setActiveModuleRaw] = useState<MedicoPortalModule>(initialModule);
  const [activeModuleParams, setActiveModuleParams] = useState<Record<string, any> | undefined>(undefined);
  
  // Initial state: closed on mobile devices or small screens, open on desktop web
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (Platform.OS !== 'web') return false;
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const setActiveModule = useCallback((mod: MedicoPortalModule, params?: Record<string, any>) => {
    setActiveModuleRaw(mod);
    setActiveModuleParams(params);
  }, []);

  const portalNavigate = useCallback(
    (route: string, params?: Record<string, any>) => {
      if (isMedicoPortalModule(route)) {
        setActiveModuleRaw(route);
        setActiveModuleParams(params);
        // On mobile/tablet, close sidebar after navigating
        if (Platform.OS !== 'web' || (typeof window !== 'undefined' && window.innerWidth < 1024)) {
          setIsSidebarOpen(false);
        }
      } else {
        (navigation.navigate as any)(route, params);
      }
    },
    [navigation]
  );
  
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
    if (!isSidebarOpen) setIsNotificationOpen(false); // Close notifications if sidebar opens
  }, [isSidebarOpen]);

  const toggleNotification = useCallback(() => {
    setIsNotificationOpen((prev) => !prev);
    if (!isNotificationOpen) setIsSidebarOpen(false); // Close sidebar if notifications open on mobile
  }, [isNotificationOpen]);

  const value = useMemo<MedicoModuleContextValue>(
    () => ({
      isInsidePortal: true,
      activeModule,
      activeModuleParams,
      setActiveModule,
      portalNavigate,
      isSidebarOpen,
      toggleSidebar,
      isNotificationOpen,
      toggleNotification,
    }),
    [activeModule, activeModuleParams, portalNavigate, setActiveModule, isSidebarOpen, toggleSidebar, isNotificationOpen, toggleNotification]
  );

  return (
    <MedicoModuleContext.Provider value={value}>
      {children}
    </MedicoModuleContext.Provider>
  );
};
