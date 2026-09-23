import React, { useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "../../providers/ThemeContext";
import { PatientAssistantView } from "../../PacienteAsistenteScreen";
import { AssistantButton } from "./ViremComposer";

function PreviewFrame() {
  const [mobile, setMobile] = useState(false);
  const { colors, theme, toggleTheme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: 8,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.dark, fontWeight: "600" }}>
          Revisión local
        </Text>
        <AssistantButton
          label={mobile ? "Vista de escritorio" : "Vista móvil (390 px)"}
          onPress={() => setMobile(!mobile)}
        />
        <AssistantButton label="Cambiar tema" onPress={toggleTheme} />
      </View>
      <View
        style={{
          flex: 1,
          width: mobile ? 390 : "100%",
          maxWidth: "100%",
          alignSelf: "center",
          minHeight: 0,
        }}
      >
        <PatientAssistantView
          token="synthetic-preview"
          dataNotice="Esta vista usa únicamente datos y respuestas de prueba."
          banner={
            <Text
              accessibilityLiveRegion="polite"
              style={{
                fontSize: 12,
                padding: 10,
                textAlign: "center",
                backgroundColor: theme === "dark" ? "#26344c" : "#e2effe",
                color: colors.dark,
              }}
            >
              VISTA PREVIA · Datos sintéticos · Respuestas de prueba · Sin
              llamadas a OpenAI
            </Text>
          }
        />
      </View>
    </View>
  );
}
export default function AssistantPreview() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PreviewFrame />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
