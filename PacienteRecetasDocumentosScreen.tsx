import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePortalAwareNavigation } from './navigation/usePortalAwareNavigation';
import { apiClient } from "./utils/api";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import PacienteSidebar from './components/PacienteSidebar';
import { usePacienteModule, PacienteModuleProvider } from './navigation/PacienteModuleContext';
import { useResponsive } from './hooks/useResponsive';

import { useLanguage } from './localization/LanguageContext';
import { usePatientPortalSession } from './hooks/usePatientPortalSession';
import type { RootStackParamList } from './navigation/types';
import { resolveRemoteImageSource } from './utils/imageSources';

const ViremLogo = require('./assets/imagenes/descarga.png');
const DefaultAvatar = require('./assets/imagenes/avatar-default.jpg');
const STORAGE_KEY = 'user';
const LEGACY_USER_STORAGE_KEY = 'userProfile';

function escapeHTML(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  light: '#B3CFE5',
  white: '#FFFFFF',
};

type User = {
  nombres?: string;
  apellidos?: string;
  nombre?: string;
  apellido?: string;
  firstName?: string;
  lastName?: string;
  plan?: string;
  fotoUrl?: string;
};

type DocumentItem = {
  title: string;
  doctor: string;
  date: string;
  icon: string;
  tint: string;
  bg: string;
  diagnostico?: string;
  medicamentos?: any[];
  instrucciones?: string;
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

const recetas: DocumentItem[] = [
  {
    title: 'Tratamiento Hipertensión',
    doctor: 'Dr. Alejandro García',
    date: 'Emitido el 15 Oct, 2023',
    icon: 'picture-as-pdf',
    tint: '#ef4444',
    bg: '#fef2f2',
  },
  {
    title: 'Receta_Gripe_Estacional',
    doctor: 'Dra. Marta Sánchez',
    date: 'Emitido el 12 Oct, 2023',
    icon: 'picture-as-pdf',
    tint: '#ef4444',
    bg: '#fef2f2',
  },
  {
    title: 'Antibióticos_Amoxicilina',
    doctor: 'Dr. Ricardo Ruiz',
    date: 'Emitido el 05 Sep, 2023',
    icon: 'picture-as-pdf',
    tint: '#ef4444',
    bg: '#fef2f2',
  },
];

const certificados: DocumentItem[] = [
  {
    title: 'Certificado de Aptitud Física',
    doctor: 'Dr. Ricardo Ruiz',
    date: 'Emitido el 01 Ago, 2023',
    icon: 'description',
    tint: '#1A3D63',
    bg: '#eef4fb',
  },
];

const sanitizeFileName = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-]/g, '');

