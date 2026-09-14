import { apiClient } from './utils/api';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { RootStackParamList } from './navigation/types';
import { BACKEND_URL, apiUrl } from './config/backend';
import { isStrongPassword, isValidEmail, passwordChecks } from './utils/validation';

type NavigationProps = NativeStackNavigationProp<RootStackParamList, 'RegistroCredenciales'>;
type RegistroRouteProp = RouteProp<RootStackParamList, 'RegistroCredenciales'>;

const ViremLogo = require('./assets/imagenes/descarga.png');

const colors = {
  primary: '#137fec',
  backgroundLight: '#F6FAFD',
  navyDark: '#0A1931',
  navyMedium: '#1A3D63',
  blueGray: '#4A7FA7',
  white: '#FFFFFF',
  slate50: '#f8fafc',
  success: '#16a34a',
  muted: '#94a3b8',
};

const PASSWORD_RULES = [
  { key: 'minLength', label: 'Minimo 8 caracteres' },
  { key: 'hasUppercase', label: 'Al menos 1 mayuscula (A-Z)' },
  { key: 'hasNumber', label: 'Al menos 1 numero (0-9)' },
  { key: 'hasSpecial', label: 'Al menos 1 simbolo (!@#...)' },
] as const;

type DatosPaciente = {
  nombres: string;
  apellidos: string;
  fechanacimiento: string;
  genero: string;
  cedula: string;
  telefono: string;
};

