import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'es' | 'en' | 'pt';

type TranslationKey =
  | 'menu.home'
  | 'menu.searchDoctor'
  | 'menu.appointments'
  | 'menu.videocall'
  | 'menu.chat'
  | 'menu.assistant'
  | 'menu.recipesDocs'
  | 'menu.profile'
  | 'menu.settings'
  | 'menu.notifications'
  | 'menu.logout'
  | 'config.title'
  | 'config.subtitle'
  | 'config.account'
  | 'config.accountHint'
  | 'config.language'
  | 'config.timeFormat'
  | 'config.timeZone'
  | 'config.change'
  | 'config.edit'
  | 'config.update'
  | 'config.notifications'
  | 'config.notificationsHint'
  | 'config.email'
  | 'config.sms'
  | 'config.push'
  | 'config.emailHint'
  | 'config.smsHint'
  | 'config.pushHint'
  | 'config.security'
  | 'config.securityHint'
  | 'config.changePassword'
  | 'config.sessionHistory'
  | 'config.support'
  | 'config.supportHint'
  | 'config.needHelp'
  | 'config.supportText'
  | 'config.contact'
  | 'config.faq'
  | 'config.systemVersion'
  | 'config.selectLanguage'
  | 'config.selectTimeFormat'
  | 'config.selectTimeZone'
  | 'common.cancel'
  | 'notif.center'
  | 'notif.searchPlaceholder'
  | 'notif.markAllRead'
  | 'notif.all'
  | 'notif.appointments'
  | 'notif.messages'
  | 'notif.documents'
  | 'notif.unread'
  | 'notif.today'
  | 'notif.yesterday'
  | 'notif.thisWeek'
  | 'notif.statusUnread'
  | 'notif.statusRead'
  | 'notif.total'
  | 'notif.updated';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
  tx: (values: { es: string; en: string; pt: string }) => string;
};

