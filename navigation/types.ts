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
  SeleccionPerfil: undefined;
  Login: undefined;

  RecuperarContrasena: undefined;
  VerificarIdentidad: { email: string };
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
  SalaEsperaVirtualPaciente:
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
  MedicoPerfil: undefined;
};
