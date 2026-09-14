import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation/types';
import { apiClient } from './utils/api';
import { formatCedula, formatPhone } from './utils/formatters';

const colors = {
  primary: '#137fec',
  bg: '#F6FAFD',
  dark: '#0A1931',
  blue: '#1A3D63',
  muted: '#4A7FA7',
  light: '#B3CFE5',
  white: '#FFFFFF',
  success: '#16a34a',
  card: '#ffffff',
};

type PatientDetails = {
  pacienteid: number;
  nombres: string;
  apellidos: string;
  fechanacimiento: string;
  genero: string;
  cedula: string;
  telefono: string;
  fecharegistro: string;
  alergias?: string;
  medicamentos?: string;
  antecedentes?: string;
  tipo_sangre?: string;
  direccion?: string;
};

const MedicoPacienteDetalleScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'MedicoPacienteDetalle'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'MedicoPacienteDetalle'>>();
  const { patientId, patientName } = route.params || { patientId: '', patientName: 'Paciente' };

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientDetails | null>(null);

  const fetchPatientDetails = async () => {
    setLoading(true);
    try {
      const patientPayload = await apiClient.get<any>(`/api/pacientes/${patientId}`, {
        authenticated: true,
        query: { _t: Date.now() },
      });

      if (patientPayload?.success && patientPayload.paciente) {
        setPatient(patientPayload.paciente);
      }
    } catch (err) {
      console.error('Error fetching patient details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientDetails();
  }, [patientId]);

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return 'N/A';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} años`;
  };

  const displayName = patient ? `${patient.nombres} ${patient.apellidos}` : patientName;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Cargando detalles del paciente...</Text>
      </View>
    );
  }

  const MedicalInfoField = ({ label, value, icon }: { label: string; value?: string; icon: string }) => (
    <View style={styles.medicalInfoItem}>
      <View style={styles.medicalInfoHeader}>
        <MaterialIcons name={icon as any} size={18} color={colors.primary} />
        <Text style={styles.medicalInfoLabel}>{label}</Text>
      </View>
      <View style={styles.medicalInfoValueBox}>
        <Text style={[styles.medicalInfoValue, !value && { color: colors.muted, fontStyle: 'italic' }]}>
          {value || 'Sin información registrada'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.dark} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Detalles del Paciente</Text>
        </View>

        {/* Información Personal */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="person" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}>Información Personal</Text>
          </View>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Nombre Completo</Text>
              <Text style={styles.infoValue}>{displayName || 'N/A'}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Edad</Text>
              <Text style={styles.infoValue}>{calculateAge(patient?.fechanacimiento)}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Género</Text>
              <Text style={styles.infoValue}>{patient?.genero || 'N/A'}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Cédula</Text>
              <Text style={styles.infoValue}>{patient?.cedula ? formatCedula(patient.cedula) : 'N/A'}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Teléfono</Text>
              <Text style={styles.infoValue}>{patient?.telefono ? formatPhone(patient.telefono) : 'N/A'}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tipo de Sangre</Text>
              <Text style={[
                styles.infoValue, 
                patient?.tipo_sangre ? { color: colors.primary, fontWeight: '800' } : { color: colors.muted, fontWeight: '400' }
              ]}>
                {patient?.tipo_sangre || 'No especificado'}
              </Text>
            </View>
          </View>

          <View style={[styles.infoItem, { marginTop: 15, paddingHorizontal: 0, width: '100%' }]}>
            <Text style={styles.infoLabel}>Dirección</Text>
            <Text style={styles.infoValue}>{patient?.direccion || 'No especificada'}</Text>
          </View>
        </View>

        {/* Información Médica Relevante */}
        <View style={[styles.card, { marginTop: 20 }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="medical-services" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}>Información Médica Relevante</Text>
          </View>
          
          <MedicalInfoField 
            label="Alergias" 
            value={patient?.alergias} 
            icon="warning" 
          />
          <MedicalInfoField 
            label="Medicamentos actuales" 
            value={patient?.medicamentos} 
            icon="medication" 
          />
          <MedicalInfoField 
            label="Antecedentes médicos" 
            value={patient?.antecedentes} 
            icon="history" 
          />
        </View>

        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => navigation.navigate('MedicoRecetas', {
            prefill: { 
              pacienteId: patientId, 
              pacienteNombre: displayName,
              citaId: '' 
            } 
          })}
        >
          <MaterialIcons name="description" size={20} color={colors.white} />
          <Text style={styles.actionBtnText}>Crear Receta / Indicación</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  loaderText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 16,
  },
  main: {
    flex: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 10,
  },
  backBtn: {
    padding: 8,
    marginRight: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.dark,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4f8',
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    marginLeft: 10,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -10,
  },
  infoItem: {
    width: '50%',
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: colors.dark,
    fontWeight: '600',
  },
  medicalInfoItem: {
    marginBottom: 20,
  },
  medicalInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  medicalInfoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.blue,
    marginLeft: 8,
  },
  medicalInfoValueBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
  },
  medicalInfoValue: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginTop: 30,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
});

export default MedicoPacienteDetalleScreen;
