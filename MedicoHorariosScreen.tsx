import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useMedicoModule } from './navigation/MedicoModuleContext';
import { usePortalAwareMedicoNavigation } from './navigation/usePortalAwareMedicoNavigation';
import { useWindowDimensions } from 'react-native';
import { useMedicoPortalSession } from './hooks/useMedicoPortalSession';
import MedicoHeader from './components/MedicoHeader';
import FeedbackBanner, { type FeedbackState } from './components/FeedbackBanner';
import { apiClient } from './utils/api';

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  muted: '#4A7FA7',
  green: '#22c55e',
  red: '#ef4444',
  white: '#FFFFFF',
  border: '#eef2f7',
};

type Disponibilidad = {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  modalidad: string;
  slotMinutos: number;
  bloqueado: boolean;
};

const formatTime = (isoString: string) => {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit' }).format(d);
};

const formatDate = (isoString: string) => {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: '2-digit', month: 'short' }).format(d);
};

const MedicoHorariosScreen: React.FC = () => {
  const { isInsidePortal, isSidebarOpen, toggleSidebar } = useMedicoModule();
  const { doctorName } = useMedicoPortalSession({ syncOnMount: false, addDoctorPrefix: true });
  const navigation = usePortalAwareMedicoNavigation();
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;

  const [horarios, setHorarios] = useState<Disponibilidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'specific' | 'recurring'>('specific');
  
  // States for new specific availability
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [modalidad, setModalidad] = useState("ambas");
  const [slot, setSlot] = useState("30");
  const [guardando, setGuardando] = useState(false);

  // States for recurring pattern
  const [weeklyPattern, setWeeklyPattern] = useState<any[]>([
    { dayOfWeek: 1, active: true, start: "08:00", end: "12:00" },
    { dayOfWeek: 2, active: true, start: "08:00", end: "12:00" },
    { dayOfWeek: 3, active: true, start: "08:00", end: "12:00" },
    { dayOfWeek: 4, active: true, start: "08:00", end: "12:00" },
    { dayOfWeek: 5, active: true, start: "08:00", end: "12:00" },
    { dayOfWeek: 6, active: false, start: "08:00", end: "12:00" },
    { dayOfWeek: 0, active: false, start: "08:00", end: "12:00" },
  ]);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  // Auto-calculate horaFin based on horaInicio and slot duration
  useEffect(() => {
    if (horaInicio && slot && /^\d{2}:\d{2}$/.test(horaInicio)) {
      const duration = parseInt(slot, 10);
      if (!isNaN(duration) && duration > 0) {
        const [h, m] = horaInicio.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m + duration, 0, 0);
        const eh = String(date.getHours()).padStart(2, '0');
        const em = String(date.getMinutes()).padStart(2, '0');
        setHoraFin(`${eh}:${em}`);
      }
    }
  }, [horaInicio, slot]);

  const handleAgregar = async () => {
    setFeedback(null);
    if (!fecha || !horaInicio || !horaFin) {
      setFeedback({ kind: 'error', message: 'Debes ingresar fecha, hora de inicio y hora de fin.' });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setFeedback({ kind: 'error', message: 'Formato de fecha inválido. Usa YYYY-MM-DD (ej: 2026-05-07).' });
      return;
    }
    const padTime = (t: string) => {
      if (/^\d:\d{2}$/.test(t)) return "0" + t;
      return t;
    };
    const start = padTime(horaInicio);
    const end = padTime(horaFin);

    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      setFeedback({ kind: 'error', message: 'Formato de hora inválido. Usa HH:MM (ej: 08:00 o 8:00).' });
      return;
    }

    setGuardando(true);
    try {
      const bodyData = {
        fecha,
        horaInicio: start,
        horaFin: end,
        modalidad,
        slotMinutos: parseInt(slot, 10) || 30,
      };

      const payload = await apiClient.post<any>("/api/agenda/medico/me/disponibilidades", {
        authenticated: true,
        body: bodyData,
      });

      if (payload?.success) {
        setFeedback({ kind: 'success', message: 'Horario agregado correctamente.' });
        setShowForm(false);
        setFecha("");
        setHoraInicio("");
        setHoraFin("");
        fetchHorarios();
      } else {
        setFeedback({ kind: 'error', message: payload?.message || 'No se pudo agregar el horario.' });
      }
    } catch (e: any) {
      const serverError = e?.data?.error || '';
      const serverDetail = e?.data?.detail || '';
      const msg = e?.data?.message || e?.message || 'Error de conexión.';
      const fullMsg = [msg, serverError, serverDetail].filter(Boolean).join(' · ');
      setFeedback({ kind: 'error', message: fullMsg });
    } finally {
      setGuardando(false);
    }
  };

  const setQuickDate = (type: 'today' | 'tomorrow' | 'now') => {
    const d = new Date();
    if (type === 'tomorrow') d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setFecha(`${yyyy}-${mm}-${dd}`);

    if (type === 'now') {
      // Pre-fill hora inicio = ahora (redondeado al minuto), hora fin = +2 horas
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      setHoraInicio(`${hh}:${mi}`);
      const endH = new Date(d.getTime() + 2 * 60 * 60 * 1000);
      const ehh = String(endH.getHours()).padStart(2, '0');
      const emi = String(endH.getMinutes()).padStart(2, '0');
      setHoraFin(`${ehh}:${emi}`);
    }
  };

  const handleGenerarRecurrente = async () => {
    setFeedback(null);
    const activeDays = weeklyPattern.filter(p => p.active);

    if (activeDays.length === 0) {
      setFeedback({ kind: 'error', message: 'Debes seleccionar al menos un día activo.' });
      return;
    }

    try {
      setGenerating(true);

      // Save config first so it persists
      await apiClient.post("/api/agenda/medico/me/recurrente-config", {
        authenticated: true,
        body: {
          pattern: weeklyPattern, // Save full pattern (active/inactive)
          modalidad,
          slotMinutos: parseInt(slot, 10) || 30
        }
      });

      const payload = await apiClient.post<any>("/api/agenda/medico/me/disponibilidades/recurrente", {
        authenticated: true,
        body: {
          pattern: activeDays,
          modalidad,
          slotMinutos: parseInt(slot, 10) || 30,
          daysCount: 30
        }
      });

      if (payload?.success) {
        setFeedback({ kind: 'success', message: `Se han generado ${payload.createdCount} horarios para los próximos 30 días.` });
        setViewMode('specific');
        fetchHorarios();
      } else {
        setFeedback({ kind: 'error', message: payload?.message || 'No se pudo generar la agenda.' });
      }
    } catch (e: any) {
      setFeedback({ kind: 'error', message: e?.message || 'No se pudo conectar con el servidor.' });
    } finally {
      setGenerating(false);
    }
  };

  const toggleDay = (dayIndex: number) => {
    setWeeklyPattern(prev => prev.map(p => p.dayOfWeek === dayIndex ? { ...p, active: !p.active } : p));
  };

  const updateDayTime = (dayIndex: number, field: 'start' | 'end', value: string) => {
    setWeeklyPattern(prev => prev.map(p => p.dayOfWeek === dayIndex ? { ...p, [field]: value } : p));
  };

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const fetchRecurrenteConfig = async () => {
    try {
      const payload = await apiClient.get<any>("/api/agenda/medico/me/recurrente-config", { authenticated: true });
      if (payload?.success && payload.config) {
        if (payload.config.pattern && Array.isArray(payload.config.pattern)) {
          // Merge with current state to keep all 7 days visible
          setWeeklyPattern(prev => prev.map(p => {
            const dbDay = payload.config.pattern.find((d: any) => d.dayOfWeek === p.dayOfWeek);
            return dbDay ? { ...p, ...dbDay } : p;
          }));
        }
        if (payload.config.modalidad) setModalidad(payload.config.modalidad);
        if (payload.config.slotMinutos) setSlot(String(payload.config.slotMinutos));
      }
    } catch (e) {
      console.error("Error fetching recurrente config:", e);
    }
  };

  useEffect(() => {
    if (viewMode === 'recurring') {
      fetchRecurrenteConfig();
    }
  }, [viewMode]);

  const fetchHorarios = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const end = new Date();
      end.setDate(now.getDate() + 30);

      const payload = await apiClient.get<any>('/api/agenda/medico/me/disponibilidades', {
        authenticated: true,
        query: { from: now.toISOString(), to: end.toISOString() },
      });

      if (payload?.success && Array.isArray(payload.disponibilidades)) {
        setHorarios(payload.disponibilidades);
      } else {
        setHorarios([]);
      }
    } catch (error) {
      setFeedback({ kind: 'error', message: 'No se pudieron cargar los horarios.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHorarios();
  }, [fetchHorarios]);

  const handleBloquear = async (id: string, bloqueadoActual: boolean) => {
    try {
      const payload = await apiClient.patch<any>(`/api/agenda/medico/me/disponibilidades/${id}/bloquear`, {
        authenticated: true,
        body: { bloqueado: !bloqueadoActual },
      });
      if (payload?.success) {
        fetchHorarios();
        setFeedback({ kind: 'success', message: bloqueadoActual ? 'Horario desbloqueado.' : 'Horario bloqueado.' });
      } else {
        setFeedback({ kind: 'error', message: 'No se pudo actualizar el estado.' });
      }
    } catch (error) {
      setFeedback({ kind: 'error', message: 'Error de conexión.' });
    }
  };



  const renderContent = () => {
    if (viewMode === 'recurring') {
      return (
        <View style={styles.recurringContainer}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="auto-awesome" size={24} color={colors.primary} />
            <View>
              <Text style={styles.cardTitle}>Configuración Semanal Recurrente</Text>
              <Text style={styles.cardSubtitle}>Define tu horario estándar para generar los próximos 30 días automáticamente.</Text>
            </View>
          </View>

          <View style={styles.patternGrid}>
            {weeklyPattern.map((day) => (
              <View key={day.dayOfWeek} style={[styles.dayRow, !day.active && styles.dayRowInactive]}>
                <TouchableOpacity style={styles.daySelect} onPress={() => toggleDay(day.dayOfWeek)}>
                  <MaterialIcons 
                    name={day.active ? "check-circle" : "radio-button-unchecked"} 
                    size={24} 
                    color={day.active ? colors.primary : colors.muted} 
                  />
                  <Text style={[styles.dayName, day.active && styles.dayNameActive]}>{dayNames[day.dayOfWeek]}</Text>
                </TouchableOpacity>

                {day.active && (
                  <View style={styles.dayTimes}>
                    <TextInput 
                      style={styles.timeInput} 
                      value={day.start} 
                      onChangeText={(v) => updateDayTime(day.dayOfWeek, 'start', v)} 
                      placeholder="08:00"
                    />
                    <Text style={styles.timeSep}>-</Text>
                    <TextInput 
                      style={styles.timeInput} 
                      value={day.end} 
                      onChangeText={(v) => updateDayTime(day.dayOfWeek, 'end', v)} 
                      placeholder="17:00"
                    />
                  </View>
                )}
                {!day.active && (
                  <Text style={styles.inactiveText}>No laborable</Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.configFooter}>
            <View style={styles.configInputGroup}>
              <Text style={styles.configLabel}>Modalidad</Text>
              <View style={styles.miniSegmented}>
                {['virtual', 'presencial', 'ambas'].map(m => (
                  <TouchableOpacity 
                    key={m} 
                    style={[styles.miniSegBtn, modalidad === m && styles.miniSegBtnActive]}
                    onPress={() => setModalidad(m)}
                  >
                    <Text style={[styles.miniSegText, modalidad === m && styles.miniSegTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerarRecurrente} disabled={generating}>
              {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Generar Agenda (30 días)</Text>}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <>
        {showForm && (
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.sectionTitle}>Nueva Disponibilidad</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <MaterialIcons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Fecha</Text>
                <View style={styles.quickSelectRow}>
                  <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#dcfce7' }]} onPress={() => setQuickDate('now')}>
                    <Text style={[styles.quickBtnText, { color: '#16a34a' }]}>⚡ Ahora</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setQuickDate('today')}>
                    <Text style={styles.quickBtnText}>Hoy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setQuickDate('tomorrow')}>
                    <Text style={styles.quickBtnText}>Mañana</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput 
                style={styles.input} 
                value={fecha} 
                onChangeText={setFecha} 
                placeholder="YYYY-MM-DD" 
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Inicio (HH:MM)</Text>
                <TextInput 
                  style={styles.input} 
                  value={horaInicio} 
                  onChangeText={setHoraInicio} 
                  placeholder="Ej: 08:30" 
                  keyboardType="numbers-and-punctuation"
                />
                <View style={styles.timePresets}>
                  {['07:00', '08:00', '09:00', '14:00'].map(t => (
                    <TouchableOpacity key={t} style={styles.miniBtn} onPress={() => setHoraInicio(t)}>
                      <Text style={styles.miniBtnText}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Fin (Auto-calc)</Text>
                <TextInput 
                  style={styles.input} 
                  value={horaFin} 
                  onChangeText={setHoraFin} 
                  placeholder="Ej: 09:00" 
                  keyboardType="numbers-and-punctuation"
                />
                <View style={styles.timePresets}>
                  {['12:00', '13:00', '17:00', '23:59'].map(t => (
                    <TouchableOpacity key={t} style={styles.miniBtn} onPress={() => setHoraFin(t)}>
                      <Text style={styles.miniBtnText}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Modalidad de atención</Text>
              <View style={styles.segmentedControl}>
                {['virtual', 'presencial', 'ambas'].map((m) => (
                  <TouchableOpacity 
                    key={m}
                    style={[styles.segmentBtn, modalidad === m && styles.segmentBtnActive]}
                    onPress={() => setModalidad(m)}
                  >
                    <Text style={[styles.segmentText, modalidad === m && styles.segmentTextActive]}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Duración de cada cita (minutos)</Text>
              <View style={styles.chipsRow}>
                {['15', '20', '30', '45', '60'].map((s) => (
                  <TouchableOpacity 
                    key={s}
                    style={[styles.chip, slot === s && styles.chipActive]}
                    onPress={() => setSlot(s)}
                  >
                    <Text style={[styles.chipText, slot === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
                <TextInput 
                  style={[styles.chipInput, !['15','20','30','45','60'].includes(slot) && styles.chipActive]} 
                  value={['15','20','30','45','60'].includes(slot) ? "" : slot}
                  onChangeText={setSlot}
                  placeholder="Otro"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAgregar} disabled={guardando}>
              {guardando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Confirmar Horario</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ padding: 40 }} />
          ) : horarios.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="event-busy" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>No tienes horarios configurados</Text>
              <Text style={styles.emptySub}>Los pacientes no podrán agendar citas contigo hasta que agregues disponibilidad.</Text>
            </View>
          ) : (
            horarios.map((h) => (
              <View key={h.id} style={[styles.row, h.bloqueado && styles.rowBlocked]}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: h.bloqueado ? '#fee2e2' : '#dcfce7' }]}>
                    <MaterialIcons name={h.bloqueado ? 'lock' : 'event-available'} size={24} color={h.bloqueado ? colors.red : colors.green} />
                  </View>
                  <View>
                    <Text style={[styles.dateText, h.bloqueado && { color: colors.muted }]}>
                      {formatDate(h.fechaInicio)}
                    </Text>
                    <Text style={styles.timeText}>
                      {formatTime(h.fechaInicio)} - {formatTime(h.fechaFin)}
                    </Text>
                    <View style={styles.badgesRow}>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{h.modalidad}</Text>
                      </View>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{h.slotMinutos} min</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.toggleBtn, h.bloqueado ? styles.toggleBtnUnblock : styles.toggleBtnBlock]}
                  onPress={() => handleBloquear(h.id, h.bloqueado)}
                >
                  <Text style={[styles.toggleBtnText, h.bloqueado && { color: colors.primary }]}>
                    {h.bloqueado ? 'Desbloquear' : 'Bloquear'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
        <MedicoHeader title="Mis Horarios" />
      </View>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 20 }]}>

        <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Disponibilidad</Text>
            <Text style={styles.subtitle}>Gestiona tus horarios de atención</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.viewToggleBtn, viewMode === 'recurring' && styles.viewToggleBtnActive]} 
              onPress={() => setViewMode(viewMode === 'specific' ? 'recurring' : 'specific')}
            >
              <MaterialIcons name={viewMode === 'recurring' ? "event" : "update"} size={20} color={viewMode === 'recurring' ? "#fff" : colors.primary} />
              <Text style={[styles.viewToggleBtnText, viewMode === 'recurring' && styles.viewToggleBtnTextActive]}>
                {viewMode === 'recurring' ? "Ver Listado" : "Horario Semanal"}
              </Text>
            </TouchableOpacity>

            {viewMode === 'specific' && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
                <MaterialIcons name={showForm ? "close" : "add"} size={20} color="#fff" />
                <Text style={styles.addBtnText}>{showForm ? "Cerrar" : "Nuevo"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {renderContent()}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: 24, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 },
  title: { fontSize: 28, fontWeight: '900', color: colors.dark },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, fontWeight: '600' },
  
  headerButtons: { flexDirection: 'row', gap: 10 },
  viewToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.primary },
  viewToggleBtnActive: { backgroundColor: colors.primary },
  viewToggleBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  viewToggleBtnTextActive: { color: '#fff' },
  
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  recurringContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 24, alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '900', color: colors.dark },
  cardSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  
  patternGrid: { gap: 12, marginBottom: 24 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  dayRowInactive: { opacity: 0.6 },
  daySelect: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dayName: { fontSize: 15, fontWeight: '700', color: colors.muted },
  dayNameActive: { color: colors.dark },
  dayTimes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 70, textAlign: 'center', fontSize: 14, fontWeight: '600', color: colors.dark },
  timeSep: { color: colors.muted, fontWeight: '700' },
  inactiveText: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  
  configFooter: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20, gap: 20 },
  configInputGroup: { gap: 10 },
  configLabel: { fontSize: 14, fontWeight: '700', color: colors.dark },
  miniSegmented: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 10, alignSelf: 'flex-start' },
  miniSegBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  miniSegBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  miniSegText: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'capitalize' },
  miniSegTextActive: { color: colors.primary },
  
  generateBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  generateBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  formContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.dark },
  inputGroup: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  quickSelectRow: { flexDirection: 'row', gap: 8 },
  quickBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  quickBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  
  rowInputs: { flexDirection: 'row', gap: 14 },
  timePresets: { flexDirection: 'row', gap: 6, marginTop: 6 },
  miniBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  miniBtnText: { fontSize: 10, fontWeight: '600', color: colors.muted },

  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.dark, fontWeight: '600', fontSize: 15 },
  
  segmentedControl: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segmentBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  segmentTextActive: { color: colors.primary, fontWeight: '800' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: 'rgba(19,127,236,0.1)', borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextActive: { color: colors.primary },
  chipInput: { width: 60, height: 38, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 8, textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.dark },

  submitBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  listContainer: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  
  emptyBox: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.dark, fontSize: 16, fontWeight: '800', marginTop: 12 },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 300 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap', gap: 14 },
  rowBlocked: { backgroundColor: '#f8fafc', opacity: 0.8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 15, fontWeight: '800', color: colors.dark, textTransform: 'capitalize' },
  timeText: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 2 },
  
  badgesRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  badge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },

  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  toggleBtnBlock: { backgroundColor: '#fff', borderColor: colors.border },
  toggleBtnUnblock: { backgroundColor: 'rgba(19,127,236,0.1)', borderColor: 'rgba(19,127,236,0.2)' },
  toggleBtnText: { fontWeight: '700', fontSize: 13, color: colors.dark },
});

export default MedicoHorariosScreen;
