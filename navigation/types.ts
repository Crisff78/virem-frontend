export type DatosPersonalesPaciente = {
  nombres: string;
  apellidos: string;
  fechanacimiento: string;
  genero: string;
  cedula: string;
  telefono: string;
};

export type DatosPersonalesMedico = {
  nombreCompleto: string;
  fechanacimiento: string;
  genero: string;
  especialidad: string;
  cedula: string;
  telefono: string;
  fotoUrl?: string;
  exequaturValidationToken?: string;
  draftKey?: string;
};

export type DoctorRouteSnapshot = {
  name: string;
  focus: string;
  exp: string;
  rating: string;
  reviews: string;
  city: string;
  price: string;
  tags: string[];
  fotoUrl?: string | null;
};

export type RootStackParamList = {
  Landing: undefined;
  Especialidades: undefined;
  EspecialidadDetalle: { 
    title: string; 
    description: string; 
    image: any; 
    icon: string; 
    detailedInfo?: string; 
    whenToGo?: string[]; 
    importance?: string; 
  };
  SeleccionPerfil: undefined;
  Login: { prefillEmail?: string } | undefined;

  RecuperarContrasena: undefined;
  VerificarIdentidad: { email: string };
  VerificarEmail: { email: string; roleId?: number; pendingRegistration?: boolean };
  EstablecerNuevaContrasena: { email: string };

  RegistroPaciente: undefined;
  RegistroMedico: undefined;

  RegistroCredenciales: {
    datosPersonales: DatosPersonalesPaciente | DatosPersonalesMedico;
  };

  RegistroCredencialesMedico: {
    datosPersonales: DatosPersonalesMedico;
  };

  Home: undefined;

  // ✅ NUEVA PANTALLA
  DashboardPaciente: undefined;
  PacienteCitas: undefined;
  PacienteAsistente: undefined;
  PacienteChat:
    | {
        doctorId?: string;
        doctorName?: string;
        doctorAvatarUrl?: string | null;
      }
    | undefined;
  PacienteNotificaciones: undefined;
  PacienteRecetasDocumentos: undefined;
  PacientePerfil: undefined;
  PacienteConfiguracion: undefined;
  PacienteCambiarContrasena: undefined;
  PacienteHistorialSesiones: undefined;
  NuevaConsultaPaciente: undefined;
  WaitingRoom:
    | {
        citaId?: string;
      }
    | undefined;
  EspecialistasPorEspecialidad: { specialty: string };
  PerfilEspecialistaAgendar: {
    specialty: string;
    doctorId: string;
    doctorSnapshot?: DoctorRouteSnapshot;
  };
  DashboardMedico: undefined;
  MedicoCitas: { highlightCitaId?: string } | undefined;
  MedicoPacientes: undefined;
  MedicoChat:
    | {
        patientId?: string;
        patientName?: string;
      }
    | undefined;
  MedicoPerfil: undefined;
  MedicoConfiguracion: undefined;
  MedicoHorarios: undefined;
  MedicoFinanzas: undefined;
  MedicoRecetas: { 
    prefill?: {
      pacienteId: string;
      pacienteNombre: string;
      citaId: string;
    }
  } | undefined;
  MedicoPacienteDetalle: {
    patientId: string;
    patientName: string;
  };
  AdminPanel: undefined;
  BlogDetail: {
    category: string;
    title: string;
    description: string;
    image: string;
  };

  /** Videollamada Zego basada en cita */
  VideoCall: {
    citaId: string;
    /** True si este lado es el que inicia (envia call:invite) */
    initiate?: boolean;
  };
  /** Pantalla "telefono sonando" cuando llega una invitacion entrante */
  IncomingCall: {
    citaId: string;
    callerName: string;
    callerRole: 'medico' | 'paciente';
  };
};