const STORAGE_KEY = 'appLanguage';

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  es: {
    'menu.home': 'Inicio',
    'menu.searchDoctor': 'Buscar Médico',
    'menu.appointments': 'Mis Citas',
    'menu.videocall': 'Consulta Virtual',
    'menu.chat': 'Chat',
    'menu.assistant': 'Asistente de salud',
    'menu.recipesDocs': 'Recetas / Documentos',
    'menu.profile': 'Perfil',
    'menu.settings': 'Configuración',
    'menu.notifications': 'Notificaciones',
    'menu.logout': 'Cerrar Sesión',
    'config.title': 'Configuración del Sistema',
    'config.subtitle': 'Gestiona tu cuenta, notificaciones, privacidad y preferencias del portal médico.',
    'config.account': 'Configuración de Cuenta',
    'config.accountHint': 'Personaliza tu experiencia básica',
    'config.language': 'Idioma',
    'config.timeFormat': 'Formato de hora',
    'config.timeZone': 'Zona Horaria',
    'config.change': 'Cambiar',
    'config.edit': 'Editar',
    'config.update': 'Actualizar',
    'config.notifications': 'Notificaciones',
    'config.notificationsHint': 'Elige cómo quieres recibir alertas',
    'config.email': 'Correo electrónico',
    'config.sms': 'Mensajes SMS',
    'config.push': 'Notificaciones Push',
    'config.emailHint': 'Resumen semanal y avisos',
    'config.smsHint': 'Recordatorios de citas',
    'config.pushHint': 'Alertas en tiempo real',
    'config.security': 'Privacidad y Seguridad',
    'config.securityHint': 'Protege tu información médica',
    'config.changePassword': 'Cambiar Contraseña',
    'config.sessionHistory': 'Historial de Sesiones',
    'config.support': 'Soporte y Ayuda',
    'config.supportHint': 'Estamos aquí para ayudarte',
    'config.needHelp': '¿Necesitas asistencia?',
    'config.supportText': 'Nuestro equipo técnico está disponible 24/7 para cualquier inconveniente con la plataforma.',
    'config.contact': 'Contactar',
    'config.faq': 'FAQs',
    'config.systemVersion': 'Versión del sistema: VIREM v2.4.1',
    'config.selectLanguage': 'Seleccionar idioma',
    'config.selectTimeFormat': 'Seleccionar formato de hora',
    'config.selectTimeZone': 'Seleccionar zona horaria',
    'common.cancel': 'Cancelar',
    'notif.center': 'Centro de Notificaciones',
    'notif.searchPlaceholder': 'Buscar notificaciones...',
    'notif.markAllRead': 'Marcar todo como leído',
    'notif.all': 'Todas',
    'notif.appointments': 'Citas',
    'notif.messages': 'Mensajes',
    'notif.documents': 'Documentos',
    'notif.unread': 'No leídas',
    'notif.today': 'HOY',
    'notif.yesterday': 'AYER',
    'notif.thisWeek': 'ESTA SEMANA',
    'notif.statusUnread': 'NO LEÍDA',
    'notif.statusRead': 'LEÍDA',
    'notif.total': 'Total',
    'notif.updated': 'Actualizado: Justo ahora',
  },
  en: {
    'menu.home': 'Home',
    'menu.searchDoctor': 'Find Doctor',
    'menu.appointments': 'My Appointments',
    'menu.videocall': 'Virtual Consultation',
    'menu.chat': 'Chat',
    'menu.assistant': 'Health assistant',
    'menu.recipesDocs': 'Prescriptions / Documents',
    'menu.profile': 'Profile',
    'menu.settings': 'Settings',
    'menu.notifications': 'Notifications',
    'menu.logout': 'Sign Out',
    'config.title': 'System Settings',
    'config.subtitle': 'Manage your account, notifications, privacy and portal preferences.',
    'config.account': 'Account Settings',
    'config.accountHint': 'Customize your basic experience',
    'config.language': 'Language',
    'config.timeFormat': 'Time format',
    'config.timeZone': 'Time zone',
    'config.change': 'Change',
    'config.edit': 'Edit',
    'config.update': 'Update',
    'config.notifications': 'Notifications',
    'config.notificationsHint': 'Choose how you want to receive alerts',
    'config.email': 'Email',
    'config.sms': 'SMS Messages',
    'config.push': 'Push Notifications',
    'config.emailHint': 'Weekly summary and notices',
    'config.smsHint': 'Appointment reminders',
    'config.pushHint': 'Real-time alerts',
    'config.security': 'Privacy and Security',
    'config.securityHint': 'Protect your medical information',
    'config.changePassword': 'Change Password',
    'config.sessionHistory': 'Session History',
    'config.support': 'Support and Help',
    'config.supportHint': 'We are here to help you',
    'config.needHelp': 'Need assistance?',
    'config.supportText': 'Our technical team is available 24/7 for any platform issue.',
    'config.contact': 'Contact',
    'config.faq': 'FAQs',
    'config.systemVersion': 'System version: VIREM v2.4.1',
    'config.selectLanguage': 'Select language',
    'config.selectTimeFormat': 'Select time format',
    'config.selectTimeZone': 'Select time zone',
    'common.cancel': 'Cancel',
    'notif.center': 'Notification Center',
    'notif.searchPlaceholder': 'Search notifications...',
    'notif.markAllRead': 'Mark all as read',
    'notif.all': 'All',
    'notif.appointments': 'Appointments',
    'notif.messages': 'Messages',
    'notif.documents': 'Documents',
    'notif.unread': 'Unread',
    'notif.today': 'TODAY',
    'notif.yesterday': 'YESTERDAY',
    'notif.thisWeek': 'THIS WEEK',
    'notif.statusUnread': 'UNREAD',
    'notif.statusRead': 'READ',
    'notif.total': 'Total',
    'notif.updated': 'Updated: Just now',
  },
  pt: {
    'menu.home': 'Inicio',
    'menu.searchDoctor': 'Buscar Medico',
    'menu.appointments': 'Minhas Consultas',
    'menu.videocall': 'Consulta Virtual',
    'menu.chat': 'Chat',
    'menu.assistant': 'Assistente de saúde',
    'menu.recipesDocs': 'Receitas / Documentos',
    'menu.profile': 'Perfil',
    'menu.settings': 'Configuracoes',
    'menu.notifications': 'Notificacoes',
    'menu.logout': 'Sair',
    'config.title': 'Configuracoes do Sistema',
    'config.subtitle': 'Gerencie sua conta, notificacoes, privacidade e preferencias do portal medico.',
    'config.account': 'Configuracao da Conta',
    'config.accountHint': 'Personalize sua experiencia basica',
    'config.language': 'Idioma',
    'config.timeFormat': 'Formato de hora',
    'config.timeZone': 'Fuso horario',
    'config.change': 'Alterar',
    'config.edit': 'Editar',
    'config.update': 'Atualizar',
    'config.notifications': 'Notificacoes',
    'config.notificationsHint': 'Escolha como deseja receber alertas',
    'config.email': 'E-mail',
    'config.sms': 'Mensagens SMS',
    'config.push': 'Notificacoes Push',
    'config.emailHint': 'Resumo semanal e avisos',
    'config.smsHint': 'Lembretes de consultas',
    'config.pushHint': 'Alertas em tempo real',
    'config.security': 'Privacidade e Seguranca',
    'config.securityHint': 'Proteja suas informacoes medicas',
    'config.changePassword': 'Alterar Senha',
    'config.sessionHistory': 'Historico de Sessoes',
    'config.support': 'Suporte e Ajuda',
    'config.supportHint': 'Estamos aqui para ajudar',
    'config.needHelp': 'Precisa de ajuda?',
    'config.supportText': 'Nossa equipe tecnica esta disponivel 24/7 para qualquer problema na plataforma.',
    'config.contact': 'Contato',
    'config.faq': 'FAQs',
    'config.systemVersion': 'Versao do sistema: VIREM v2.4.1',
    'config.selectLanguage': 'Selecionar idioma',
    'config.selectTimeFormat': 'Selecionar formato de hora',
    'config.selectTimeZone': 'Selecionar fuso horario',
    'common.cancel': 'Cancelar',
    'notif.center': 'Central de Notificacoes',
    'notif.searchPlaceholder': 'Buscar notificacoes...',
    'notif.markAllRead': 'Marcar tudo como lido',
    'notif.all': 'Todas',
    'notif.appointments': 'Consultas',
    'notif.messages': 'Mensagens',
    'notif.documents': 'Documentos',
    'notif.unread': 'Nao lidas',
    'notif.today': 'HOJE',
    'notif.yesterday': 'ONTEM',
    'notif.thisWeek': 'ESTA SEMANA',
    'notif.statusUnread': 'NAO LIDA',
    'notif.statusRead': 'LIDA',
    'notif.total': 'Total',
    'notif.updated': 'Atualizado: Agora mesmo',
  },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>('es');

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'es' || saved === 'en' || saved === 'pt') {
        setLanguageState(saved);
      }
    };
    load();
  }, []);

  const setLanguage = async (lang: AppLanguage) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: TranslationKey): string => translations[language][key] ?? key;
  const tx = (values: { es: string; en: string; pt: string }) => values[language];

  const value = useMemo(() => ({ language, setLanguage, t, tx }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};
