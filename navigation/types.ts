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
  DashboardPaciente: { initialSection?: 'home' | 'appointments' } | undefined;
  PacienteChat: undefined;
  PacienteNotificaciones: undefined;
  PacienteRecetasDocumentos: undefined;
  PacientePerfil: undefined;
  PacienteConfiguracion: undefined;
  PacienteCambiarContrasena: undefined;
  PacienteHistorialSesiones: undefined;
  NuevaConsultaPaciente: undefined;
  SalaEsperaVirtualPaciente: undefined;
  EspecialistasPorEspecialidad: { specialty: string };
  PerfilEspecialistaAgendar: { specialty: string; doctorId: string };
  DashboardMedico: undefined;
  MedicoPerfil: undefined;
};
