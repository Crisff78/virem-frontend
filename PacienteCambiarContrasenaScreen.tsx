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
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from './navigation/types';
import { useLanguage } from './localization/LanguageContext';
import { usePatientPortalSession } from './hooks/usePatientPortalSession';
import { apiClient } from './utils/api';
import { getApiErrorMessage, isAuthError } from './utils/apiErrors';
import { resolveRemoteImageSource } from './utils/imageSources';
import PacienteSidebar from './components/PacienteSidebar';
import { usePacienteModule, PacienteModuleProvider } from './navigation/PacienteModuleContext';
import { useResponsive } from './hooks/useResponsive';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const PacienteCambiarContrasenaScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, tx } = useLanguage();
  const { isInsidePortal, isSidebarOpen, toggleSidebar, setIsNotificationsOpen } = usePacienteModule();
  const { isDesktop: isDesktopLayout } = useResponsive();
  const { signOut, fullName, planLabel, fotoUrl } = usePatientPortalSession();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const avatarSource: ImageSourcePropType = useMemo(() => {
    return resolveRemoteImageSource(fotoUrl, DefaultAvatar);
  }, [fotoUrl]);

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

    setSaving(true);
    try {
      await apiClient.put<any>('/api/users/me/password', {
        authenticated: true,
        body: {
          currentPassword,
          newPassword,
        },
      });

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
    } catch (error) {
      if (isAuthError(error)) {
        Alert.alert(
          tx({ es: 'Sesion expirada', en: 'Session expired', pt: 'Sessao expirada' }),
          tx({
            es: 'Inicia sesion nuevamente para cambiar tu contrasena.',
            en: 'Sign in again to change your password.',
            pt: 'Faca login novamente para alterar sua senha.',
          })
        );
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      Alert.alert(
        tx({ es: 'Error', en: 'Error', pt: 'Erro' }),
        getApiErrorMessage(
          error,
          tx({
            es: 'No se pudo actualizar la contrasena.',
            en: 'Could not update password.',
            pt: 'Nao foi possivel atualizar a senha.',
          })
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const indicatorColor = passwordChecks.score >= 3 ? '#16a34a' : passwordChecks.score >= 2 ? '#137fec' : '#f59e0b';

  return (
    <View style={[styles.container, !isInsidePortal && isDesktopLayout && { flexDirection: 'row' }]}>
      {!isInsidePortal && (
        <PacienteSidebar
          isMobileMenuOpen={isSidebarOpen}
          onToggleMobileMenu={toggleSidebar}
          onCloseMobileMenu={toggleSidebar}
        />
      )}

      <ScrollView
        style={[styles.main, !isDesktopLayout && styles.mainMobile]}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {!isSidebarOpen && (
              <TouchableOpacity 
                style={[styles.hamburgerBtn, { marginLeft: 0, marginTop: 0, marginBottom: 0 }]} 
                onPress={toggleSidebar}
              >
                <MaterialIcons name="menu" size={26} color={colors.dark} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}
            onPress={() => setIsNotificationsOpen(true)}
          >
            <MaterialIcons name="notifications" size={22} color={colors.dark} />
            <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: '#fff' }} />
          </TouchableOpacity>
        </View>
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
    backgroundColor: colors.bg,
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
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 10,
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

const PacienteCambiarContrasenaScreenWrapper: React.FC = (props) => (
  <PacienteModuleProvider initialModule="PacienteConfiguracion">
    <PacienteCambiarContrasenaScreen {...props} />
  </PacienteModuleProvider>
);

export default PacienteCambiarContrasenaScreenWrapper;