function esDatosPaciente(x: any): x is DatosPaciente {
  return (
    x &&
    typeof x.nombres === 'string' &&
    typeof x.apellidos === 'string' &&
    typeof x.fechanacimiento === 'string' &&
    typeof x.genero === 'string' &&
    typeof x.cedula === 'string' &&
    typeof x.telefono === 'string'
  );
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    // @ts-ignore
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

const RegistroCredencialesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RegistroRouteProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requiresEmailVerification, setRequiresEmailVerification] = useState(false);
  const [showCodeField, setShowCodeField] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const passwordRuleState = useMemo(() => passwordChecks(password), [password]);

  const handleSendCode = async () => {
    if (!route.params?.datosPersonales) {
      showAlert('Error', 'Faltan datos personales para completar el registro.');
      return;
    }

    const dpAny = route.params.datosPersonales;

    // Validamos que al menos existan los datos básicos para no bloquear el flujo
    if (!dpAny || typeof dpAny !== 'object') {
      showAlert('Error', 'No se recibieron los datos personales correctamente. Por favor, vuelve atrás e intenta de nuevo.');
      return;
    }

    if (!email || !password || !confirmPassword) {
      showAlert('Error', 'Complete todos los campos obligatorios.');
      return;
    }

    const emailTrim = email.toLowerCase().trim();

    if (!isValidEmail(emailTrim)) {
      showAlert('Error', 'El correo no tiene un formato válido.');
      return;
    }

    if (!isStrongPassword(password)) {
      showAlert(
        'Seguridad',
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.\n\nEj: Toribio123!'
      );
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      const data = dpAny as any;
      const telefonoDigits = String(data.telefono || '').replace(/\D/g, '');
      const cedulaClean = String(data.cedula || '').trim();

      const bodyCompleto = {
        nombres: String(data.nombres || '').trim(),
        apellidos: String(data.apellidos || '').trim(),
        fechanacimiento: String(data.fechanacimiento || '').trim(),
        genero: String(data.genero || '').trim(),
        cedula: cedulaClean,
        telefono: telefonoDigits,
        email: emailTrim,
        password: String(password),
      };


      const response = await apiClient.fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyCompleto),
      });

      const res = await response.json().catch(() => null);

      if (!response.ok || !res?.success) {
        const detalle = res?.error ? `\n\nDetalle: ${res.error}` : '';
        showAlert('Error', (res?.message || `Fallo (HTTP ${response.status}).`) + detalle);
        return;
      }

      if (res?.requiresEmailVerification) {
        setRequiresEmailVerification(true);
        setShowCodeField(true);
        setResendCooldown(30);
        
        if (res.devVerificationCode) {
          // Mostrar en alert solo en desarrollo para facilitar pruebas
          if (__DEV__) {
            showAlert('MODO DESARROLLO', `El código es: ${res.devVerificationCode}\n(Esto solo se ve en desarrollo porque el correo falló o está en modo fallback)`);
          }
        }
        
        showAlert('📧 Código Enviado', `Hemos enviado un código de verificación a:\n\n${emailTrim}\n\nRevisa tu bandeja de entrada o spam.`);
      } else {
        showAlert('¡Éxito!', 'Cuenta creada correctamente. Ahora inicia sesión.');
        navigation.replace('Login', { prefillEmail: emailTrim });
      }
    } catch (error) {
      showAlert('Error de Red', `No se pudo conectar al servidor.\n\nBackend actual: ${BACKEND_URL}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      showAlert('Error', 'Por favor ingresa el código de verificación.');
      return;
    }

    if (!email) {
      showAlert('Error', 'El correo no está disponible.');
      return;
    }

    const emailTrim = email.toLowerCase().trim();

    setIsLoading(true);

    try {
      const response = await apiClient.fetch(apiUrl('/api/auth/register/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailTrim,
          codigo: verificationCode.trim(),
        }),
      });

      const res = await response.json().catch(() => null);

      if (!response.ok || !res?.success) {
        const detalle = res?.error ? `\n\nDetalle: ${res.error}` : '';
        showAlert('Error', (res?.message || `Fallo (HTTP ${response.status}).`) + detalle);
        return;
      }

      showAlert('¡Éxito!', 'Registro completado correctamente. Ahora inicia sesión.');
      navigation.replace('Login', { prefillEmail: emailTrim });
    } catch (error) {
      showAlert('Error de Red', `No se pudo conectar al servidor.\n\nBackend actual: ${BACKEND_URL}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) {
      showAlert('Espera', `Por favor espera ${resendCooldown} segundos antes de reenviar el código.`);
      return;
    }

    setIsLoading(true);
    setResendCooldown(30);

    try {
      const emailTrim = email.toLowerCase().trim();
      const response = await apiClient.fetch(apiUrl('/api/auth/resend-verification-pending'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrim }),
      });

      const res = await response.json().catch(() => null);

      if (!response.ok || !res?.success) {
        const detalle = res?.error ? `\n\nDetalle: ${res.error}` : '';
        showAlert('Error', (res?.message || `Fallo (HTTP ${response.status}).`) + detalle);
        setResendCooldown(0);
        return;
      }

      if (res?.devVerificationCode) {
        showAlert('📧 Nuevo Código', `Tu código es: ${res.devVerificationCode}\n\n(Se envió a tu correo)`);
      } else {
        showAlert('📧 Código Reenviado', 'Se envió un nuevo código de verificación a tu correo.');
      }
    } catch (error) {
      showAlert('Error de Red', `No se pudo conectar al servidor.`);
      setResendCooldown(0);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => setResendCooldown((p) => (p > 0 ? p - 1 : 0)), 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  return (
    <View style={styles.mainWrapper}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoGroup}>
            <Image source={ViremLogo} style={styles.logoImage} />
            <Text style={styles.logoText}>VIREM</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        <View style={styles.contentWrapper}>
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Credenciales de Acceso</Text>
            <View style={styles.progressBarBackground}>
              <View style={styles.progressBarFill} />
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Finalizar Registro</Text>
            <Text style={styles.cardSubtitle}>
              Hola {(route.params?.datosPersonales as any)?.nombres ?? ''}, crea tu cuenta para acceder.
            </Text>

            {!showCodeField && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Correo Electrónico</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="email" size={20} color={colors.blueGray} style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="nombre@correo.com"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contraseña</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="lock-outline" size={20} color={colors.blueGray} style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={secureText}
                    />
                    <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                      <MaterialIcons name={secureText ? "visibility-off" : "visibility"} size={20} color={colors.blueGray} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* PASSWORD RULES */}
                <View style={styles.passwordRulesBox}>
                  {PASSWORD_RULES.map((rule) => {
                    const ok = Boolean(passwordRuleState[rule.key]);
                    return (
                      <View key={rule.key} style={styles.passwordRuleItem}>
                        <MaterialIcons
                          name={ok ? 'check-circle' : 'radio-button-unchecked'}
                          size={16}
                          color={ok ? colors.success : colors.muted}
                        />
                        <Text style={[styles.passwordRuleText, ok && styles.passwordRuleTextOk]}>{rule.label}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirmar Contraseña</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="lock-outline" size={20} color={colors.blueGray} style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Repite tu contraseña"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={secureText}
                    />
                  </View>
                </View>
              </>
            )}

            {showCodeField && (
              <View style={styles.verificationSection}>
                <View style={styles.verificationCard}>
                  <View style={styles.iconCircle}>
                    <MaterialIcons name="mark-email-read" size={40} color={colors.primary} />
                  </View>
                  
                  <Text style={styles.verificationTitle}>Verificar tu Correo</Text>
                  <Text style={styles.verificationSubtitle}>
                    Código enviado a:{"\n"}
                    <Text style={styles.highlightEmail}>{email}</Text>
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Código de Verificación</Text>
                    <View style={styles.modernInputContainer}>
                      <MaterialIcons name="vpn-key" size={20} color={colors.primary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.modernTextInput}
                        placeholder="Ej: 123456"
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={[styles.btnPrimaryModern, (isLoading || !verificationCode.trim()) && styles.btnDisabled]} 
                    onPress={handleVerifyCode} 
                    disabled={isLoading || !verificationCode.trim()}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <View style={styles.btnContent}>
                        <MaterialIcons name="check-circle" size={20} color="white" style={{marginRight: 8}} />
                        <Text style={styles.btnTextModern}>Verificar Código</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnSecondaryModern, resendCooldown > 0 && styles.btnSecondaryDisabled]}
                    onPress={handleResendCode}
                    disabled={resendCooldown > 0}
                  >
                    <View style={styles.btnContent}>
                      <MaterialIcons 
                        name="refresh" 
                        size={20} 
                        color={resendCooldown > 0 ? "#94a3b8" : colors.primary} 
                        style={{marginRight: 8}} 
                      />
                      <Text style={[styles.btnSecondaryTextModern, resendCooldown > 0 && styles.btnSecondaryTextDisabled]}>
                        {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar Código'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* MAIN ACTION BUTTON */}
            {!showCodeField && (
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSendCode} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>📧 Enviar Código de Verificación</Text>}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.btnBack} onPress={() => {
              if (showCodeField) {
                setShowCodeField(false);
                setRequiresEmailVerification(false);
                setVerificationCode('');
                setResendCooldown(0);
              } else {
                navigation.goBack();
              }
            }}>
              <Text style={styles.btnBackText}>{showCodeField ? '← Volver a Editar' : '← Volver'}</Text>
            </TouchableOpacity>

            <Text style={{ marginTop: 14, fontSize: 12, color: colors.blueGray, textAlign: 'center' }}>
              Backend: {BACKEND_URL}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: colors.backgroundLight },
  header: {
    height: 70,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center' },

  logoGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImage: { width: 42, height: 42, resizeMode: 'contain', borderRadius: 10 },
  logoText: { fontSize: 22, fontWeight: 'bold', color: colors.navyDark },

  contentWrapper: { padding: 20, maxWidth: 500, alignSelf: 'center', width: '100%' },
  progressSection: { marginBottom: 25 },
  progressTitle: { fontSize: 18, fontWeight: 'bold', color: colors.navyDark, marginBottom: 10 },
  progressBarBackground: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', width: '100%', backgroundColor: colors.primary },

  formCard: { backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 5, marginBottom: 20 },
  cardTitle: { fontSize: 24, fontWeight: 'bold', color: colors.navyDark, textAlign: 'center', marginBottom: 10 },
  cardSubtitle: { fontSize: 15, color: colors.blueGray, textAlign: 'center', marginBottom: 25 },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navyDark, marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 50,
    backgroundColor: colors.slate50,
  },
  textInput: { flex: 1, fontSize: 16, color: colors.navyDark },
  passwordRulesBox: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    padding: 10,
    marginTop: -6,
    marginBottom: 16,
  },
  passwordRuleItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  passwordRuleText: { marginLeft: 8, fontSize: 12, color: colors.blueGray },
  passwordRuleTextOk: { color: colors.success, fontWeight: '600' },

  verificationSection: {
    width: '100%',
    paddingVertical: 10,
  },
  verificationCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  verificationTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.navyDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  verificationSubtitle: {
    fontSize: 15,
    color: colors.blueGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  highlightEmail: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navyDark,
    marginBottom: 10,
    marginLeft: 4,
  },
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
  },
  inputIcon: {
    marginRight: 12,
  },
  modernTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.navyDark,
    letterSpacing: 1,
  },
  btnPrimaryModern: {
    backgroundColor: colors.primary,
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextModern: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnSecondaryModern: {
    backgroundColor: 'white',
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  btnSecondaryTextModern: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondaryDisabled: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  btnSecondaryTextDisabled: {
    color: '#94a3b8',
  },
  btnBack: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
  },
  btnBackText: {
    color: colors.blueGray,
    fontWeight: '600',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  btnPrimaryText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default RegistroCredencialesScreen;
