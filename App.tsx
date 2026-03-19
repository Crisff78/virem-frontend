import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import React from "react";
import { Platform } from "react-native";

import EstablecerNuevaContrasenaScreen from "./EstablecerNuevaContrasenaScreen";
import LoginScreen from "./LoginScreen";
import RecuperarContrasenaScreen from "./RecuperarContrasenaScreen";
import RegistroCredencialesScreen from "./RegistroCredencialesScreen";
import RegistroCredencialesMedicoScreen from "./RegistroCredencialesMedicoScreen";
import RegistroMedicoScreen from "./RegistroMedicoScreen";
import RegistroPacienteScreen from "./RegistroPacienteScreen";
import SeleccionPerfil from "./SeleccionPerfil";
import VerificarIdentidadScreen from "./VerificarIdentidadScreen";

import DashboardPacienteScreen from "./DashboardPacienteScreen";
import DashboardMedico from "./DashboardMedico";
import MedicoCitasScreen from "./MedicoCitasScreen";
import MedicoPacientesScreen from "./MedicoPacientesScreen";
import MedicoChatScreen from "./MedicoChatScreen";
import NuevaConsultaPacienteScreen from "./NuevaConsultaPacienteScreen";
import SalaEsperaVirtualPacienteScreen from "./SalaEsperaVirtualPacienteScreen";
import EspecialistasPorEspecialidadScreen from "./EspecialistasPorEspecialidadScreen";
import PerfilEspecialistaAgendarScreen from "./PerfilEspecialistaAgendarScreen";
import PacienteRecetasDocumentosScreen from "./PacienteRecetasDocumentosScreen";
import PacientePerfilScreen from "./PacientePerfilScreen";
import MedicoPerfilScreen from "./MedicoPerfilScreen";
import PacienteNotificacionesScreen from "./PacienteNotificacionesScreen";
import PacienteConfiguracionScreen from "./PacienteConfiguracionScreen";
import PacienteCambiarContrasenaScreen from "./PacienteCambiarContrasenaScreen";
import PacienteHistorialSesionesScreen from "./PacienteHistorialSesionesScreen";
import PacienteChatScreen from "./PacienteChatScreen";
import PacienteCitasScreen from "./PacienteCitasScreen";
import { LanguageProvider } from "./localization/LanguageContext";

import { RootStackParamList } from "./navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const linkingPrefixes = [Linking.createURL("/")];
if (Platform.OS === "web" && typeof window !== "undefined") {
  linkingPrefixes.push(window.location.origin);
}

const linking = {
  prefixes: linkingPrefixes,
  config: {
    screens: {
      SeleccionPerfil: "",
      Login: "login",
      RecuperarContrasena: "recuperar-contrasena",
      VerificarIdentidad: "verificar-identidad/:email",
      EstablecerNuevaContrasena: "nueva-contrasena/:email",
      RegistroPaciente: "registro-paciente",
      RegistroMedico: "registro-medico",
      RegistroCredenciales: "registro-credenciales",
      RegistroCredencialesMedico: "registro-credenciales-medico",
      DashboardPaciente: "dashboard-paciente",
      PacienteCitas: "paciente-citas",
      PacienteChat: "paciente-chat",
      PacienteRecetasDocumentos: "paciente-recetas-documentos",
      PacientePerfil: "paciente-perfil",
      NuevaConsultaPaciente: "nueva-consulta",
      SalaEsperaVirtualPaciente: "sala-espera",
      EspecialistasPorEspecialidad: "especialistas/:specialty",
      PerfilEspecialistaAgendar: "perfil-especialista/:specialty/:doctorId",
      DashboardMedico: "dashboard-medico",
      MedicoCitas: "medico-citas",
      MedicoPacientes: "medico-pacientes",
      MedicoChat: "medico-chat",
      MedicoPerfil: "medico-perfil",
    },
  },
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          id="RootStack"
          initialRouteName="SeleccionPerfil"
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            animation: "none",
          }}
        >
          <Stack.Screen name="SeleccionPerfil" component={SeleccionPerfil} />
          <Stack.Screen name="Login" component={LoginScreen} />

        <Stack.Screen name="RegistroPaciente" component={RegistroPacienteScreen} />
        <Stack.Screen name="RegistroMedico" component={RegistroMedicoScreen} />

        <Stack.Screen name="RegistroCredenciales" component={RegistroCredencialesScreen} />
        <Stack.Screen name="RegistroCredencialesMedico" component={RegistroCredencialesMedicoScreen} />

        <Stack.Screen name="RecuperarContrasena" component={RecuperarContrasenaScreen} />
        <Stack.Screen name="VerificarIdentidad" component={VerificarIdentidadScreen} />
        <Stack.Screen
          name="EstablecerNuevaContrasena"
          component={EstablecerNuevaContrasenaScreen}
        />

        {/* ✅ Dashboard Paciente */}
        <Stack.Screen name="DashboardPaciente" component={DashboardPacienteScreen} />
        <Stack.Screen name="PacienteCitas" component={PacienteCitasScreen} />
        <Stack.Screen name="PacienteChat" component={PacienteChatScreen} />
        <Stack.Screen
          name="PacienteNotificaciones"
          component={PacienteNotificacionesScreen}
        />
        <Stack.Screen
          name="PacienteRecetasDocumentos"
          component={PacienteRecetasDocumentosScreen}
        />
        <Stack.Screen
          name="PacientePerfil"
          component={PacientePerfilScreen}
        />
        <Stack.Screen
          name="PacienteConfiguracion"
          component={PacienteConfiguracionScreen}
        />
        <Stack.Screen
          name="PacienteCambiarContrasena"
          component={PacienteCambiarContrasenaScreen}
        />
        <Stack.Screen
          name="PacienteHistorialSesiones"
          component={PacienteHistorialSesionesScreen}
        />
        <Stack.Screen
          name="NuevaConsultaPaciente"
          component={NuevaConsultaPacienteScreen}
        />
        <Stack.Screen
          name="SalaEsperaVirtualPaciente"
          component={SalaEsperaVirtualPacienteScreen}
        />
        <Stack.Screen
          name="EspecialistasPorEspecialidad"
          component={EspecialistasPorEspecialidadScreen}
        />
        <Stack.Screen
          name="PerfilEspecialistaAgendar"
          component={PerfilEspecialistaAgendarScreen}
        />
          <Stack.Screen name="DashboardMedico" component={DashboardMedico} />
          <Stack.Screen name="MedicoCitas" component={MedicoCitasScreen} />
          <Stack.Screen name="MedicoPacientes" component={MedicoPacientesScreen} />
          <Stack.Screen name="MedicoChat" component={MedicoChatScreen} />
          <Stack.Screen name="MedicoPerfil" component={MedicoPerfilScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </LanguageProvider>
  );
};

export default App;


