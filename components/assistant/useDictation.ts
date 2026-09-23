import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { File } from "expo-file-system";
import type { UploadFile } from "./types";

type Phase = "idle" | "starting" | "recording" | "finishing";
type Session = {
  controller: AbortController;
  phase: Phase;
  timer?: ReturnType<typeof setTimeout>;
};

export function useDictation(
  active: boolean,
  onFile: (file: UploadFile, signal?: AbortSignal) => Promise<void>,
  onError: (text: string) => void,
) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>("idle");
  const session = useRef<Session | null>(null);
  const mounted = useRef(true);
  const callbacks = useRef({ onFile, onError });
  callbacks.current = { onFile, onError };

  function update(s: Session, next: Phase) {
    s.phase = next;
    if (mounted.current && session.current === s) setPhase(next);
  }
  function release(s: Session) {
    clearTimeout(s.timer);
    if (session.current === s) {
      session.current = null;
      if (mounted.current) setPhase("idle");
    }
  }
  function removeAudio(uri: string | null) {
    if (!uri) return;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      /* The OS can already have removed the temporary file. */
    }
  }
  async function stop(s: Session) {
    if (s.phase !== "recording") return;
    update(s, "finishing");
    clearTimeout(s.timer);
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false });
      if (uri && !s.controller.signal.aborted)
        await callbacks.current.onFile(
          { uri, name: "dictado.m4a", mimeType: "audio/mp4" },
          s.controller.signal,
        );
    } catch {
      if (!s.controller.signal.aborted)
        callbacks.current.onError("No se pudo completar el dictado.");
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      removeAudio(uri || recorder.uri);
      release(s);
    }
  }
  function cancel() {
    const s = session.current;
    if (!s) return;
    s.controller.abort();
    void stop(s);
  }
  useEffect(() => {
    if (!active) cancel();
  }, [active]);
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") cancel();
    });
    return () => {
      mounted.current = false;
      sub.remove();
      cancel();
    };
  }, []);

  async function toggle() {
    if (session.current) {
      await stop(session.current);
      return;
    }
    if (
      !active ||
      !mounted.current ||
      (AppState.currentState && AppState.currentState !== "active")
    )
      return;
    const s: Session = { controller: new AbortController(), phase: "starting" };
    session.current = s;
    update(s, "starting");
    let prepared = false;
    try {
      const permissions = await requestRecordingPermissionsAsync();
      if (s.controller.signal.aborted) return;
      if (!permissions.granted) {
        callbacks.current.onError("Autoriza el micrófono para dictar.");
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      if (s.controller.signal.aborted) return;
      prepared = true;
      await recorder.prepareToRecordAsync();
      if (s.controller.signal.aborted) return;
      recorder.record();
      update(s, "recording");
      s.timer = setTimeout(() => void stop(s), 119000);
    } catch {
      if (!s.controller.signal.aborted)
        callbacks.current.onError("No se pudo iniciar el micrófono.");
    } finally {
      if (s.phase === "starting") {
        if (prepared) await recorder.stop().catch(() => {});
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        if (prepared) removeAudio(recorder.uri);
        release(s);
      }
    }
  }
  return {
    recording: phase === "recording",
    preparing: phase === "starting" || phase === "finishing",
    toggle,
    cancel,
  };
}