const buildDocumentHTML = (item: DocumentItem) => {
  const medsHTML = (item.medicamentos || []).map((m, i) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHTML(m.nombre)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHTML(m.dosis)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHTML(m.frecuencia)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHTML(m.duracion)}</td>
    </tr>
  `).join('');

  return `
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', sans-serif; color: #333; line-height: 1.6; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #137fec; padding-bottom: 20px; margin-bottom: 30px; }
        .logo-text { color: #137fec; font-size: 24px; font-weight: bold; }
        .info-row { margin-bottom: 10px; }
        .label { font-weight: bold; color: #666; width: 120px; display: inline-block; }
        .section-title { background: #f4f8ff; padding: 8px 15px; font-weight: bold; color: #137fec; margin-top: 30px; border-left: 4px solid #137fec; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { text-align: left; background: #f9f9f9; padding: 10px; border-bottom: 2px solid #eee; color: #666; font-size: 13px; }
        .footer { margin-top: 50px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px; text-align: center; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo-text">VIREM</div>
          <div style="font-size: 12px; color: #666;">Salud Digital de Próxima Generación</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: bold;">RECETA MÉDICA</div>
          <div style="font-size: 12px; color: #666;">Folio: ${escapeHTML(Math.floor(Math.random() * 1000000))}</div>
        </div>
      </div>

      <div class="info-row"><span class="label">Paciente:</span> <span>${escapeHTML(item.title.includes('Receta') ? 'Paciente Registrado' : item.title)}</span></div>
      <div class="info-row"><span class="label">Médico:</span> <span>${escapeHTML(item.doctor)}</span></div>
      <div class="info-row"><span class="label">Fecha:</span> <span>${escapeHTML(item.date)}</span></div>

      <div class="section-title">DIAGNÓSTICO / EVALUACIÓN</div>
      <div style="padding: 15px;">${escapeHTML(item.diagnostico || 'Consulta general de seguimiento.')}</div>

      <div class="section-title">TRATAMIENTO Y MEDICAMENTOS</div>
      <table>
        <thead>
          <tr>
            <th>Medicamento</th>
            <th>Dosis</th>
            <th>Frecuencia</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          ${medsHTML || '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #999;">No se especificaron medicamentos en este registro.</td></tr>'}
        </tbody>
      </table>

      ${item.instrucciones ? `
        <div class="section-title">INSTRUCCIONES ADICIONALES</div>
        <div style="padding: 15px;">${escapeHTML(item.instrucciones)}</div>
      ` : ''}

      <div style="margin-top: 60px; display: flex; justify-content: flex-end;">
        <div style="text-align: center; width: 250px; border-top: 1px solid #333; padding-top: 10px;">
          <div style="font-weight: bold;">${escapeHTML(item.doctor)}</div>
          <div style="font-size: 12px; color: #666;">Firma Digital Autorizada</div>
        </div>
      </div>

      <div class="footer">
        Este documento es una receta médica digital válida emitida a través de la plataforma VIREM.<br>
        Verifique la autenticidad en app.virem.salud
      </div>
      
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 500);
        }
      </script>
    </body>
    </html>
  `;
};

const downloadExampleDocument = (item: DocumentItem) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const html = buildDocumentHTML(item);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    return;
  }

  // Fallback para mobile usando Share con texto formateado
  let shareText = `VIREM - RECETA MÉDICA\n\n`;
  shareText += `Médico: ${item.doctor}\n`;
  shareText += `Fecha: ${item.date}\n\n`;
  shareText += `DIAGNÓSTICO: ${item.diagnostico || 'N/A'}\n\n`;
  shareText += `TRATAMIENTO:\n`;
  (item.medicamentos || []).forEach(m => {
    shareText += `- ${m.nombre}: ${m.dosis} (${m.frecuencia} por ${m.duracion})\n`;
  });
  
  Share.share({
    title: item.title,
    message: shareText,
  });
};

const DocumentRow: React.FC<{ item: DocumentItem }> = ({ item }) => (
  <TouchableOpacity
    style={styles.docCard}
    activeOpacity={0.9}
    onPress={() => downloadExampleDocument(item)}
  >
    <View style={[styles.docIconWrap, { backgroundColor: item.bg }]}>
      <MaterialIcons name={item.icon} size={20} color={item.tint} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.docTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.docSub} numberOfLines={1}>
        {item.doctor}
      </Text>
      <Text style={styles.docMeta}>{item.date}</Text>
    </View>
    <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadExampleDocument(item)}>
      <MaterialIcons name="download" size={18} color={colors.blue} />
    </TouchableOpacity>
  </TouchableOpacity>
);

const SectionBlock: React.FC<{
  icon: string;
  title: string;
  count: string;
  items: DocumentItem[];
}> = ({ icon, title, count, items }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadLeft}>
        <View style={styles.sectionIcon}>
          <MaterialIcons name={icon} size={18} color={colors.blue} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
    <View style={styles.sectionGrid}>
      {items.map((item) => (
        <DocumentRow key={item.title} item={item} />
      ))}
    </View>
  </View>
);

const PacienteRecetasDocumentosScreen: React.FC = () => {

  const { t, tx } = useLanguage();
  const navigation = usePortalAwareNavigation();
  const { isInsidePortal, isSidebarOpen, toggleSidebar } = usePacienteModule();
  const { user, loadingUser, signOut, fullName, planLabel, fotoUrl, hasProfilePhoto } = usePatientPortalSession();

  const [loading, setLoading] = useState(true);
  const [dbRecetas, setDbRecetas] = useState<DocumentItem[]>([]);

  useEffect(() => {
    const fetchRecetas = async () => {
      try {
        const payload = await apiClient.get<any>("/api/paciente/me/recetas", { authenticated: true });
        if (payload?.success && Array.isArray(payload.recetas)) {
          const mapped = payload.recetas.map((r: any) => ({
            title: r.diagnostico || "Receta Médica",
            doctor: r.medico_nombre || "Médico",
            date: new Date(r.created_at).toLocaleDateString(),
            icon: "picture-as-pdf",
            tint: "#ef4444",
            bg: "#fef2f2",
            diagnostico: r.diagnostico,
            medicamentos: r.medicamentos_json,
            instrucciones: r.instrucciones
          }));
          setDbRecetas(mapped);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRecetas();
  }, []);


  const userAvatarSource: ImageSourcePropType = useMemo(() => {
    return resolveRemoteImageSource(fotoUrl, DefaultAvatar);
  }, [fotoUrl]);

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };


  const { isDesktop: isDesktopLayout } = useResponsive();


  return (
    <View style={[styles.container, !isInsidePortal && isDesktopLayout && { flexDirection: 'row' }]}>
      {!isInsidePortal && (
        <PacienteSidebar
          isMobileMenuOpen={isSidebarOpen}
          onToggleMobileMenu={toggleSidebar}
          onCloseMobileMenu={toggleSidebar}
        />
      )}
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={styles.header}>
            {!isSidebarOpen && (
              <TouchableOpacity 
                style={styles.hamburgerBtn} 
                onPress={toggleSidebar}
              >
                <MaterialIcons name="menu" size={26} color={colors.dark} />
              </TouchableOpacity>
            )}

            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color={colors.muted} />
              <TextInput
                placeholder="Buscar por nombre o fecha..."
                placeholderTextColor="#8aa7bf"
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() =>
                Alert.alert(
                  'Filtros',
                  'Puedes buscar por nombre o fecha usando la barra de busqueda.'
                )
              }
            >
              <MaterialIcons name="filter-list" size={16} color="#fff" />
              <Text style={styles.filterBtnText}>Filtrar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.pageTitle}>
            {tx({
              es: 'Mis Recetas y Documentos',
              en: 'My Prescriptions and Documents',
              pt: 'Minhas Receitas e Documentos',
            })}
          </Text>
          <Text style={styles.pageSubtitle}>
            Accede y descarga tu historial médico organizado por categorías.
          </Text>

          <SectionBlock icon="description" title="Recetas Médicas" count={(dbRecetas.length || 3) + " ARCHIVOS"} items={dbRecetas.length > 0 ? dbRecetas : recetas} />
          <SectionBlock
            icon="verified"
            title="Certificados y Otros"
            count="1 ARCHIVO"
            items={certificados}
          />

          <View style={styles.noticeCard}>
            <MaterialIcons name="info-outline" size={18} color={colors.blue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Nota sobre la privacidad</Text>
              <Text style={styles.noticeText}>
                Tus documentos médicos están encriptados y protegidos. Solo tú y tus médicos
                autorizados tienen acceso a esta información.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 2000,
  },
  drawerContent: {
    width: 280,
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 20,
  },
  sidebarContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
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
    marginRight: 10,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 30,
    paddingHorizontal: 5,
  },
  logo: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1,
  },
  logoSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    marginTop: -2,
    textTransform: 'uppercase',
  },
  userBox: {
    padding: 16,
    backgroundColor: '#f8fbff',
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eef4fb',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
    textAlign: 'center',
  },
  userPlan: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  menuScroll: {
    flex: 1,
    marginTop: 20,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: 'rgba(19,127,236,0.1)',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  menuTextActive: {
    color: colors.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '800',
  },

  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  main: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 24 : 14,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 14, 
    flexWrap: 'wrap' 
  },
  searchBox: {
    minWidth: Platform.OS === 'web' ? 300 : 0,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d7e6f3',
  },
  searchInput: { flex: 1, color: colors.dark, fontWeight: '600', fontSize: 12 },
  filterBtn: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  pageTitle: { color: colors.dark, fontSize: 28, fontWeight: '900' },
  pageSubtitle: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#e9f1fb', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  sectionCount: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  docCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce9f5',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: Platform.OS === 'web' ? 300 : 0,
    flex: 1,
  },
  docIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docTitle: { color: colors.dark, fontWeight: '800', fontSize: 14 },
  docSub: { color: colors.muted, fontWeight: '600', fontSize: 12, marginTop: 2 },
  docMeta: { color: colors.muted, fontWeight: '700', fontSize: 10, marginTop: 2 },
  downloadBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#edf4fb', alignItems: 'center', justifyContent: 'center' },
  noticeCard: { marginTop: 8, borderWidth: 1, borderColor: '#dce9f5', borderRadius: 12, backgroundColor: '#eef4fb', padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noticeTitle: { color: colors.dark, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  noticeText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});

const PacienteRecetasDocumentosScreenWrapper: React.FC = (props) => (
  <PacienteModuleProvider initialModule="PacienteRecetasDocumentos">
    <PacienteRecetasDocumentosScreen {...props} />
  </PacienteModuleProvider>
);

export default PacienteRecetasDocumentosScreenWrapper;
