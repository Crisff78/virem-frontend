import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Share } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useMedicoModule } from './navigation/MedicoModuleContext';
import { usePortalAwareMedicoNavigation } from './navigation/usePortalAwareMedicoNavigation';
import { useWindowDimensions } from 'react-native';
import { useMedicoPortalSession } from './hooks/useMedicoPortalSession';
import MedicoHeader from './components/MedicoHeader';
import { apiClient } from './utils/api';

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
  muted: '#4A7FA7',
  green: '#22c55e',
  red: '#ef4444',
  white: '#FFFFFF',
  border: '#eef2f7',
  light: '#B3CFE5',
};

type Receta = {
  recetaid: string;
  paciente_nombre: string;
  diagnostico: string;
  created_at: string;
  medicamentos_json?: any;
  instrucciones?: string;
};

const MedicoRecetasScreen: React.FC = () => {
  const { isInsidePortal, isSidebarOpen, toggleSidebar, activeModuleParams } = useMedicoModule();
  const { doctorName, doctorSpec } = useMedicoPortalSession({ syncOnMount: false, addDoctorPrefix: true });
  const navigation = usePortalAwareMedicoNavigation();
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && viewportWidth >= 1024;

  const [loading, setLoading] = useState(true);
  const [recetas, setRecetas] = useState<Receta[]>([]);

  // Simple form state
  const [showForm, setShowForm] = useState(false);
  const [pacienteSearch, setPacienteSearch] = useState('');
  const [pacienteId, setPacienteId] = useState('');
  const [pacienteNombre, setPacienteNombre] = useState('');
  const [citaId, setCitaId] = useState('00000000-0000-0000-0000-000000000000');
  const [diagnostico, setDiagnostico] = useState('');
  
  // Advanced state
  const [peso, setPeso] = useState('');
  const [presion, setPresion] = useState('');
  const [temperatura, setTemperatura] = useState('');
  const [medicamentosList, setMedicamentosList] = useState<{ nombre: string; dosis: string; frecuencia: string; duracion: string }[]>([]);
  const [currentMed, setCurrentMed] = useState({ nombre: '', dosis: '', frecuencia: '', duracion: '' });
  const [instrucciones, setInstrucciones] = useState('');
  const [laboratorios, setLaboratorios] = useState('');
  const [firma, setFirma] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Handle prefill from navigation
  useEffect(() => {
    if (activeModuleParams?.prefill) {
      const { pacienteId: pId, pacienteNombre: pName, citaId: cId } = activeModuleParams.prefill;
      setPacienteId(pId);
      setPacienteNombre(pName);
      setPacienteSearch(pName);
      setCitaId(cId);
      setShowForm(true);
    }
  }, [activeModuleParams]);

  const fetchRecetas = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiClient.get<any>('/api/medico/me/recetas', {
        authenticated: true,
      });

      if (payload?.success && Array.isArray(payload.recetas)) {
        setRecetas(payload.recetas);
      } else {
        setRecetas([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecetas();
  }, [fetchRecetas]);
  const addMedicamento = () => {
    const { nombre, dosis, frecuencia, duracion } = currentMed;
    const newErrors: Record<string, string> = {};

    if (!nombre) newErrors.medNombre = 'El nombre es obligatorio';
    if (!dosis) newErrors.medDosis = 'La dosis es obligatoria';

    // Validaciones estrictas
    const lettersOnlyRegex = /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g;
    if (nombre && (nombre.match(/[0-9]/) || lettersOnlyRegex.test(nombre))) {
      newErrors.medNombre = 'Solo se permiten letras';
    }

    if (frecuencia.trim() === '/') {
      newErrors.medFrecuencia = 'No puede ser solo "/"';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(prev => ({ ...prev, ...newErrors }));
      return;
    }

    setMedicamentosList([...medicamentosList, currentMed]);
    setCurrentMed({ nombre: '', dosis: '', frecuencia: '', duracion: '' });
    setFieldErrors(prev => {
      const rest = { ...prev };
      delete rest.medNombre;
      delete rest.medDosis;
      delete rest.medFrecuencia;
      delete rest.medDuracion;
      return rest;
    });
  };

  const removeMedicamento = (index: number) => {
    setMedicamentosList(medicamentosList.filter((_, i) => i !== index));
  };

  const handleEmitir = async () => {
    setShowErrors(true);
    
    // Validamos estrictamente los campos requeridos
    const hasPaciente = !!pacienteId || !!pacienteSearch;
    const hasDiagnostico = !!diagnostico;
    const hasMedicamentos = medicamentosList.length > 0;

    console.log('[handleEmitir] Intento de emisión:', { hasPaciente, hasDiagnostico, hasMedicamentos });

    if (!hasPaciente || !hasDiagnostico || !hasMedicamentos) {
      const missingFields = [];
      if (!hasPaciente) missingFields.push('Paciente (Nombre o Cédula)');
      if (!hasDiagnostico) missingFields.push('Diagnóstico');
      if (!hasMedicamentos) missingFields.push('Medicamentos (Debe añadir al menos uno a la lista con el botón "+")');
      
      Alert.alert('Datos Incompletos', `Por favor complete los campos marcados en rojo:\n\n- ${missingFields.join('\n- ')}`);
      return;
    }

    const alphaNumRegex = /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g;
    const lettersOnlyRegex = /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g;
    const numbersOnlyRegex = /[^0-9]/g;
    const numericSlashRegex = /[^0-9/]/g;
    const alphaNumSlashRegex = /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ/\s]/g;

    const newErrors: Record<string, string> = {};

    // Validación extra para evitar que se guarde solo un slash
    if (presion.trim() === '/') {
      newErrors.presion = 'No puede ser solo "/"';
    }
    
    if (peso.trim() === '/') {
      newErrors.peso = 'No puede ser solo "/"';
    }

    if (temperatura.trim() === '/') {
      newErrors.temperatura = 'No puede ser solo "/"';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(prev => ({ ...prev, ...newErrors }));
      Alert.alert('Error de formato', 'Revise los campos marcados en rojo.');
      return;
    }

    setLoading(true); 
    try {
      const cleanPeso = peso.replace(alphaNumRegex, '').trim();
      const cleanPresion = presion.replace(numericSlashRegex, '').trim();
      const cleanTemperatura = temperatura.replace(numbersOnlyRegex, '').trim();
      const cleanDiagnostico = diagnostico.replace(alphaNumRegex, '').trim();
      const cleanFirma = (firma || 'Firma Digital').replace(lettersOnlyRegex, '').trim();

      const payload = await apiClient.post<any>('/api/medico/me/recetas', {
        authenticated: true,
        body: {
          pacienteid: pacienteId ? parseInt(pacienteId, 10) : undefined,
          paciente_search: !pacienteId ? pacienteSearch : undefined,
          citaid: citaId,
          diagnostico: cleanDiagnostico,
          signos_vitales: { 
            peso: cleanPeso, 
            presion: cleanPresion, 
            temperatura: cleanTemperatura 
          },
          medicamentos: medicamentosList.map(m => ({
            nombre: m.nombre.replace(lettersOnlyRegex, '').trim(),
            dosis: m.dosis.replace(alphaNumRegex, '').trim(),
            frecuencia: m.frecuencia.replace(alphaNumSlashRegex, '').trim(),
            duracion: m.duracion.replace(alphaNumRegex, '').trim()
          })),
          instrucciones: instrucciones.trim(),
          ordenes_laboratorio: laboratorios.trim(),
          doctor_info: {
            nombre: doctorName,
            especialidad: doctorSpec,
            firma: cleanFirma
          },
          disponible_paciente: true
        },
      });

      console.log('[handleEmitir] Respuesta del servidor:', payload);

      if (payload?.success) {
        Alert.alert('Éxito', 'Receta emitida y enviada al paciente correctamente');
        setShowForm(false);
        setPacienteId('');
        setPacienteSearch('');
        setPacienteNombre('');
        setDiagnostico('');
        setMedicamentosList([]);
        setInstrucciones('');
        setLaboratorios('');
        setPeso('');
        setPresion('');
        setTemperatura('');
        setFirma('');
        fetchRecetas();
      } else {
        console.warn('[handleEmitir] Error en payload:', payload);
        Alert.alert('Error', payload?.message || 'No se pudo emitir la receta.');
      }
    } catch (error: any) {
      console.error('[handleEmitir] Error de red/servidor:', error);
      Alert.alert('Error', error?.message || 'Error de conexión al emitir receta.');
    } finally {
      setLoading(false);
    }
  };

  const buildDocumentHTML = (r: Receta) => {
    const meds = Array.isArray(r.medicamentos_json) ? r.medicamentos_json : [];
    const medsHTML = meds.map((m: any) => `
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
          @media print { body { padding: 0; } }
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
            <div style="font-size: 12px; color: #666;">Folio: ${escapeHTML(r.recetaid.split('-')[0].toUpperCase())}</div>
          </div>
        </div>

        <div class="info-row"><span class="label">Paciente:</span> <span>${escapeHTML(r.paciente_nombre)}</span></div>
        <div class="info-row"><span class="label">Médico:</span> <span>${escapeHTML(doctorName)}</span></div>
        <div class="info-row"><span class="label">Fecha:</span> <span>${escapeHTML(new Date(r.created_at).toLocaleDateString())}</span></div>

        <div class="section-title">DIAGNÓSTICO / EVALUACIÓN</div>
        <div style="padding: 15px;">${escapeHTML(r.diagnostico)}</div>

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
            ${medsHTML || '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #999;">No hay medicamentos registrados.</td></tr>'}
          </tbody>
        </table>

        ${r.instrucciones ? `
          <div class="section-title">INSTRUCCIONES ADICIONALES</div>
          <div style="padding: 15px;">${escapeHTML(r.instrucciones)}</div>
        ` : ''}

        <div style="margin-top: 60px; display: flex; justify-content: flex-end;">
          <div style="text-align: center; width: 250px; border-top: 1px solid #333; padding-top: 10px;">
            <div style="font-weight: bold;">${escapeHTML(doctorName)}</div>
            <div style="font-size: 12px; color: #666;">Firma Digital Autorizada</div>
          </div>
        </div>

        <div class="footer">
          Documento digital VIREM - Validado por ${escapeHTML(doctorSpec)}
        </div>
        
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 500); }
        </script>
      </body>
      </html>
    `;
  };

  const handleDownload = (receta: Receta) => {
    if (Platform.OS === 'web') {
      const html = buildDocumentHTML(receta);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
      return;
    }

    // Mobile fallback
    let msg = `RECETA VIREM\nPaciente: ${receta.paciente_nombre}\nDiagnóstico: ${receta.diagnostico}\n\n`;
    (Array.isArray(receta.medicamentos_json) ? receta.medicamentos_json : []).forEach((m:any) => {
      msg += `- ${m.nombre}: ${m.dosis}\n`;
    });

    Share.share({ title: 'Receta Médica', message: msg });
  };

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
        <MedicoHeader title="Recetas y Órdenes" />
      </View>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 20 }]}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Recetas Médicas</Text>
            <Text style={styles.subtitle}>Emite recetas y órdenes para tus pacientes</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
            <MaterialIcons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
            <Text style={styles.addBtnText}>{showForm ? 'Cancelar' : 'Nueva Receta'}</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={styles.formContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Emitir Nueva Receta</Text>
            </View>
            
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Información del Paciente</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Paciente (Nombre o Cédula)</Text>
                <TextInput 
                  style={[
                    styles.input, 
                    pacienteNombre ? { backgroundColor: '#f1f5f9', color: '#64748b' } : null,
                    (showErrors && !pacienteId && !pacienteSearch) && { borderColor: '#ef4444', borderWidth: 1.5 }
                  ]} 
                  value={pacienteNombre || pacienteSearch} 
                  editable={!pacienteNombre}
                  onChangeText={setPacienteSearch} 
                  placeholder="Escriba el nombre o cédula del paciente..." 
                />
              </View>
              
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Peso (lb/kg)</Text>
                  <TextInput 
                    style={[styles.input, fieldErrors.peso && { borderColor: '#ef4444' }]} 
                    value={peso} 
                    onChangeText={(t) => {
                      setPeso(t.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, ''));
                      setFieldErrors(prev => ({ ...prev, peso: '' }));
                    }} 
                    placeholder="Ej. 165 lb" 
                  />
                  {fieldErrors.peso && <Text style={styles.errorText}>{fieldErrors.peso}</Text>}
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Presión Art.</Text>
                  <TextInput 
                    style={[styles.input, fieldErrors.presion && { borderColor: '#ef4444' }]} 
                    value={presion} 
                    onChangeText={(t) => {
                      const filtered = t.replace(/[^0-9/]/g, '');
                      const parts = filtered.split('/');
                      const clean = parts.length > 2 ? parts[0] + '/' + parts[1] : filtered;
                      setPresion(clean);
                      setFieldErrors(prev => ({ ...prev, presion: '' }));
                    }} 
                    placeholder="Ej. 120/80" 
                  />
                  {fieldErrors.presion && <Text style={styles.errorText}>{fieldErrors.presion}</Text>}
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Temp. (°C)</Text>
                  <TextInput 
                    style={[styles.input, fieldErrors.temperatura && { borderColor: '#ef4444' }]} 
                    value={temperatura} 
                    onChangeText={(t) => {
                      setTemperatura(t.replace(/[^0-9]/g, ''));
                      setFieldErrors(prev => ({ ...prev, temperatura: '' }));
                    }} 
                    placeholder="Ej. 37" 
                  />
                  {fieldErrors.temperatura && <Text style={styles.errorText}>{fieldErrors.temperatura}</Text>}
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Evaluación Médica</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Diagnóstico y Hallazgos</Text>
                <TextInput 
                  style={[
                    styles.input, 
                    { height: 80, textAlignVertical: 'top' },
                    (showErrors && !diagnostico) && { borderColor: '#ef4444', borderWidth: 1.5 }
                  ]} 
                  value={diagnostico} 
                  onChangeText={(t) => setDiagnostico(t.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, ''))} 
                  placeholder="Describa el diagnóstico principal y hallazgos relevantes..." 
                  multiline
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Tratamiento Farmacológico</Text>
              
              {medicamentosList.length > 0 && (
                <View style={styles.medsList}>
                  {medicamentosList.map((m, idx) => (
                    <View key={idx} style={styles.medItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medName}>{m.nombre} - <Text style={{ fontWeight: '500' }}>{m.dosis}</Text></Text>
                        <Text style={styles.medFreq}>{m.frecuencia} · {m.duracion}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeMedicamento(idx)}>
                        <MaterialIcons name="delete-outline" size={22} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={[styles.medForm, (showErrors && medicamentosList.length === 0) && { borderColor: '#ef4444', borderWidth: 1.5 }]}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Medicamento</Text>
                  <TextInput 
                    style={[styles.input, fieldErrors.medNombre && { borderColor: '#ef4444' }]} 
                    value={currentMed.nombre} 
                    onChangeText={(t) => {
                      setCurrentMed({...currentMed, nombre: t.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')});
                      setFieldErrors(prev => ({ ...prev, medNombre: '' }));
                    }} 
                    placeholder="Ej. Amoxicilina" 
                  />
                  {fieldErrors.medNombre && <Text style={styles.errorText}>{fieldErrors.medNombre}</Text>}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Dosis</Text>
                    <TextInput 
                      style={[styles.input, fieldErrors.medDosis && { borderColor: '#ef4444' }]} 
                      value={currentMed.dosis} 
                      onChangeText={(t) => {
                        setCurrentMed({...currentMed, dosis: t.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '')});
                        setFieldErrors(prev => ({ ...prev, medDosis: '' }));
                      }} 
                      placeholder="Ej. 1 caps" 
                    />
                    {fieldErrors.medDosis && <Text style={styles.errorText}>{fieldErrors.medDosis}</Text>}
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Frecuencia</Text>
                    <TextInput 
                      style={[styles.input, fieldErrors.medFrecuencia && { borderColor: '#ef4444' }]} 
                      value={currentMed.frecuencia} 
                      onChangeText={(t) => {
                        const filtered = t.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ/\s]/g, '');
                        const parts = filtered.split('/');
                        setCurrentMed({
                          ...currentMed, 
                          frecuencia: parts.length > 2 ? parts[0] + '/' + parts[1] : filtered
                        });
                        setFieldErrors(prev => ({ ...prev, medFrecuencia: '' }));
                      }} 
                      placeholder="Ej. C/8h" 
                    />
                    {fieldErrors.medFrecuencia && <Text style={styles.errorText}>{fieldErrors.medFrecuencia}</Text>}
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Duración</Text>
                    <TextInput 
                      style={[styles.input, fieldErrors.medDuracion && { borderColor: '#ef4444' }]} 
                      value={currentMed.duracion} 
                      onChangeText={(t) => {
                        setCurrentMed({...currentMed, duracion: t.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '')});
                        setFieldErrors(prev => ({ ...prev, medDuracion: '' }));
                      }} 
                      placeholder="Ej. 7 dias" 
                    />
                    {fieldErrors.medDuracion && <Text style={styles.errorText}>{fieldErrors.medDuracion}</Text>}
                  </View>
                </View>
                <TouchableOpacity style={styles.addMedBtn} onPress={addMedicamento}>
                  <MaterialIcons name="add" size={18} color={colors.primary} />
                  <Text style={styles.addMedBtnText}>Añadir a la lista</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Información del Médico y Firma</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Médico Responsable</Text>
                  <View style={[styles.input, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={{ color: '#64748b', fontWeight: '700' }}>{doctorName}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Especialidad</Text>
                  <View style={[styles.input, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={{ color: '#64748b', fontWeight: '700' }}>{doctorSpec}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Firma del Médico</Text>
                <TextInput 
                  style={[styles.input, { height: 60, fontStyle: firma ? 'normal' : 'italic' }]} 
                  value={firma} 
                  onChangeText={(t) => setFirma(t.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''))} 
                  placeholder="Escriba su firma aquí..." 
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
              onPress={handleEmitir}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="send" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Emitir y Enviar al Paciente</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Historial de Recetas Emitidas</Text>
          
          <View style={styles.listContainer}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ padding: 40 }} />
            ) : recetas.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="description" size={40} color={colors.muted} />
                <Text style={styles.emptyText}>No has emitido recetas</Text>
              </View>
            ) : (
              recetas.map((r) => (
                <TouchableOpacity 
                  key={r.recetaid} 
                  style={styles.transactionRow}
                  onPress={() => handleDownload(r)}
                >
                  <View style={styles.tLeft}>
                    <View style={styles.tIcon}>
                      <MaterialIcons name="picture-as-pdf" size={20} color={colors.red} />
                    </View>
                    <View>
                      <Text style={styles.tTitle}>{r.paciente_nombre}</Text>
                      <Text style={styles.tDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.tAmount} numberOfLines={1}>{r.diagnostico}</Text>
                    <MaterialIcons name="download" size={16} color={colors.primary} style={{ marginTop: 4 }} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

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
  
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  formContainer: { backgroundColor: '#fff', padding: 24, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  formSection: { marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  formSectionTitle: { fontSize: 15, fontWeight: '800', color: colors.primary, marginBottom: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: colors.dark, marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.dark, fontWeight: '600', fontSize: 14 },
  
  medsList: { marginBottom: 16, gap: 10 },
  medItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd' },
  medName: { fontSize: 14, fontWeight: '800', color: colors.dark },
  medFreq: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 2 },
  
  medForm: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.light },
  addMedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: 8 },
  addMedBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },

  submitBtn: { backgroundColor: colors.green, padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  historySection: { marginTop: 10 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: colors.dark, marginBottom: 16 },
  listContainer: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  
  emptyBox: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.dark, fontSize: 16, fontWeight: '800', marginTop: 12 },
  errorText: { color: '#ef4444', fontSize: 11, fontWeight: '700', marginTop: 4 },

  transactionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  tLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  tTitle: { color: colors.dark, fontWeight: '800', fontSize: 14 },
  tDate: { color: colors.muted, fontWeight: '600', fontSize: 12, marginTop: 2 },
  tAmount: { fontWeight: '700', fontSize: 13, color: colors.muted, maxWidth: 150 },
});

export default MedicoRecetasScreen;
