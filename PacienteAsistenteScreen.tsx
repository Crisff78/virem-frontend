import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./navigation/types";
import { useAuth } from "./providers/AuthProvider";
import { useTheme } from "./providers/ThemeContext";
import { usePacienteModule } from "./navigation/PacienteModuleContext";
import { usePatientAssistant } from "./components/assistant/usePatientAssistant";
import { useDictation } from "./components/assistant/useDictation";
import ViremComposer, {
  AssistantButton,
} from "./components/assistant/ViremComposer";
import type {
  AssistantDocument,
  AssistantMessage,
} from "./components/assistant/types";
// Reading failures never block the conversation; the patient can retry or remove the file.
const documentErrors: Record<string, string> = {
  unsupported: "Fuera de alcance: adjunta el informe escrito",
  unreadable: "No se pudo leer. Prueba una copia más clara.",
  document_incomplete: "Informe demasiado extenso. Adjunta menos páginas.",
  provider_timeout: "La lectura tardó demasiado. Puedes reintentarla.",
  provider_busy: "Servicio ocupado. Espera un momento y reintenta.",
  interrupted: "Lectura interrumpida. Puedes reintentarla.",
};
// Middle truncation keeps the start and the extension of long names visible.
function shortName(name: string, max = 30) {
  if (name.length <= max) return name;
  const extension = /.[^.]{1,5}$/.exec(name)?.[0] ?? "";
  const tail = Math.min(10, extension.length + 4);
  return `${name.slice(0, max - tail - 1)}…${name.slice(-tail)}`;
}
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: { width: "100%", maxWidth: 460 },
});

