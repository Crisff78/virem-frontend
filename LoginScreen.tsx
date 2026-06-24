import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { useResponsive } from './hooks/useResponsive';

import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

import { RootStackParamList } from './navigation/types';
import { isValidEmail } from './utils/validation';
import { apiClient, ApiError } from './utils/api';
import { useAuth } from './providers/AuthProvider';
import BackToLandingButton from './components/BackToLandingButton';

import { MaterialCommunityIcons } from '@expo/vector-icons';

const ViremLogo = require('./assets/imagenes/descarga.png');
const MEDICO_CACHE_BY_EMAIL_KEY = 'medicoProfileByEmail';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

type Notice = { type: 'error' | 'info'; text: string } | null;

const COLORS = {
  primary: '#1F4770',
  backgroundLight: '#F3F6F9',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  borderLight: '#E0E0E0',
  cardLight: '#FFFFFF',
  link: '#1F4770',
  iconColor: '#888888',
  error: '#D92D20',
  errorBg: '#FEF3F2',
  errorBorder: '#FDA29B',
  infoBg: '#EFF6FF',
  infoBorder: '#B2CCF0',
};

async function getCachedMedicoProfileByEmail(email: string) {
  const key = String(email || '').trim().toLowerCase();
  if (!key) return null;

  try {
    const rawMap =
      Platform.OS === 'web'
        ? localStorage.getItem(MEDICO_CACHE_BY_EMAIL_KEY)
        : await SecureStore.getItemAsync(MEDICO_CACHE_BY_EMAIL_KEY);

    if (!rawMap) return null;
    const map = JSON.parse(rawMap) as Record<
      string,
      {
        nombreCompleto?: string;
        especialidad?: string;
        fotoUrl?: string;
        cedula?: string;
        telefono?: string;
        genero?: string;
        fechanacimiento?: string;
      }
    >;
    return map[key] || null;
  } catch {
    return null;
  }
}

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Login'>>();
  const { signIn } = useAuth<any>();

  const [email, setEmail] = useState(route.params?.prefillEmail ?? '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Validación en vivo / mensajes en pantalla
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  // Admin 2FA State
  const [adminCodeSent, setAdminCodeSent] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);

  const isAdminCredentials = email.trim().toLowerCase() === 'admin' && password === 'AdminPassword123!';

  const validateEmail = (value: string) => {
    const v = value.trim();
    if (!v) return 'El correo es obligatorio.';
    // 'admin' es un usuario especial del sistema, no un correo.
    if (v.toLowerCase() !== 'admin' && !isValidEmail(v)) return 'Ingrese un correo válido.';
    return '';
  };

  const validatePassword = (value: string) => {
    if (!value) return 'La contraseña es obligatoria.';
    return '';
  };

  const handleLogin = async () => {
    if (isLoading) return; // evita doble envío

    const emailTrim = email.toLowerCase().trim();
    setSubmitted(true);
    setNotice(null);

    // Validación local antes de llamar al servidor
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    // Flujo Admin con 2FA (se mantiene igual, pero con mensajes visibles)
    if (emailTrim === 'admin' && password === 'AdminPassword123!') {
      if (!adminCodeSent) {
        setNotice({ type: 'info', text: 'Primero envía y verifica el código de seguridad.' });
        return;
      }
      if (adminCodeInput !== generatedCode) {
        setNotice({ type: 'error', text: 'El código de seguridad es incorrecto.' });
        return;
      }
    }

    setIsLoading(true);

    try {
      const data = await apiClient.post<any>('/api/auth/login', {
        body: { email: emailTrim, password },
      });

      const token = data?.token ?? data?.data?.token ?? '';
      const userProfile = data?.user ?? data?.data?.user ?? null;
      const cachedMedico = await getCachedMedicoProfileByEmail(emailTrim);
      const responseRoleId = Number(userProfile?.rolid ?? userProfile?.rolId ?? userProfile?.roleId);
      const shouldMergeMedicoCache = responseRoleId === 2;
      const mergedProfile =
        shouldMergeMedicoCache && cachedMedico && userProfile
          ? {
            ...userProfile,
            nombreCompleto: userProfile?.nombreCompleto || cachedMedico?.nombreCompleto,
            especialidad: userProfile?.especialidad || cachedMedico?.especialidad,
            fotoUrl: userProfile?.fotoUrl || cachedMedico?.fotoUrl,
            cedula: userProfile?.cedula || cachedMedico?.cedula,
            telefono: userProfile?.telefono || cachedMedico?.telefono,
            genero: userProfile?.genero || cachedMedico?.genero,
            fechanacimiento: userProfile?.fechanacimiento || cachedMedico?.fechanacimiento,
          }
          : userProfile;

      await signIn(token, mergedProfile);
      const rolid = Number(mergedProfile?.rolid);
      const targetRoute: keyof RootStackParamList =
        rolid === 3 ? 'AdminPanel' : rolid === 2 ? 'DashboardMedico' : 'DashboardPaciente';

      navigation.reset({ index: 0, routes: [{ name: targetRoute }] });

    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // Mensaje genérico por seguridad: no revelamos qué campo falló.
          setNotice({ type: 'error', text: 'Correo o contraseña incorrectos. Revise sus datos.' });
        } else if (err.status === 403) {
          setNotice({ type: 'error', text: err.message || 'Tu cuenta aún no está habilitada para iniciar sesión.' });
        } else if (err.status === 429) {
          setNotice({ type: 'error', text: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' });
        } else if (err.status >= 500) {
          setNotice({ type: 'error', text: 'Tuvimos un problema en el servidor. Intenta de nuevo más tarde.' });
        } else {
          setNotice({ type: 'error', text: 'Correo o contraseña incorrectos. Revise sus datos.' });
        }
      } else {
        // fetch lanza TypeError cuando no hay conexión / el servidor no responde
        setNotice({ type: 'error', text: 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAdminCode = async () => {
    setIsSendingCode(true);
    setNotice(null);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);

    try {
      // Make.com Webhook Integration
      const webhookUrl = 'https://hook.us2.make.com/mihua6oq9816sr7l3050cmmjnqihlx8x';

      const formData = new URLSearchParams();
      formData.append('type', 'admin_2fa');
      formData.append('email', 'yaslyncastillo21@gmail.com');
      formData.append('code', code);
      formData.append('user', 'Admin');
      formData.append('timestamp', new Date().toISOString());

      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      setAdminCodeSent(true);
      setNotice({ type: 'info', text: 'Código enviado. Revisa el correo yaslyncastillo21@gmail.com para obtener tu código de acceso.' });
    } catch (error) {
      // Si no hay webhook seguimos permitiéndolo pero avisamos
      console.error('Error sending code:', error);
      setAdminCodeSent(true);
      setNotice({ type: 'info', text: 'Se generó el código (ver consola) pero falló la conexión con el servidor de correos.' });
      console.log('CODIGO GENERADO:', code);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleForgotPassword = () => navigation.navigate('RecuperarContrasena');
  const handleGoToRegister = () => navigation.navigate('SeleccionPerfil');
  const goToLanding = () => navigation.navigate('Landing');

  const { isDesktop, isTablet, isMobile, select, width } = useResponsive();

  const emailHasError = !!emailError;
  const passwordHasError = !!passwordError;

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.backgroundLight} />

      <BackToLandingButton style={styles.backButton} />

      <View style={styles.container}>
        <View style={[
          styles.card,
          {
            padding: select({ mobile: 20, tablet: 30, desktop: 40 }),
            width: select({
              mobile: Math.max(280, Math.min(400, width - 40)),
              tablet: 400,
              desktop: 400
            })
          }
        ]}>
          <Pressable
            onPress={goToLanding}
            accessibilityRole="button"
            accessibilityLabel="Ir al inicio"
            style={({ pressed }) => [
              styles.logoSectionHorizontal,
              Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Image source={ViremLogo} style={styles.logoSmallOriginal} />
            <Text style={styles.appNameHorizontal}>VIREM</Text>
          </Pressable>

          <Text style={styles.title}>Accede a tu cuenta</Text>
          <Text style={styles.subtitle}>
            Bienvenido de nuevo. Por favor, introduce tus credenciales.
          </Text>

          <View style={styles.form}>
            <Text style={styles.inputLabel}>Correo Electrónico</Text>
            <View style={[styles.inputContainer, emailHasError && styles.inputContainerError]}>
              <MaterialCommunityIcons
                name="email-outline"
                size={22}
                color={COLORS.iconColor}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor={COLORS.iconColor}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (notice) setNotice(null);
                  if (submitted) setEmailError(validateEmail(t));
                }}
                onBlur={() => setEmailError(validateEmail(email))}
              />
            </View>
            {emailHasError && <Text style={styles.fieldError}>{emailError}</Text>}

            <Text style={styles.inputLabel}>Contraseña</Text>
            <View style={[styles.inputContainer, passwordHasError && styles.inputContainerError]}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={22}
                color={COLORS.iconColor}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Introduce tu contraseña"
                placeholderTextColor={COLORS.iconColor}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (notice) setNotice(null);
                  if (submitted) setPasswordError(validatePassword(t));
                }}
                onBlur={() => setPasswordError(validatePassword(password))}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.passwordToggle}>
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={COLORS.iconColor}
                />
              </TouchableOpacity>
            </View>
            {passwordHasError && <Text style={styles.fieldError}>{passwordError}</Text>}

            {isAdminCredentials && !adminCodeSent && (
              <TouchableOpacity
                style={[styles.adminCodeBtn, { opacity: isSendingCode ? 0.7 : 1 }]}
                onPress={handleSendAdminCode}
                disabled={isSendingCode}
              >
                {isSendingCode ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <Text style={styles.adminCodeBtnText}>ENVIAR CÓDIGO DE SEGURIDAD</Text>
                )}
              </TouchableOpacity>
            )}

            {adminCodeSent && (
              <View>
                <Text style={styles.inputLabel}>Código de Seguridad</Text>
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={22}
                    color={COLORS.iconColor}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Introduce el código de 6 dígitos"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={adminCodeInput}
                    onChangeText={setAdminCodeInput}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordLink}>
              <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            {notice && (
              <View
                style={[
                  styles.notice,
                  notice.type === 'error' ? styles.noticeError : styles.noticeInfo,
                ]}
                accessibilityLiveRegion="polite"
              >
                <MaterialCommunityIcons
                  name={notice.type === 'error' ? 'alert-circle-outline' : 'information-outline'}
                  size={20}
                  color={notice.type === 'error' ? COLORS.error : COLORS.primary}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.noticeText,
                    { color: notice.type === 'error' ? COLORS.error : COLORS.primary },
                  ]}
                >
                  {notice.text}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, { opacity: isLoading ? 0.7 : 1 }]}
              activeOpacity={0.8}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Iniciar Sesión</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleGoToRegister} style={styles.registerLink}>
            <Text style={styles.registerText}>
              ¿No tienes cuenta? <Text style={styles.linkTextBold}>Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.backgroundLight },
  backButton: { position: 'absolute', top: 16, left: 16, zIndex: 10 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.cardLight,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
  },
  logoSectionHorizontal: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoSmallOriginal: { width: 30, height: 30, resizeMode: 'contain', marginRight: 8 },
  appNameHorizontal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 30, paddingHorizontal: 10 },
  form: { width: '100%', gap: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 5 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    backgroundColor: COLORS.cardLight,
  },
  inputContainerError: {
    borderColor: COLORS.error,
    borderWidth: 1.5,
  },
  inputIcon: { paddingLeft: 12, paddingRight: 8 },
  input: { flex: 1, fontSize: 16, color: COLORS.textPrimary, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  fieldError: { color: COLORS.error, fontSize: 13, marginTop: -12, marginBottom: -4, fontWeight: '500' },
  forgotPasswordLink: { alignSelf: 'flex-end', paddingVertical: 5, marginTop: -5 },
  linkText: { color: COLORS.link, fontSize: 14, fontWeight: '600' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noticeError: { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorBorder },
  noticeInfo: { backgroundColor: COLORS.infoBg, borderColor: COLORS.infoBorder },
  noticeText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  button: { width: '100%', height: 48, backgroundColor: COLORS.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  buttonText: { color: COLORS.cardLight, fontSize: 18, fontWeight: 'bold' },
  registerLink: { marginTop: 20 },
  registerText: { fontSize: 14, color: COLORS.textSecondary },
  linkTextBold: { color: COLORS.link, fontSize: 14, fontWeight: 'bold' },
  passwordToggle: { paddingRight: 12, justifyContent: 'center' as const },
  adminCodeBtn: {
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 10,
  },
  adminCodeBtnText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
