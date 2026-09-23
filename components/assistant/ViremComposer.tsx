import React, { useLayoutEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../../providers/ThemeContext";

export function AssistantButton({
  label,
  onPress,
  disabled = false,
  primary = false,
  expanded,
  checked,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  expanded?: boolean;
  checked?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors, theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const accent = theme === "dark" ? "#93c5fd" : "#1262b3";
  // At least 3:1 against cards and page background (WCAG 1.4.11).
  const outline = theme === "dark" ? "#6b7c93" : "#768aa0";
  return (
    <Pressable
      accessibilityRole={checked === undefined ? "button" : "checkbox"}
      accessibilityLabel={accessibilityLabel || label}
      // Explicit ARIA props: react-native-web does not map accessibilityState to aria-* attributes.
      aria-disabled={disabled}
      aria-expanded={expanded}
      aria-checked={checked}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? accent : colors.white,
          borderColor: focused ? accent : primary ? accent : outline,
          borderWidth: focused ? 2 : 1,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={{
          flexShrink: 1,
          textAlign: "center",
          color: primary
            ? theme === "dark"
              ? "#0A1931"
              : "white"
            : colors.dark,
          fontWeight: "600",
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export default function ViremComposer(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onDictate: () => void;
  onStop: () => void;
  recording: boolean;
  preparingAudio: boolean;
  transcribing: boolean;
  sending: boolean;
  disabled: boolean;
  hasDocuments: boolean;
  compact?: boolean;
  condensed?: boolean;
  // Once answers are on screen the composer yields space to them.
  inConversation?: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const composing = useRef(false);
  // The field grows with its content (one line when empty) and shrinks after sending.
  const input = useRef<TextInput | null>(null);
  const minHeight = props.condensed ? 40 : 44;
  const maxHeight = props.condensed ? 80 : 160;
  const [height, setHeight] = useState(minHeight);
  const [inputWidth, setInputWidth] = useState(0);
  const fit = (contentHeight: number) =>
    setHeight(Math.min(maxHeight, Math.max(minHeight, Math.ceil(contentHeight))));
  useLayoutEffect(() => {
    // react-native-web does not shrink a textarea on its own: measure its content height.
    if (Platform.OS !== "web") return;
    const node = input.current as unknown as HTMLTextAreaElement | null;
    if (!node?.style) return;
    const previous = node.style.height;
    node.style.height = "0px";
    const measured = node.scrollHeight;
    node.style.height = previous;
    fit(measured);
  }, [props.value, inputWidth, minHeight, maxHeight]);
  const tight = props.condensed || props.inConversation;
  return (
    <View
      style={[
        styles.composer,
        tight && { padding: 12, gap: 6 },
        {
          backgroundColor: colors.white,
          borderColor: focused ? colors.primary : colors.border,
          borderWidth: focused ? 2 : 1,
        },
      ]}
    >
      {props.children}
      {/* The field keeps its accessible name; the visible label is only shown before the first answer. */}
      {!tight && (
        <Text
          nativeID="assistant-question-label"
          style={{ color: colors.dark, fontWeight: "700", fontSize: 14 }}
        >
          Tu pregunta
        </Text>
      )}
      <TextInput
        ref={input}
        onLayout={(e) => setInputWidth(Math.round(e.nativeEvent.layout.width))}
        onContentSizeChange={(e) => {
          if (Platform.OS !== "web")
            fit(e.nativeEvent.contentSize.height + (props.condensed ? 12 : 20));
        }}
        accessibilityLabel="Tu pregunta"
        accessibilityLabelledBy={tight ? undefined : "assistant-question-label"}
        value={props.value}
        onChangeText={props.onChange}
        multiline
        maxLength={4000}
        placeholder="Pregunta sobre tu salud o adjunta un estudio…"
        placeholderTextColor={colors.blue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!props.sending}
        {...(Platform.OS === "web"
          ? ({
              onCompositionStart: () => {
                composing.current = true;
              },
              onCompositionEnd: () => {
                composing.current = false;
              },
            } as any)
          : {})}
        onKeyPress={(event) => {
          const e = event as any;
          if (
            Platform.OS === "web" &&
            e.nativeEvent.key === "Enter" &&
            !e.shiftKey &&
            !e.nativeEvent.shiftKey &&
            !composing.current &&
            !e.nativeEvent.isComposing
          ) {
            if (
              !props.disabled &&
              !props.recording &&
              !props.preparingAudio &&
              !props.transcribing &&
              !props.sending &&
              (props.value.trim() || props.hasDocuments)
            ) {
              e.preventDefault();
              props.onSend();
            }
          }
        }}
        style={[
          styles.input,
          { color: colors.dark, height },
          props.condensed && { paddingVertical: 6 },
        ]}
      />
      <View style={styles.controls}>
        <AssistantButton
          label={props.compact ? "＋ Adjuntar" : "＋ Adjuntar estudio"}
          accessibilityLabel="＋ Adjuntar estudio"
          onPress={props.onAttach}
          disabled={
            props.disabled ||
            props.sending ||
            props.recording ||
            props.preparingAudio ||
            props.transcribing
          }
        />
        <AssistantButton
          label={
            props.recording
              ? props.compact
                ? "Terminar"
                : "Terminar dictado"
              : props.transcribing
                ? props.compact
                  ? "Procesando…"
                  : "Transcribiendo…"
                : props.preparingAudio
                  ? props.compact
                    ? "Preparando…"
                    : "Preparando audio…"
                  : "Dictar"
          }
          accessibilityLabel={
            props.recording
              ? "Terminar dictado"
              : props.transcribing
                ? "Transcribiendo…"
                : props.preparingAudio
                  ? "Preparando audio…"
                  : "Dictar"
          }
          onPress={props.onDictate}
          disabled={
            props.disabled ||
            props.sending ||
            props.transcribing ||
            props.preparingAudio
          }
        />
        <View style={{ flexGrow: 1 }} />
        {props.sending ? (
          <AssistantButton
            label={props.compact ? "Detener" : "Detener respuesta"}
            accessibilityLabel="Detener respuesta"
            onPress={props.onStop}
            primary
          />
        ) : (
          <AssistantButton
            label={
              props.hasDocuments && !props.value.trim()
                ? props.compact
                  ? "Explicar"
                  : "Explicar estudio"
                : "Enviar ↑"
            }
            accessibilityLabel={
              props.hasDocuments && !props.value.trim()
                ? "Explicar estudio"
                : "Enviar ↑"
            }
            onPress={props.onSend}
            primary
            disabled={
              props.disabled ||
              props.recording ||
              props.preparingAudio ||
              props.transcribing ||
              (!props.value.trim() && !props.hasDocuments)
            }
          />
        )}
      </View>
      {props.recording && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.dark, marginTop: 10 }}
        >
          Micrófono activo · Solo se graba este mensaje. Máximo 2 minutos.
        </Text>
      )}
      {props.transcribing && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.dark, marginTop: 10 }}
        >
          Transcribiendo tu mensaje. Podrás revisarlo antes de enviarlo.
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  composer: { borderRadius: 20, padding: 18, gap: 10 },
  input: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
    paddingVertical: 10,
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  button: {
    minHeight: 44,
    minWidth: 44,
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
