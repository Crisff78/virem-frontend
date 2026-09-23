import { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { isMedicoPortalModule, useMedicoModule, type MedicoPortalModule } from './MedicoModuleContext';

/**
 * Drop-in replacement for `useNavigation()` that intercepts navigation
 * to portal modules when inside the MedicoPortal container.
 *
 * Usage: replace `const navigation = useNavigation<...>()` with
 *        `const navigation = usePortalAwareMedicoNavigation()`
 */
export function usePortalAwareMedicoNavigation() {
  const realNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isInsidePortal, setActiveModule } = useMedicoModule();

  const navigate = useCallback(
    (route: string | { name: string; params?: any }, params?: any) => {
      const routeName = typeof route === 'string' ? route : route.name;
      const routeParams = typeof route === 'string' ? params : route.params;

      if (isInsidePortal && isMedicoPortalModule(routeName)) {
        setActiveModule(routeName as MedicoPortalModule, routeParams);
      } else {
        (realNavigation.navigate as any)(routeName, routeParams);
      }
    },
    [isInsidePortal, realNavigation, setActiveModule]
  );

  return useMemo(
    () => ({
      ...realNavigation,
      navigate,
    }),
    [navigate, realNavigation]
  );
}
