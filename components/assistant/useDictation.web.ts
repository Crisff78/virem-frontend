import { useEffect, useRef, useState } from "react";
import type { UploadFile } from "./types";
import fixWebmDuration from "fix-webm-duration";

type Phase = "idle" | "starting" | "recording" | "finishing";
type Session = {
  controller: AbortController;
  phase: Phase;
  stream?: MediaStream;
  recorder?: MediaRecorder;
  timer?: ReturnType<typeof setTimeout>;
};

// Adapted from Korthyx useRecorder. Each attempt owns its tracks and callbacks,
// including while permission, final audio delivery or transcription is pending.
export function useDictation(
  active: boolean,
  onFile: (file: UploadFile, signal?: AbortSignal) => Promise<void>,
  onError: (text: string) => void,
) {
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
    s.stream?.getTracks().forEach((track) => track.stop());
    if (session.current === s) {
      session.current = null;
      if (mounted.current) setPhase("idle");
    }
  }
  function stop(s: Session) {
    if (s.phase !== "recording") return;
    update(s, "finishing");
    clearTimeout(s.timer);
    s.recorder?.stop();
    s.stream?.getTracks().forEach((track) => track.stop());
  }
  function cancel() {
    const s = session.current;
    if (!s) return;
    s.controller.abort();
    stop(s);
    s.stream?.getTracks().forEach((track) => track.stop());
  }
  useEffect(() => {
    if (!active) cancel();
  }, [active]);
  useEffect(() => {
    mounted.current = true;
    const hide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", hide);
      cancel();
    };
  }, []);

  async function toggle() {
    if (session.current) {
      stop(session.current);
      return;
    }
    if (!active || !mounted.current || document.hidden) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      callbacks.current.onError(
        "El dictado requiere un navegador compatible y HTTPS o localhost.",
      );
      return;
    }
    const s: Session = { controller: new AbortController(), phase: "starting" };
    session.current = s;
    update(s, "starting");
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (s.controller.signal.aborted) {
        release(s);
        return;
      }
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(
        s.stream,
        mimeType ? { mimeType } : undefined,
      );
      s.recorder = rec;
      const startedAt = performance.now();
      const chunks: Blob[] = [];
      let size = 0;
      rec.ondataavailable = (event) => {
        if (s.controller.signal.aborted || !event.data.size) return;
        chunks.push(event.data);
        size += event.data.size;
        if (size > 10 * 1024 * 1024) {
          cancel();
          callbacks.current.onError(
            "El audio supera 10 MiB. Graba un mensaje más corto.",
          );
        }
      };
      rec.onstop = async () => {
        s.stream?.getTracks().forEach((track) => track.stop());
        clearTimeout(s.timer);
        update(s, "finishing");
        let uri: string | undefined;
        try {
          if (s.controller.signal.aborted || !chunks.length) return;
          const raw = new Blob(chunks, { type: rec.mimeType });
          const blob = rec.mimeType.includes("webm")
            ? await fixWebmDuration(raw, performance.now() - startedAt, {
                logger: false,
              })
            : raw;
          if (s.controller.signal.aborted) return;
          uri = URL.createObjectURL(blob);
          const extension = rec.mimeType.includes("mp4")
            ? "m4a"
            : rec.mimeType.includes("ogg")
              ? "ogg"
              : "webm";
          await callbacks.current.onFile(
            {
              uri,
              name: `dictado.${extension}`,
              mimeType: rec.mimeType,
              size: blob.size,
            },
            s.controller.signal,
          );
        } catch {
          if (!s.controller.signal.aborted)
            callbacks.current.onError(
              "No se pudo preparar el audio. Puedes volver a dictar.",
            );
        } finally {
          if (uri) URL.revokeObjectURL(uri);
          release(s);
        }
      };
      rec.onerror = () => {
        if (!s.controller.signal.aborted) {
          s.controller.abort();
          callbacks.current.onError(
            "Se interrumpió el micrófono. Puedes volver a dictar.",
          );
        }
        if (rec.state === "recording") rec.stop();
        release(s);
      };
      rec.start(250);
      update(s, "recording");
      s.timer = setTimeout(() => stop(s), 119000);
    } catch {
      if (!s.controller.signal.aborted)
        callbacks.current.onError(
          "No se pudo acceder al micrófono. Revisa los permisos.",
        );
      release(s);
    }
  }
  return {
    recording: phase === "recording",
    preparing: phase === "starting" || phase === "finishing",
    toggle,
    cancel,
  };
}
