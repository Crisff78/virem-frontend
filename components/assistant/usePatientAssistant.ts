import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import { File as LocalFile, Paths } from "expo-file-system";
import { assistantClient } from "./client";
import type { AssistantMessage, Conversation, UploadFile } from "./types";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la solicitud.";
const generationErrors: Record<string, string> = {
  invalid_response: "No pudimos validar la explicación. Tu estudio y tu pregunta se conservan; puedes reintentar.",
  response_incomplete: "La explicación se interrumpió antes de terminar. Tu estudio y tu pregunta se conservan; puedes reintentar.",
  provider_busy: "El servicio de IA alcanzó su límite temporal. Espera un momento y vuelve a intentarlo.",
  provider_timeout: "El servicio de IA tardó demasiado. Tu estudio y tu pregunta se conservan; puedes reintentar.",
  interrupted: "La respuesta se interrumpió. Tu estudio y tu pregunta se conservan; puedes reintentar.",
};
const generationError = (code?: string) => generationErrors[code || ""] ||
  "La respuesta no se completó. Tu pregunta se conserva; puedes reintentar.";
function discardCachedFile(file: UploadFile | null) {
  if (Platform.OS === "web" || !file) return;
  try {
    if (file.uri.startsWith(Paths.cache.uri)) {
      const cached = new LocalFile(file.uri);
      if (cached.exists) cached.delete();
    }
  } catch {
    /* The OS cache can already have evicted it. */
  }
}
// UUIDs are idempotency tokens, never an authorization mechanism.
function requestId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
export function usePatientAssistant(token: string, active: boolean) {
  const client = useMemo(() => assistantClient(token), [token]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [selected, updateSelected] = useState<UploadFile | null>(null);
  const selectedRef = useRef<UploadFile | null>(null);
  // `keep` transfers the local file elsewhere instead of discarding its cache copy.
  function setSelected(file: UploadFile | null, keep = false) {
    if (!keep && selectedRef.current?.uri !== file?.uri)
      discardCachedFile(selectedRef.current);
    selectedRef.current = file;
    updateSelected(file);
  }
  // The last uploaded file stays local until its reading succeeds, so a failed
  // reading can be retried without asking the patient to pick it again.
  const retained = useRef<{ id: string; file: UploadFile } | null>(null);
  function releaseRetained() {
    discardCachedFile(retained.current?.file ?? null);
    retained.current = null;
  }
  const [uploading, setUploading] = useState(false);
  // Ready documents accompany the next message unless the patient excludes them.
  const [excluded, setExcluded] = useState<string[]>([]);
  const excludedRef = useRef<string[]>([]);
  excludedRef.current = excluded;
  const includedIds = (documents: Conversation["documents"] = [], skip = excludedRef.current) =>
    documents.filter((d) => d.status === "ready" && !skip.includes(d.id)).map((d) => d.id);
  function toggleDocument(id: string) {
    setExcluded((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }
  const [mutating, setMutating] = useState(false);
  const version = useRef(0),
    locked = useRef(false);
  const snapshotVersion = useRef(0),
    mutation = useRef(false),
    picking = useRef(false);
  const stream = useRef<AbortController | null>(null),
    upload = useRef<AbortController | null>(null),
    audio = useRef<AbortController | null>(null);
  const current = useRef(conversation);
  current.current = conversation;
  const activeMessage = useRef<string | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const alive = (v: number) => v === version.current;
  const refresh = useCallback(async () => {
    const v = version.current,
      snapshot = ++snapshotVersion.current;
    try {
      const result = await client.get();
      if (alive(v) && snapshot === snapshotVersion.current)
        setConversation(result.conversation);
    } catch (e) {
      if (alive(v) && snapshot === snapshotVersion.current)
        setError(errorText(e));
    }
  }, [client]);
  useEffect(() => {
    const v = ++version.current;
    const snapshot = ++snapshotVersion.current;
    setConversation(null);
    setDraft("");
    setError("");
    setSelected(null);
    setExcluded([]);
    setLoading(true);
    setSending(false);
    setUploading(false);
    setTranscribing(false);
    setMutating(false);
    locked.current = false;
    mutation.current = false;
    picking.current = false;
    activeMessage.current = null;
    retry.current = null;
    if (token)
      client
        .get()
        .then((r) => {
          if (alive(v) && snapshot === snapshotVersion.current)
            setConversation(r.conversation);
        })
        .catch((e) => {
          if (alive(v)) setError(errorText(e));
        })
        .finally(() => {
          if (alive(v)) setLoading(false);
        });
    else setLoading(false);
    return () => {
      version.current++;
      stream.current?.abort();
      upload.current?.abort();
      audio.current?.abort();
      discardCachedFile(selectedRef.current);
      releaseRetained();
    };
  }, [client, token]);
  useEffect(() => {
    const id = retained.current?.id;
    if (id && conversation?.documents.some((d) => d.id === id && d.status === "ready"))
      releaseRetained();
  }, [conversation]);
  useEffect(() => {
    if (!active) audio.current?.abort();
  }, [active]);
  const reading =
    conversation?.documents.some((d) => d.status === "reading") || false;
  const serverRunning =
    conversation?.messages.some((m) => m.status === "running") || false;
  useEffect(() => {
    if (!active || sending || (!reading && !serverRunning)) return;
    const timer = setInterval(() => void refresh(), 1200);
    return () => clearInterval(timer);
  }, [active, sending, reading, serverRunning, refresh]);
  async function ensureConversation() {
    if (current.current) return current.current;
    const result = await client.create();
    return result.conversation;
  }
  function updateMessage(message: AssistantMessage) {
    snapshotVersion.current++;
    setConversation((c) =>
      c
        ? {
            ...c,
            messages: c.messages.some((m) => m.id === message.id)
              ? c.messages.map((m) => (m.id === message.id ? message : m))
              : [...c.messages, message],
          }
        : c,
    );
  }
  async function pick() {
    if (picking.current || mutation.current || locked.current) return;
    const v = version.current;
    picking.current = true;
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!alive(v)) {
        discardCachedFile(file);
        return;
      }
      if (file.size && file.size > 10 * 1024 * 1024) {
        discardCachedFile(file);
        throw new Error("El archivo supera el límite de 10 MiB.");
      }
      setSelected(file);
    } catch (e) {
      if (alive(v)) setError(errorText(e));
    } finally {
      if (alive(v)) picking.current = false;
    }
  }
  async function readSelected(file: UploadFile | null = selected) {
    if (!file || locked.current || mutation.current || uploading) return;
    snapshotVersion.current++;
    locked.current = true;
    setUploading(true);
    setError("");
    const v = version.current,
      controller = new AbortController();
    upload.current = controller;
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const c = await ensureConversation();
      if (!alive(v)) return;
      setConversation(c);
      current.current = c;
      const { document } = await client.upload(
        c.id,
        file,
        controller.signal,
      );
      if (!alive(v)) return;
      snapshotVersion.current++;
      setConversation((prev) =>
        prev ? { ...prev, documents: [...prev.documents, document] } : prev,
      );
      releaseRetained();
      retained.current = { id: document.id, file };
      setSelected(null, true);
    } catch (e) {
      if (alive(v))
        setError(
          controller.signal.aborted
            ? "La carga se interrumpió. Puedes reintentar."
            : errorText(e),
        );
    } finally {
      clearTimeout(timer);
      if (alive(v)) {
        locked.current = false;
        setUploading(false);
      }
      if (upload.current === controller) upload.current = null;
    }
  }
  // `documentIds` lets a retry reuse the original message's documents.
  async function send(question = draft, newAttempt = false, documentIds?: string[]) {
    if (
      locked.current ||
      mutation.current ||
      selected ||
      reading ||
      serverRunning ||
      transcribing
    )
      return;
    const ids = documentIds ?? includedIds(current.current?.documents);
    if (!question.trim() && !ids.length) return;
    locked.current = true;
    snapshotVersion.current++;
    activeMessage.current = null;
    setSending(true);
    setError("");
    const v = version.current,
      controller = new AbortController();
    stream.current = controller;
    const key = JSON.stringify({ question: question.trim(), ids });
    if (newAttempt || retry.current?.key !== key)
      retry.current = { key, id: requestId() };
    const id = retry.current!.id;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 100000);
    try {
      const c = await ensureConversation();
      if (!alive(v)) return;
      setConversation(c);
      current.current = c;
      await client.send(
        c.id,
        { requestId: id, question: question.trim(), documentIds: ids },
        controller.signal,
        (event) => {
          if (!alive(v)) return;
          if (event.message) {
            activeMessage.current = event.message.id;
            updateMessage(event.message);
          }
          if (event.type === "content") {
            snapshotVersion.current++;
            setConversation((prev) =>
              prev
                ? {
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === activeMessage.current
                        ? { ...m, partial: event.text || "" }
                        : m,
                    ),
                  }
                : prev,
            );
          }
          if (event.type === "done" && event.message?.status === "completed") {
            setDraft((value) => (value === question ? "" : value));
            retry.current = null;
          }
          if (event.type === "error") {
            setError(generationError(event.code));
            // The server recorded this attempt as failed: sending again is a new attempt.
            retry.current = null;
          }
        },
      );
    } catch (e) {
      if (alive(v)) {
        if (timedOut)
          // Keep the requestId: the server may still finish and the next send reconciles it.
          setError(generationError("provider_timeout"));
        else if (controller.signal.aborted) {
          setError("Respuesta detenida. Tu pregunta se conserva.");
          retry.current = null;
        } else setError(errorText(e));
      }
    } finally {
      clearTimeout(timer);
      if (alive(v)) {
        locked.current = false;
        setSending(false);
        void refresh();
      }
      if (stream.current === controller) stream.current = null;
    }
  }
  async function stop() {
    const v = version.current;
    const c = current.current;
    const id =
      c?.messages.find((m) => m.status === "running")?.id ||
      activeMessage.current;
    stream.current?.abort();
    try {
      if (c && id) await client.stop(c.id, id);
    } catch (e) {
      if (alive(v)) setError(errorText(e));
    } finally {
      if (alive(v)) void refresh();
    }
  }
  async function removeDocument(id: string, keepFile = false) {
    if (!current.current || locked.current || mutation.current) return false;
    const v = version.current;
    mutation.current = true;
    snapshotVersion.current++;
    setMutating(true);
    setError("");
    try {
      await client.removeDocument(current.current.id, id);
      if (!alive(v)) return false;
      if (!keepFile && retained.current?.id === id) releaseRetained();
      await refresh();
      return true;
    } catch (e) {
      if (alive(v)) setError(errorText(e));
      return false;
    } finally {
      if (alive(v)) {
        mutation.current = false;
        setMutating(false);
      }
    }
  }
  const canRetryDocument = (id: string) => retained.current?.id === id;
  // Replaces a failed reading with a new one of the same local file; the thread is kept.
  async function retryDocument(id: string) {
    const kept = retained.current;
    if (!kept || kept.id !== id || selectedRef.current) return;
    const v = version.current;
    if (!(await removeDocument(id, true)) || !alive(v)) return;
    retained.current = null;
    setSelected(kept.file, true);
    await readSelected(kept.file);
  }
  async function clear() {
    const c = current.current;
    if (!c || mutation.current) return;
    const v = version.current;
    mutation.current = true;
    snapshotVersion.current++;
    setMutating(true);
    setError("");
    try {
      await client.remove(c.id);
      if (!alive(v)) return;
      version.current++;
      stream.current?.abort();
      upload.current?.abort();
      audio.current?.abort();
      setConversation(null);
      current.current = null;
      setDraft("");
      setSelected(null);
      setExcluded([]);
      releaseRetained();
      setSending(false);
      setUploading(false);
      setTranscribing(false);
      locked.current = false;
      retry.current = null;
      activeMessage.current = null;
      picking.current = false;
      mutation.current = false;
      setMutating(false);
    } catch (e) {
      if (alive(v)) setError(errorText(e));
    } finally {
      if (alive(v)) {
        mutation.current = false;
        setMutating(false);
      }
    }
  }
  async function transcribe(file: UploadFile, recordingSignal?: AbortSignal) {
    if (recordingSignal?.aborted) return;
    audio.current?.abort();
    const controller = new AbortController();
    audio.current = controller;
    const cancel = () => controller.abort();
    recordingSignal?.addEventListener("abort", cancel, { once: true });
    const v = version.current;
    setTranscribing(true);
    setError("");
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 65000);
    try {
      const result = await client.transcribe(file, controller.signal);
      if (alive(v) && !controller.signal.aborted)
        setDraft((d) => (d ? d + " " : "") + result.text);
    } catch (e) {
      if (alive(v) && audio.current === controller) {
        if (timedOut)
          setError(
            "La transcripción tardó demasiado. Tu borrador se conserva; puedes volver a dictar.",
          );
        else if (!controller.signal.aborted) setError(errorText(e));
      }
    } finally {
      clearTimeout(timer);
      recordingSignal?.removeEventListener("abort", cancel);
      if (alive(v) && audio.current === controller) {
        audio.current = null;
        setTranscribing(false);
      }
    }
  }
  return {
    conversation,
    draft,
    setDraft,
    error,
    setError,
    loading,
    sending: sending || serverRunning,
    transcribing,
    selected,
    setSelected,
    uploading,
    mutating,
    reading,
    pick,
    readSelected,
    send,
    stop,
    removeDocument,
    includedDocumentIds: includedIds(conversation?.documents, excluded),
    toggleDocument,
    canRetryDocument,
    retryDocument,
    clear,
    transcribe,
    refresh,
  };
}
