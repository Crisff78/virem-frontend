import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../providers/AuthProvider';
import type { RootStackParamList } from './types';

export const PACIENTE_ROLE_ID = 1;
export const MEDICO_ROLE_ID = 2;
export const ADMIN_ROLE_ID = 3;

type RoleGuardProps = {
  allowedRoles: number[];
  children: React.ReactNode;
};

const normalizeRoleId = (user: unknown) => {
  const source = (user || {}) as Record<string, unknown>;
  const raw = source.rolid ?? source.rolId ?? source.roleId;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const routeForRole = (roleId: number): keyof RootStackParamList => {
  if (roleId === ADMIN_ROLE_ID) return 'AdminPanel';
  if (roleId === MEDICO_ROLE_ID) return 'DashboardMedico';
  return 'DashboardPaciente';
};

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isReady, isAuthenticated, user } = useAuth();
  const roleId = useMemo(() => normalizeRoleId(user), [user]);
  const isAllowed = allowedRoles.includes(roleId);

  useEffect(() => {
    if (!isReady) return;

    if (!isAuthenticated) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }

    if (!roleId) {
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
      return;
    }

    if (!isAllowed) {
      navigation.reset({ index: 0, routes: [{ name: routeForRole(roleId) }] });
    }
  }, [isAllowed, isAuthenticated, isReady, navigation, roleId]);

  if (!isReady || !isAuthenticated || !isAllowed) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#137fec" />
        <Text style={styles.text}>Preparando tu portal...</Text>
      </View>
    );
  }

  return <>{children}</>;
};

export function withRoleGuard<P extends object>(
  Screen: React.ComponentType<P>,
  allowedRoles: number[]
) {
  const GuardedScreen: React.FC<P> = (props) => (
    <RoleGuard allowedRoles={allowedRoles}>
      <Screen {...props} />
    </RoleGuard>
  );

  GuardedScreen.displayName = `RoleGuard(${Screen.displayName || Screen.name || 'Screen'})`;
  return GuardedScreen;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F6FAFD',
  },
  text: {
    color: '#4A7FA7',
    fontSize: 13,
    fontWeight: '700',
  },
});
