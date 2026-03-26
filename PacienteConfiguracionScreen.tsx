import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Image,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import type { RootStackParamList } from './navigation/types';
import { useLanguage } from './localization/LanguageContext';
import { ensurePatientSessionUser, getPatientDisplayName } from './utils/patientSession';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');

const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';
const SETTINGS_KEY = 'pacienteSettings';

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

const sanitizeFotoUrl = (value: unknown) => {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};

const PacienteConfiguracionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language: appLanguage, setLanguage, t, tx } = useLanguage();
  const [user, setUser] = useState<User | null>(null);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [timeFormat, setTimeFormat] = useState('24 horas');
  const [timeZone, setTimeZone] = useState('(GMT-04:00) Santo Domingo');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorField, setSelectorField] = useState<'language' | 'timeFormat' | 'timeZone' | null>(
    null
  );
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadUser = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const webUser = ensurePatientSessionUser(parseUser(localStorage.getItem(LEGACY_USER_STORAGE_KEY)));
        if (webUser) {
          setUser(webUser);
        }
      }

      const secureUser = ensurePatientSessionUser(
        parseUser(await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY))
      );
      if (secureUser) {
        setUser(secureUser);
      } else {
        const asyncUser = ensurePatientSessionUser(parseUser(await AsyncStorage.getItem(STORAGE_KEY)));
        setUser(asyncUser);
      }

      const savedSettingsRaw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (savedSettingsRaw) {
        const saved = JSON.parse(savedSettingsRaw) as {
          timeFormat?: string;
          timeZone?: string;
        };
        if (saved.timeFormat) setTimeFormat(saved.timeFormat);
        if (saved.timeZone) setTimeZone(saved.timeZone);
      } else if (Platform.OS === 'web') {
        const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedZone === 'America/Santo_Domingo') {
          setTimeZone('(GMT-04:00) Santo Domingo');
        } else if (detectedZone === 'America/Bogota') {
          setTimeZone('(GMT-05:00) Bogota');
        } else if (detectedZone === 'America/Mexico_City') {
          setTimeZone('(GMT-06:00) Ciudad de Mexico');
        }
      }
    } catch {
      setUser(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const fullName = useMemo(() => getPatientDisplayName(user, 'Paciente'), [user]);

  const planLabel = useMemo(() => {
    const plan = (user?.plan || '').trim();
    return plan ? `Paciente ${plan}` : 'Paciente';
  }, [user]);

  const avatarSource: ImageSourcePropType = useMemo(() => {
    const fotoUrl = sanitizeFotoUrl(user?.fotoUrl);
    if (fotoUrl) {
      return { uri: fotoUrl };
    }
    return DefaultAvatar;
  }, [user?.fotoUrl]);
  const hasProfilePhoto = useMemo(() => Boolean(sanitizeFotoUrl(user?.fotoUrl)), [user?.fotoUrl]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem(STORAGE_KEY);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const languageLabel = useMemo(() => {
    if (appLanguage === 'en') return 'English (US)';
    if (appLanguage === 'pt') return 'Português (BR)';
    return 'Español (ES)';
  }, [appLanguage]);

  const optionsMap = {
    language: [
      { label: 'Español (ES)', value: 'es' as const },
      { label: 'English (US)', value: 'en' as const },
      { label: 'Português (BR)', value: 'pt' as const },
    ],
    timeFormat: ['24 horas', '12 horas'],
    timeZone: ['(GMT-04:00) Santo Domingo', '(GMT-05:00) Bogota', '(GMT-06:00) Ciudad de Mexico'],
  };

  const selectorTitle =
    selectorField === 'language'
      ? t('config.selectLanguage')
      : selectorField === 'timeFormat'
      ? t('config.selectTimeFormat')
      : t('config.selectTimeZone');

  const openSelector = (field: 'language' | 'timeFormat' | 'timeZone') => {
    setSelectorField(field);
    setSelectorOpen(true);
  };

  const applyValue = async (value: string) => {
    if (!selectorField) return;

    if (selectorField === 'language') {
      if (value === 'es' || value === 'en' || value === 'pt') {
        await setLanguage(value);
      }
      setSelectorOpen(false);
      return;
    }
    if (selectorField === 'timeFormat') setTimeFormat(value);
    if (selectorField === 'timeZone') setTimeZone(value);

    const payload = {
      timeFormat: selectorField === 'timeFormat' ? value : timeFormat,
      timeZone: selectorField === 'timeZone' ? value : timeZone,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    setSelectorOpen(false);
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(
        tx({
          es: 'Campos incompletos',
          en: 'Incomplete fields',
          pt: 'Campos incompletos',
        }),
        tx({
          es: 'Completa todos los campos para continuar.',
          en: 'Fill all fields to continue.',
          pt: 'Preencha todos os campos para continuar.',
        })
      );
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(
        tx({
          es: 'Contraseña débil',
          en: 'Weak password',
          pt: 'Senha fraca',
        }),
        tx({
          es: 'La nueva contraseña debe tener al menos 8 caracteres.',
          en: 'The new password must be at least 8 characters long.',
          pt: 'A nova senha deve ter pelo menos 8 caracteres.',
        })
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        tx({
          es: 'No coincide',
          en: 'Does not match',
          pt: 'Nao coincide',
        }),
        tx({
          es: 'La confirmación de contraseña no coincide.',
          en: 'Password confirmation does not match.',
          pt: 'A confirmacao da senha nao coincide.',
        })
      );
      return;
    }

    setPasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert(
      tx({
        es: 'Contraseña actualizada',
        en: 'Password updated',
        pt: 'Senha atualizada',
      }),
      tx({
        es: 'Tu contraseña fue cambiada correctamente.',
        en: 'Your password was changed successfully.',
        pt: 'Sua senha foi alterada com sucesso.',
      })
    );
  };

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
            {!hasProfilePhoto ? (
              <Text style={styles.hintText}>No tienes foto. Ve a Perfil para agregarla.</Text>
            ) : null}
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

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteRecetasDocumentos')}
            >
              <MaterialIcons name="description" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.recipesDocs')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacienteNotificaciones')}
            >
              <MaterialIcons name="notifications" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.notifications')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => navigation.navigate('PacientePerfil')}
            >
              <MaterialIcons name="account-circle" size={20} color={colors.muted} />
              <Text style={styles.menuText}>{t('menu.profile')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItemRow, styles.menuItemActive]}
              onPress={() => navigation.navigate('PacienteConfiguracion')}
            >
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
        <Text style={styles.title}>{t('config.title')}</Text>
        <Text style={styles.subtitle}>{t('config.subtitle')}</Text>

        <View style={styles.grid}>
          <View style={styles.cardHalf}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <MaterialIcons name="manage-accounts" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('config.account')}</Text>
                <Text style={styles.cardHint}>{t('config.accountHint')}</Text>
              </View>
            </View>

            <View style={styles.itemRow}>
              <View>
                <Text style={styles.itemTitle}>{t('config.language')}</Text>
                <Text style={styles.itemSub}>{languageLabel}</Text>
              </View>
              <TouchableOpacity onPress={() => openSelector('language')}>
                <Text style={styles.itemAction}>{t('config.change')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.itemRow}>
              <View>
                <Text style={styles.itemTitle}>{t('config.timeFormat')}</Text>
                <Text style={styles.itemSub}>{timeFormat}</Text>
              </View>
              <TouchableOpacity onPress={() => openSelector('timeFormat')}>
                <Text style={styles.itemAction}>{t('config.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.itemRowLast}>
              <View>
                <Text style={styles.itemTitle}>{t('config.timeZone')}</Text>
                <Text style={styles.itemSub}>{timeZone}</Text>
              </View>
              <TouchableOpacity onPress={() => openSelector('timeZone')}>
                <Text style={styles.itemAction}>{t('config.update')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardHalf}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <MaterialIcons name="notifications-active" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('config.notifications')}</Text>
                <Text style={styles.cardHint}>{t('config.notificationsHint')}</Text>
              </View>
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.itemTitle}>{t('config.email')}</Text>
                <Text style={styles.itemSub}>{t('config.emailHint')}</Text>
              </View>
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ false: '#d6e0eb', true: '#137fec' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.itemTitle}>{t('config.sms')}</Text>
                <Text style={styles.itemSub}>{t('config.smsHint')}</Text>
              </View>
              <Switch
                value={smsEnabled}
                onValueChange={setSmsEnabled}
                trackColor={{ false: '#d6e0eb', true: '#137fec' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={styles.toggleRowLast}>
              <View>
                <Text style={styles.itemTitle}>{t('config.push')}</Text>
                <Text style={styles.itemSub}>{t('config.pushHint')}</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: '#d6e0eb', true: '#137fec' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={styles.cardHalf}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <MaterialIcons name="lock" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('config.security')}</Text>
                <Text style={styles.cardHint}>{t('config.securityHint')}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.securityButton}
              onPress={() => navigation.navigate('PacienteCambiarContrasena')}
            >
              <View style={styles.securityLeft}>
                <MaterialIcons name="vpn-key" size={18} color="#7f93a8" />
                <Text style={styles.securityText}>{t('config.changePassword')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9bb1c7" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.securityButton}
              onPress={() => navigation.navigate('PacienteHistorialSesiones')}
            >
              <View style={styles.securityLeft}>
                <MaterialIcons name="history" size={18} color="#7f93a8" />
                <Text style={styles.securityText}>{t('config.sessionHistory')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9bb1c7" />
            </TouchableOpacity>
          </View>

          <View style={styles.cardHalf}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <MaterialIcons name="help-outline" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('config.support')}</Text>
                <Text style={styles.cardHint}>{t('config.supportHint')}</Text>
              </View>
            </View>

            <View style={styles.supportBox}>
              <Text style={styles.supportTitle}>{t('config.needHelp')}</Text>
              <Text style={styles.supportText}>{t('config.supportText')}</Text>

              <View style={styles.supportButtons}>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() =>
                    Alert.alert(
                      'Contacto de soporte',
                      'Escribenos a soporte@virem.app y te responderemos en breve.'
                    )
                  }
                >
                  <Text style={styles.contactBtnText}>{t('config.contact')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.faqBtn}
                  onPress={() =>
                    Alert.alert(
                      'Preguntas frecuentes',
                      'Puedes revisar tus dudas en el Centro de Ayuda dentro de la app.'
                    )
                  }
                >
                  <Text style={styles.faqBtnText}>{t('config.faq')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.versionRow}>
              <MaterialIcons name="info-outline" size={14} color="#9bb1c7" />
              <Text style={styles.versionText}>{t('config.systemVersion')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={selectorOpen} transparent animationType="fade" onRequestClose={() => setSelectorOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectorTitle}</Text>
            {selectorField === 'language'
              ? optionsMap.language.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.optionButton}
                    onPress={() => applyValue(option.value)}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                  </TouchableOpacity>
                ))
              : (selectorField ? optionsMap[selectorField] : []).map((option) => (
                  <TouchableOpacity key={option} style={styles.optionButton} onPress={() => applyValue(option)}>
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectorOpen(false)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={passwordModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {tx({
                es: 'Cambiar contraseña',
                en: 'Change password',
                pt: 'Alterar senha',
              })}
            </Text>

            <TextInput
              style={styles.passwordInput}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={tx({
                es: 'Contraseña actual',
                en: 'Current password',
                pt: 'Senha atual',
              })}
              placeholderTextColor="#90a4b8"
            />
            <TextInput
              style={styles.passwordInput}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={tx({
                es: 'Nueva contraseña',
                en: 'New password',
                pt: 'Nova senha',
              })}
              placeholderTextColor="#90a4b8"
            />
            <TextInput
              style={styles.passwordInput}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={tx({
                es: 'Confirmar contraseña',
                en: 'Confirm password',
                pt: 'Confirmar senha',
              })}
              placeholderTextColor="#90a4b8"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setPasswordModalOpen(false)}>
                <Text style={styles.modalSecondaryText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleChangePassword}>
                <Text style={styles.modalPrimaryText}>
                  {tx({
                    es: 'Guardar',
                    en: 'Save',
                    pt: 'Salvar',
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  userAvatar: {
    width: 76,
    height: 76,
    borderRadius: 76,
    marginBottom: 10,
    borderWidth: 4,
    borderColor: '#f5f7fb',
  },
  userName: { fontWeight: '800', color: colors.dark, fontSize: 14 },
  userPlan: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  hintText: { marginTop: 6, color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },

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
  menuItemActive: {
    backgroundColor: 'rgba(19,127,236,0.10)',
    borderRightWidth: 3,
    borderRightColor: colors.primary,
  },
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
  title: { fontSize: 42, fontWeight: '900', color: colors.dark, marginTop: 8 },
  subtitle: { fontSize: 20, color: colors.muted, marginTop: 6, marginBottom: 18, fontWeight: '600' },

  grid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: 14,
  },

  cardHalf: {
    width: Platform.OS === 'web' ? '49%' : '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4edf7',
    padding: 16,
    minHeight: 230,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(19,127,236,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  cardHint: { color: '#9bb1c7', fontSize: 11, fontWeight: '600', marginTop: 2 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#edf3fa',
  },
  itemRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  itemTitle: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  itemSub: { color: '#7f93a8', fontSize: 12, marginTop: 1, fontWeight: '600' },
  itemAction: { color: colors.primary, fontSize: 14, fontWeight: '800' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#edf3fa',
  },
  toggleRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },

  securityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  securityLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  securityText: { color: colors.blue, fontSize: 14, fontWeight: '800' },

  supportBox: {
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 12,
    padding: 12,
  },
  supportTitle: { color: colors.dark, fontSize: 14, fontWeight: '900', marginBottom: 4 },
  supportText: { color: '#7f93a8', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  supportButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  faqBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  faqBtnText: { color: colors.primary, fontSize: 13, fontWeight: '900' },

  versionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  versionText: { color: '#9bb1c7', fontSize: 11, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,25,49,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dce8f5',
    padding: 14,
  },
  modalTitle: {
    color: colors.dark,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#f8fbff',
  },
  optionText: {
    color: colors.blue,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 2,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 14,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    backgroundColor: '#f8fbff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: colors.dark,
    fontWeight: '600',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalPrimaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 10,
  },
  modalPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  modalSecondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  modalSecondaryText: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 13,
  },
});

export default PacienteConfiguracionScreen;


