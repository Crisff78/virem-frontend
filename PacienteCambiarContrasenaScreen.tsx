import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import type { RootStackParamList } from './navigation/types';
import { useLanguage } from './localization/LanguageContext';
import { apiUrl } from './config/backend';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';
const AUTH_TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';

type User = {
  nombres?: string;
  apellidos?: string;
  nombre?: string;
  apellido?: string;
  firstName?: string;
  lastName?: string;
  fotoUrl?: string;
  plan?: string;
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const PacienteCambiarContrasenaScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, tx } = useLanguage();
  const [user, setUser] = useState<User | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (Platform.OS === 'web') {
          const webUser = ensurePatientSessionUser(parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY)));
          if (webUser) {
            setUser(webUser);
            return;
          }
        }
        const secureUser = ensurePatientSessionUser(
          parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY))
        );
        if (secureUser) {
          setUser(secureUser);
          return;
        }
        setUser(ensurePatientSessionUser(parseUser(await AsyncStorage.getItem(STORAGE_KEY))));
      } catch {
        setUser(null);
      }
    };
    loadUser();
  }, []);

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user]);

  const avatarSource: ImageSourcePropType = useMemo(() => {
    if (user?.fotoUrl && user.fotoUrl.trim().length > 0) {
      return { uri: user.fotoUrl.trim() };
    }
    return DefaultAvatar;
  }, [user]);

  const passwordChecks = useMemo(() => {
    const hasMin = newPassword.length >= 8;
    const hasNumber = /\d/.test(newPassword);
    const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
    const hasMixed = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
    const score = [hasMin, hasNumber, hasSymbol, hasMixed].filter(Boolean).length;
    const pct = (score / 4) * 100;
    return { hasMin, hasNumber, hasSymbol, hasMixed, score, pct };
  }, [newPassword]);

  const strengthText = useMemo(() => {
    if (passwordChecks.score <= 1) {
      return tx({ es: 'Baja', en: 'Weak', pt: 'Fraca' });
    }
    if (passwordChecks.score <= 3) {
      return tx({ es: 'Moderada', en: 'Medium', pt: 'Moderada' });
    }
    return tx({ es: 'Fuerte', en: 'Strong', pt: 'Forte' });
  }, [passwordChecks.score, tx]);

  const getAuthToken = async () => {
    if (Platform.OS === 'web') {
      const webToken = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
      return String(webToken || '').trim();
    }

    const secureToken =
      (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
      (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
    if (secureToken) return String(secureToken).trim();

    const asyncToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    return String(asyncToken || '').trim();
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(
        tx({ es: 'Campos incompletos', en: 'Incomplete fields', pt: 'Campos incompletos' }),
        tx({
          es: 'Completa todos los campos para continuar.',
          en: 'Fill all fields to continue.',
          pt: 'Preencha todos os campos para continuar.',
        })
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        tx({ es: 'No coincide', en: 'Does not match', pt: 'Nao coincide' }),
        tx({
          es: 'La confirmacion de contrasena no coincide.',
          en: 'Password confirmation does not match.',
          pt: 'A confirmacao da senha nao coincide.',
        })
      );
      return;
    }

    if (passwordChecks.score < 2) {
      Alert.alert(
        tx({ es: 'Contrasena debil', en: 'Weak password', pt: 'Senha fraca' }),
        tx({
          es: 'Mejora la seguridad antes de continuar.',
          en: 'Improve password strength before continuing.',
          pt: 'Melhore a seguranca da senha antes de continuar.',
        })
      );
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      Alert.alert(
        tx({ es: 'Sesion expirada', en: 'Session expired', pt: 'Sessao expirada' }),
        tx({
          es: 'Inicia sesion nuevamente para cambiar tu contrasena.',
          en: 'Sign in again to change your password.',
          pt: 'Faca login novamente para alterar sua senha.',
        })
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(apiUrl('/api/users/me/password'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        Alert.alert(
          tx({ es: 'Error', en: 'Error', pt: 'Erro' }),
          data?.message ||
            tx({
              es: 'No se pudo actualizar la contrasena.',
              en: 'Could not update password.',
              pt: 'Nao foi possivel atualizar a senha.',
            })
        );
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(
        tx({ es: 'Contrasena actualizada', en: 'Password updated', pt: 'Senha atualizada' }),
        tx({
          es: 'Tu contrasena fue actualizada correctamente.',
          en: 'Your password was updated successfully.',
          pt: 'Sua senha foi atualizada com sucesso.',
        }),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert(
        tx({ es: 'Error de red', en: 'Network error', pt: 'Erro de rede' }),
        tx({
          es: 'No se pudo conectar al servidor.',
          en: 'Could not connect to the server.',
          pt: 'Nao foi possivel conectar ao servidor.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (Platform.OS === 'web') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    } else {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
      await SecureStore.deleteItemAsync(LEGACY_USER_STORAGE_KEY);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const indicatorColor = passwordChecks.score >= 3 ? '#16a34a' : passwordChecks.score >= 2 ? '#137fec' : '#f59e0b';

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

          <View style={styles.userBox}>
            <Image source={avatarSource} style={styles.userAvatar} />
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userPlan}>{planLabel}</Text>
          </View>

          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('DashboardPaciente')}>
              <MaterialIcons name="grid-view" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.home')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('NuevaConsultaPaciente')}
            >
              <MaterialIcons name="person-search" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.searchDoctor')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteCitas')}
            >
              <MaterialIcons name="calendar-today" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.appointments')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('SalaEsperaVirtualPaciente')}
            >
              <MaterialIcons name="videocam" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.videocall')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('PacienteRecetasDocumentos')}>
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.recipesDocs')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItemRow} onPress={() => navigation.navigate('PacientePerfil')}>
              <MaterialIcons name="account-circle" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.profile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItemRow, styles.menuItemActive]} onPress={() => navigation.navigate('PacienteConfiguracion')}>
              <MaterialIcons name="settings" size={20} color={colors.primary} />
              <Text style={[styles.menuText, styles.menuTextActive]}>{t('menu.settings')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.contentWrap}>
          <Text style={styles.pageTitle}>
            {tx({ es: 'Cambiar Contrasena', en: 'Change Password', pt: 'Alterar Senha' })}
          </Text>
          <Text style={styles.pageSubtitle}>
            {tx({
              es: 'Actualice sus credenciales para mantener la seguridad de su cuenta medica.',
              en: 'Update your credentials to keep your medical account secure.',
              pt: 'Atualize suas credenciais para manter sua conta medica segura.',
            })}
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>{tx({ es: 'Contrasena Actual', en: 'Current Password', pt: 'Senha Atual' })}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder={tx({ es: 'Ingrese su contrasena actual', en: 'Enter your current password', pt: 'Digite sua senha atual' })}
                placeholderTextColor="#8ea6bc"
              />
              <TouchableOpacity onPress={() => setShowCurrent((v) => !v)}>
                <MaterialIcons name={showCurrent ? 'visibility-off' : 'visibility'} size={20} color="#4A7FA7" />
              </TouchableOpacity>
            </View>

            <View style={styles.hr} />

            <Text style={styles.label}>{tx({ es: 'Nueva Contrasena', en: 'New Password', pt: 'Nova Senha' })}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={tx({ es: 'Minimo 8 caracteres', en: 'Minimum 8 characters', pt: 'Minimo 8 caracteres' })}
                placeholderTextColor="#8ea6bc"
              />
              <TouchableOpacity onPress={() => setShowNew((v) => !v)}>
                <MaterialIcons name={showNew ? 'visibility-off' : 'visibility'} size={20} color="#4A7FA7" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{tx({ es: 'Confirmar Nueva Contrasena', en: 'Confirm New Password', pt: 'Confirmar Nova Senha' })}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={tx({ es: 'Repita su nueva contrasena', en: 'Repeat your new password', pt: 'Repita sua nova senha' })}
                placeholderTextColor="#8ea6bc"
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)}>
                <MaterialIcons name={showConfirm ? 'visibility-off' : 'visibility'} size={20} color="#4A7FA7" />
              </TouchableOpacity>
            </View>

            <View style={styles.securityBox}>
              <View style={styles.securityHead}>
                <Text style={styles.securityTitle}>{tx({ es: 'FORTALEZA DE SEGURIDAD', en: 'SECURITY STRENGTH', pt: 'FORCA DA SENHA' })}</Text>
                <Text style={styles.securityValue}>{strengthText}</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${Math.max(passwordChecks.pct, 5)}%`, backgroundColor: indicatorColor }]} />
              </View>
              <View style={styles.rulesGrid}>
                <View style={styles.ruleItem}>
                  <MaterialIcons name={passwordChecks.hasMin ? 'check-circle' : 'cancel'} size={14} color={passwordChecks.hasMin ? '#16a34a' : '#64748b'} />
                  <Text style={styles.ruleText}>{tx({ es: 'Al menos 8 caracteres', en: 'At least 8 characters', pt: 'Pelo menos 8 caracteres' })}</Text>
                </View>
                <View style={styles.ruleItem}>
                  <MaterialIcons name={passwordChecks.hasNumber ? 'check-circle' : 'cancel'} size={14} color={passwordChecks.hasNumber ? '#16a34a' : '#64748b'} />
                  <Text style={styles.ruleText}>{tx({ es: 'Incluye numeros', en: 'Includes numbers', pt: 'Inclui numeros' })}</Text>
                </View>
                <View style={styles.ruleItem}>
                  <MaterialIcons name={passwordChecks.hasSymbol ? 'check-circle' : 'cancel'} size={14} color={passwordChecks.hasSymbol ? '#16a34a' : '#64748b'} />
                  <Text style={styles.ruleText}>{tx({ es: 'Incluye simbolos (@#$%...)', en: 'Includes symbols (@#$%...)', pt: 'Inclui simbolos (@#$%...)' })}</Text>
                </View>
                <View style={styles.ruleItem}>
                  <MaterialIcons name={passwordChecks.hasMixed ? 'check-circle' : 'cancel'} size={14} color={passwordChecks.hasMixed ? '#16a34a' : '#64748b'} />
                  <Text style={styles.ruleText}>{tx({ es: 'Mayusculas y minusculas', en: 'Upper and lower case', pt: 'Maiusculas e minusculas' })}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, saving ? { opacity: 0.75 } : null]}
              onPress={handleUpdatePassword}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {tx({ es: 'Actualizar Contrasena', en: 'Update Password', pt: 'Atualizar Senha' })}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helpText}>
              {tx({ es: 'Olvido su contrasena?', en: 'Forgot your password?', pt: 'Esqueceu sua senha?' })}{' '}
              <Text style={styles.helpLink}>
                {tx({ es: 'Contacte a soporte tecnico', en: 'Contact technical support', pt: 'Contate o suporte tecnico' })}
              </Text>
            </Text>
          </View>

          <View style={styles.tipBox}>
            <MaterialIcons name="info-outline" size={18} color="#137fec" />
            <Text style={styles.tipText}>
              <Text style={{ fontWeight: '900' }}>
                {tx({ es: 'Consejo de seguridad:', en: 'Security tip:', pt: 'Dica de seguranca:' })}
              </Text>{' '}
              {tx({
                es: 'Nunca comparta su contrasena con terceros. Recomendamos cambiarla cada 90 dias.',
                en: 'Never share your password with third parties. We recommend changing it every 90 days.',
                pt: 'Nunca compartilhe sua senha com terceiros. Recomendamos troca-la a cada 90 dias.',
              })}
            </Text>
          </View>
        </View>
      </ScrollView>
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
  logoSubtitle: { fontSize: 11, fontWeight: '700', color: colors.muted },
  userBox: { marginTop: 18, alignItems: 'center', paddingVertical: 12 },
  userAvatar: { width: 76, height: 76, borderRadius: 76, marginBottom: 10, borderWidth: 4, borderColor: '#f5f7fb' },
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14 },
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
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
  menuItemActive: { backgroundColor: 'rgba(19,127,236,0.10)', borderRightWidth: 3, borderRightColor: colors.primary },
  menuText: { fontSize: 14, fontWeight: '700', color: colors.muted },
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
  main: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 26 : 14,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
  },
  contentWrap: { maxWidth: 860, width: '100%', alignSelf: 'center' },
  pageTitle: { color: colors.dark, fontSize: 38, fontWeight: '900' },
  pageSubtitle: { color: colors.muted, fontSize: 18, fontWeight: '600', marginTop: 4, marginBottom: 16 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dce8f5',
    padding: 18,
  },
  label: { color: colors.dark, fontSize: 14, fontWeight: '800', marginBottom: 6, marginTop: 8 },
  inputRow: {
    borderWidth: 1,
    borderColor: '#b7d3ea',
    borderRadius: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: { flex: 1, color: colors.dark, height: 44, fontWeight: '600' },
  hr: { height: 1, backgroundColor: '#e6eef7', marginVertical: 14 },
  securityBox: {
    marginTop: 14,
    backgroundColor: '#f6fafe',
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 12,
  },
  securityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  securityTitle: { color: colors.dark, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  securityValue: { color: colors.muted, fontSize: 12, fontWeight: '700', fontStyle: 'italic' },
  barBg: { marginTop: 8, height: 7, borderRadius: 99, backgroundColor: '#cfe0ef', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  rulesGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ruleItem: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 5 },
  ruleText: { color: '#526e88', fontSize: 12, fontWeight: '600' },
  primaryButton: {
    marginTop: 16,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  helpText: { marginTop: 12, textAlign: 'center', color: '#7f93a8', fontSize: 12, fontWeight: '600' },
  helpLink: { color: colors.primary, fontWeight: '800' },
  tipBox: {
    marginTop: 14,
    backgroundColor: '#eef6ff',
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: { flex: 1, color: colors.blue, fontSize: 13, fontWeight: '600', lineHeight: 19 },
});

export default PacienteCambiarContrasenaScreen;