function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: colors.border,
        paddingVertical: 8,
      }}
    >
      <AssistantButton
        label={`${open ? "−" : "＋"} ${title}`}
        onPress={() => setOpen(!open)}
        expanded={open}
      />
      {open && <View style={{ paddingVertical: 12 }}>{children}</View>}
    </View>
  );
}
function Report({ document }: { document: AssistantDocument }) {
  const { colors, theme } = useTheme();
  const extraction = document.extraction;
  if (!extraction) return null;
  return (
    <View
      style={[
        styles.report,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.label, { color: colors.dark }]}>
        Datos del informe · {document.name}
      </Text>
      {extraction.findings.map((f, i) => (
        <View
          key={i}
          style={{
            gap: 4,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.dark, fontSize: 16, fontWeight: "600" }}>
            {f.label || "Dato sin nombre legible"}
          </Text>
          <Text selectable style={{ color: colors.dark, fontSize: 16 }}>
            {f.value || "Valor no legible"}
            {f.unit ? ` ${f.unit}` : ""}
          </Text>
          <Text style={{ color: colors.blue }}>
            Rango del informe: {f.range || "No indicado o no legible"}
          </Text>
          {f.verified === false && (
            <Text style={{ color: theme === "dark" ? "#fca5a5" : "#a32332", fontSize: 13 }}>
              No encontramos este dato en el texto del informe. Compruébalo en el original.
            </Text>
          )}
          {f.page !== null && Boolean(f.quote) && (
            <Text selectable style={{ color: colors.blue, fontSize: 13 }}>
              Página {f.page} · «{f.quote}»
            </Text>
          )}
        </View>
      ))}
      {!extraction.findings.length && (
        <Text selectable style={{ color: colors.dark, lineHeight: 24 }}>
          {extraction.text}
        </Text>
      )}
      {extraction.limitations.map((text, i) => (
        <Text key={i} style={{ color: colors.blue, marginTop: 8 }}>
          Lectura: {text}
        </Text>
      ))}
      <Text style={{ color: colors.blue, fontSize: 12, marginTop: 10 }}>
        Extracción asistida por IA. Comprueba los datos con tu informe original.
      </Text>
    </View>
  );
}
function Message({
  message,
  documents,
  onFollowup,
  onRetry,
}: {
  message: AssistantMessage;
  documents: AssistantDocument[];
  onFollowup: (s: string) => void;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const docs = documents.filter((d) => message.document_ids.includes(d.id));
  return (
    <View style={{ gap: 18, paddingBottom: 30 }}>
      <View
        style={[
          styles.question,
          { backgroundColor: colors.white, borderColor: colors.border },
        ]}
      >
        <Text
          selectable
          style={{ color: colors.dark, fontSize: 16, lineHeight: 24 }}
        >
          {message.question}
        </Text>
        {docs.map((d) => (
          <Text
            key={d.id}
            style={{ color: colors.blue, fontSize: 12, marginTop: 8 }}
          >
            Adjunto: {d.name}
          </Text>
        ))}
      </View>
      <Text style={[styles.label, { color: colors.dark }]}>
        ✦ Virem · Tu asistente de salud
      </Text>
      <Text
        selectable
        style={{ color: colors.dark, fontSize: 17, lineHeight: 27 }}
      >
        {message.answer?.summary ||
          message.partial ||
          (message.status === "running"
            ? "Preparando una explicación…"
            : "No se completó la respuesta.")}
      </Text>
      {docs.length > 0 && (
        <Disclosure title="Ver datos del informe">
          {docs.map((d) => (
            <Report document={d} key={d.id} />
          ))}
        </Disclosure>
      )}
      {message.answer && (
        <>
          <Disclosure title="¿Qué significa para mí?">
            <Text
              selectable
              style={{ color: colors.dark, lineHeight: 25, fontSize: 16 }}
            >
              {message.answer.interpretation}
            </Text>
            {!!message.answer.uncertainty && (
              <Text
                style={{ color: colors.blue, lineHeight: 24, marginTop: 12 }}
              >
                Lo que falta saber: {message.answer.uncertainty}
              </Text>
            )}
          </Disclosure>
          <Disclosure title="Preparar mi consulta">
            {message.answer.consultation.map((s, i) => (
              <Text key={i} style={{ color: colors.dark, lineHeight: 26 }}>
                • {s}
              </Text>
            ))}
          </Disclosure>
          <View style={styles.row}>
            {message.answer.followups.map((s) => (
              <AssistantButton
                key={s}
                label={s}
                onPress={() => onFollowup(s)}
              />
            ))}
          </View>
        </>
      )}
      {(message.status === "error" || message.status === "stopped") && (
        <View style={{ gap: 10 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.blue }}>
            Respuesta incompleta ·{" "}
            {message.status === "stopped" ? "Detenida" : "No se pudo completar"}
          </Text>
          <AssistantButton label="Reintentar respuesta" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}
export function PatientAssistantView({
  token,
  active = true,
  banner,
  dataNotice = "Los datos enviados se procesan con OpenAI.",
  onMenu,
}: {
  token: string;
  active?: boolean;
  // Local review wrappers inject their notices so production bundles do not carry them.
  banner?: React.ReactNode;
  dataNotice?: string;
  onMenu?: () => void;
}) {
  const { colors, theme } = useTheme();
  const windowSize = useWindowDimensions();
  const [width, setWidth] = useState(windowSize.width);
  const [availableHeight, setAvailableHeight] = useState(windowSize.height);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const shortViewport = availableHeight < 520 || keyboardVisible;
  useEffect(() => {
    if (Platform.OS === "web") return;
    const shown = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  const insets = useSafeAreaInsets();
  const [viewportHeight, setViewportHeight] = useState<number | undefined>(
    undefined,
  );
  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      !window.visualViewport
    )
      return;
    const viewport = window.visualViewport;
    const update = () => setViewportHeight(viewport.height);
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);
  const a = usePatientAssistant(token, active);
  const voice = useDictation(
    active && Boolean(token),
    a.transcribe,
    a.setError,
  );
  const [confirmDelete, setConfirmDelete] = useState(false),
    [removeId, setRemoveId] = useState<string | null>(null);
  const docs = a.conversation?.documents || [],
    messages = a.conversation?.messages || [];
  const scroll = useRef<ScrollView | null>(null),
    follow = useRef(true);
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (lastMessageId) {
      follow.current = true;
      scroll.current?.scrollToEnd({ animated: false });
    }
  }, [lastMessageId]);
  // In a short viewport the attachments are the last element of the scroll area and
  // have no trailing padding, so scrolling to the end shows the whole pending file.
  useEffect(() => {
    if (shortViewport && (a.error || a.selected))
      scroll.current?.scrollToEnd({ animated: false });
  }, [shortViewport, a.error, a.selected]);
  const disabled =
    a.loading ||
    a.uploading ||
    a.mutating ||
    a.reading ||
    Boolean(a.selected) ||
    !token;
  const muted = theme === "dark" ? "#bacce0" : "#405d7a";
  const errorText = !!a.error && (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      numberOfLines={shortViewport ? 2 : undefined}
      style={{ color: theme === "dark" ? "#fca5a5" : "#a32332" }}
    >
      {a.error}
    </Text>
  );
  const attachments = (docs.length > 0 || a.selected) && (
    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
      {docs.map((d) => (
        // Text on the left and actions inline on the right keep each document to one row;
        // on narrow screens the actions wrap below the text.
        <View
          key={d.id}
          style={[styles.file, { backgroundColor: colors.bg, flexWrap: "wrap", paddingVertical: 8 }]}
        >
          <View style={{ flex: 1, minWidth: 120, gap: 2 }}>
            <Text
              numberOfLines={1}
              accessibilityLabel={d.name}
              style={{ color: colors.dark, fontWeight: "600" }}
            >
              {shortName(d.name, width < 600 ? 15 : 60)}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              numberOfLines={2}
              style={{ color: muted, fontSize: 13 }}
            >
              {d.mime === "application/pdf" ? "PDF" : "Imagen"} ·{" "}
              {d.status === "reading"
                ? "Leyendo…"
                : d.status === "ready"
                  ? // The inclusion state is shown and announced by the checkbox beside it.
                    "Listo"
                  : documentErrors[d.error_code || ""] ||
                    "No se pudo procesar. Reintenta o quita el archivo."}
            </Text>
          </View>
          <View style={[styles.row, { gap: 6 }]}>
            {d.status === "ready" && (
              <AssistantButton
                label={
                  a.includedDocumentIds.includes(d.id) ? "✓ Incluido" : "Incluir"
                }
                accessibilityLabel={`Incluir ${d.name} en el próximo mensaje`}
                checked={a.includedDocumentIds.includes(d.id)}
                onPress={() => a.toggleDocument(d.id)}
                disabled={a.sending || a.mutating}
              />
            )}
            {d.status === "error" && a.canRetryDocument(d.id) && (
              <AssistantButton
                label="Reintentar lectura"
                accessibilityLabel={`Reintentar lectura de ${d.name}`}
                onPress={() => void a.retryDocument(d.id)}
                disabled={
                  a.sending || a.mutating || a.uploading || Boolean(a.selected)
                }
              />
            )}
            <AssistantButton
              label="Quitar"
              accessibilityLabel={`Quitar ${d.name}`}
              onPress={() =>
                // Only a ready document can have fed answers that must be removed with it.
                messages.length && d.status === "ready"
                  ? setRemoveId(d.id)
                  : void a.removeDocument(d.id)
              }
              disabled={a.sending || a.mutating}
            />
          </View>
        </View>
      ))}
      {a.selected && (
        <View style={[styles.file, { backgroundColor: colors.bg }]}>
          {/* Compact in a short viewport so the whole card fits the visible scroll area. */}
          <View style={{ flex: 1, gap: shortViewport ? 4 : 8 }}>
            <Text
              numberOfLines={shortViewport ? 1 : 2}
              accessibilityLabel={a.selected.name}
              style={{ color: colors.dark, fontWeight: "600" }}
            >
              {shortViewport ? shortName(a.selected.name) : a.selected.name}
            </Text>
            {shortViewport && a.error && !a.uploading ? (
              // In a short viewport the card carries the error, so the composer does not grow.
              errorText
            ) : (
              <Text
                accessibilityLiveRegion="polite"
                numberOfLines={shortViewport ? 1 : undefined}
                style={{ color: muted }}
              >
                {a.uploading
                  ? "Cargando…"
                  : a.error
                    ? "Error de carga · Puedes reintentar o quitar el archivo"
                    : shortViewport
                      ? "Seleccionado · Máximo 10 MiB"
                      : "Seleccionado · PDF o imagen · Máximo 10 MiB"}
              </Text>
            )}
            {!a.uploading && (
              <AssistantButton
                label="Leer estudio"
                onPress={() => void a.readSelected()}
              />
            )}
          </View>
          <AssistantButton
            label="Quitar"
            accessibilityLabel="Quitar archivo seleccionado"
            onPress={() => {
              a.setSelected(null);
              a.setError("");
            }}
            disabled={a.uploading}
          />
        </View>
      )}
    </ScrollView>
  );
  const supportingInfo = (
    <>
      {!!a.error && !shortViewport && (
        <View style={{ paddingTop: 8 }}>
          {errorText}
          <AssistantButton
            label="Actualizar estado"
            onPress={() => void a.refresh()}
          />
        </View>
      )}
      {messages.length ? (
        // During a conversation the same notices take a single, smaller line.
        <Text
          style={{
            color: muted,
            fontSize: 11,
            lineHeight: 16,
            textAlign: "center",
            paddingTop: 6,
          }}
        >
          No sustituye una consulta médica. {dataNotice} Conservación hasta{" "}
          {a.conversation
            ? new Date(a.conversation.expires_at).toLocaleDateString("es")
            : "30 días"}
          .
        </Text>
      ) : (
        <>
          <Text
            style={{
              color: muted,
              fontSize: 12,
              lineHeight: 18,
              textAlign: "center",
              paddingTop: 10,
            }}
          >
            Virem te ayuda a comprender información de salud. No sustituye una
            consulta médica.
          </Text>
          <Text
            style={{
              color: muted,
              fontSize: 11,
              lineHeight: 16,
              textAlign: "center",
            }}
          >
            {dataNotice}{" "}
            Conservación: 30 días
            {a.conversation
              ? ` · Hasta ${new Date(a.conversation.expires_at).toLocaleDateString("es")}`
              : ""}
            . Puedes borrarlos antes.
          </Text>
        </>
      )}
    </>
  );
  return (
    <KeyboardAvoidingView
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
        setAvailableHeight(e.nativeEvent.layout.height);
      }}
      style={[
        styles.root,
        { backgroundColor: colors.bg, maxHeight: viewportHeight },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.header,
          { borderColor: colors.border },
          shortViewport && { paddingVertical: 8, paddingHorizontal: 12 },
        ]}
      >
        <View style={styles.row}>
          {onMenu && (
            <AssistantButton label="Menú" onPress={onMenu} />
          )}
          <Text
            accessibilityRole="header"
            style={{ color: colors.dark, fontSize: 18, fontWeight: "700" }}
          >
            Tu asistente de salud
          </Text>
        </View>
        {a.conversation && (
          <AssistantButton
            label={width < 600 ? "Borrar" : "Borrar conversación"}
            accessibilityLabel="Borrar conversación"
            onPress={() => setConfirmDelete(true)}
            disabled={a.mutating}
          />
        )}
      </View>
      {banner}
      <ScrollView
        ref={scroll}
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: width < 600 ? 16 : 32,
            ...(shortViewport && { paddingBottom: 4 }),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } =
            e.nativeEvent;
          follow.current =
            contentOffset.y + layoutMeasurement.height >=
            contentSize.height - 80;
        }}
        onContentSizeChange={() => {
          if (a.sending && follow.current)
            scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        <View style={styles.content}>
          {!messages.length && (
            <View style={[styles.intro, { paddingTop: width < 600 ? 24 : 52 }]}>
              <Text
                style={{
                  color: theme === "dark" ? "#93c5fd" : "#1262b3",
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 2,
                }}
              >
                UN ESPACIO PARA ENTENDER
              </Text>
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.dark,
                  fontSize: width < 600 ? 32 : 44,
                  lineHeight: width < 600 ? 39 : 51,
                  fontWeight: "700",
                  textAlign: "center",
                  letterSpacing: -1,
                  marginTop: 16,
                }}
              >
                {docs.length || a.selected
                  ? "Tu estudio,\npaso a paso."
                  : "Tu salud,\nun poco más clara."}
              </Text>
              <Text
                style={{
                  color: muted,
                  fontSize: 16,
                  lineHeight: 25,
                  textAlign: "center",
                  marginTop: 15,
                  maxWidth: 480,
                }}
              >
                Entiende tus estudios, aclara tus dudas y llega a tu consulta
                con mejores preguntas.
              </Text>
            </View>
          )}
          {!messages.length && !docs.length && !a.selected && (
            <View
              style={[
                styles.suggestions,
                { flexDirection: width < 650 ? "column" : "row" },
              ]}
            >
              {[
                [
                  "Entender mis resultados",
                  "Adjunta un estudio y lo vemos paso a paso.",
                  () => void a.pick(),
                ],
                [
                  "Tengo una duda de salud",
                  "Cuéntame qué te gustaría entender.",
                  () => a.setDraft("Quiero aclarar una duda sobre mi salud."),
                ],
                [
                  "Preparar mi consulta",
                  "Organiza lo que quieres conversar.",
                  () =>
                    a.setDraft(
                      "Ayúdame a preparar preguntas para mi próxima consulta.",
                    ),
                ],
              ].map(([title, hint, action]) => (
                <View
                  key={String(title)}
                  style={[
                    styles.suggestion,
                    {
                      backgroundColor: colors.white,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <AssistantButton
                    label={String(title)}
                    onPress={action as () => void}
                    disabled={a.loading}
                  />
                  <Text
                    style={{
                      color: muted,
                      fontSize: 13,
                      lineHeight: 20,
                      paddingHorizontal: 8,
                    }}
                  >
                    {String(hint)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {a.loading && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.dark, padding: 20 }}
            >
              Cargando tu conversación…
            </Text>
          )}
          {messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              documents={docs}
              onFollowup={a.setDraft}
              // Retries the same question and documents; the current draft is left untouched.
              onRetry={() => void a.send(m.question, true, m.document_ids)}
            />
          ))}
          {shortViewport && (
            <View style={{ paddingTop: 12 }}>
              {supportingInfo}
              {attachments}
            </View>
          )}
          <Modal
            visible={confirmDelete}
            transparent
            animationType="none"
            onRequestClose={() => setConfirmDelete(false)}
          >
            <View style={modalStyles.backdrop}>
              <View
                style={[
                  styles.report,
                  modalStyles.card,
                  { backgroundColor: colors.white, borderColor: colors.border },
                ]}
                accessibilityViewIsModal
              >
                <Text
                  accessibilityRole="header"
                  style={[styles.label, { color: colors.dark }]}
                >
                  Borrar conversación
                </Text>
                <Text style={{ color: colors.dark }}>
                  Se borrarán esta conversación, sus archivos y sus
                  explicaciones. Esta acción no se puede deshacer.
                </Text>
                <View style={[styles.row, { marginTop: 12 }]}>
                  <AssistantButton
                    label="Cancelar"
                    onPress={() => setConfirmDelete(false)}
                  />
                  <AssistantButton
                    label="Borrar definitivamente"
                    onPress={() => {
                      voice.cancel();
                      void a.clear().then(() => setConfirmDelete(false));
                    }}
                    disabled={a.mutating}
                  />
                </View>
              </View>
            </View>
          </Modal>
          <Modal
            visible={Boolean(removeId)}
            transparent
            animationType="none"
            onRequestClose={() => setRemoveId(null)}
          >
            <View style={modalStyles.backdrop}>
              <View
                style={[
                  styles.report,
                  modalStyles.card,
                  { backgroundColor: colors.white, borderColor: colors.border },
                ]}
                accessibilityViewIsModal
              >
                <Text
                  accessibilityRole="header"
                  style={[styles.label, { color: colors.dark }]}
                >
                  Quitar documento
                </Text>
                <Text style={{ color: colors.dark }}>
                  Quitar este documento también borra los mensajes del hilo para
                  eliminar los datos derivados del informe.
                </Text>
                <View style={styles.row}>
                  <AssistantButton
                    label="Conservar documento"
                    onPress={() => setRemoveId(null)}
                  />
                  <AssistantButton
                    label="Quitar documento y mensajes"
                    onPress={() => {
                      if (removeId)
                        void a
                          .removeDocument(removeId)
                          .then(() => setRemoveId(null));
                    }}
                    disabled={a.mutating}
                  />
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: width < 600 ? 12 : 32,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.bg,
          },
        ]}
      >
        <View style={styles.content}>
          <ViremComposer
            value={a.draft}
            onChange={a.setDraft}
            onSend={() => void a.send()}
            onAttach={() => void a.pick()}
            onDictate={() => void voice.toggle()}
            onStop={() => void a.stop()}
            compact={width < 600}
            condensed={shortViewport}
            inConversation={messages.length > 0}
            recording={voice.recording}
            preparingAudio={voice.preparing}
            transcribing={a.transcribing}
            sending={a.sending}
            disabled={disabled}
            hasDocuments={a.includedDocumentIds.length > 0}
          >
            {shortViewport ? !a.selected && errorText : attachments}
          </ViremComposer>
          {!shortViewport && supportingInfo}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
export default function PacienteAsistenteScreen() {
  const { token } = useAuth();
  const portal = usePacienteModule();
  const focused = useIsFocused();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <PatientAssistantView
      token={token}
      active={
        focused && (!portal.isInsidePortal || portal.activeModule === "PacienteAsistente")
      }
      onMenu={
        portal.isInsidePortal
          ? portal.toggleSidebar
          : () => navigation.navigate("DashboardPaciente")
      }
    />
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  scroll: { paddingBottom: 24, flexGrow: 1 },
  content: { width: "100%", maxWidth: 790, alignSelf: "center" },
  intro: { alignItems: "center", paddingBottom: 28 },
  suggestions: { gap: 12, marginBottom: 24 },
  suggestion: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 8,
  },
  footer: { paddingTop: 12 },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  question: {
    alignSelf: "flex-end",
    maxWidth: "90%",
    padding: 18,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    marginTop: 24,
  },
  label: { fontSize: 14, fontWeight: "700" },
  report: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
    gap: 8,
    marginVertical: 12,
  },
});
