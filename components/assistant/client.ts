import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";
import { apiUrl } from "../../config/backend";
import { ApiError, checkAuthStatus, requestJson } from "../../utils/api";
import type {
  AssistantDocument,
  Conversation,
  StreamEvent,
  UploadFile,
} from "./types";

const prefix = "/api/patient-assistant";
export function assistantClient(token: string) {
  const json = <T>(
    path: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: unknown,
  ) =>
    requestJson<T>(prefix + path, {
      method,
      body,
      authToken: token,
      authenticated: true,
      timeoutMs: 15000,
    });
  async function multipart(
    path: string,
    field: string,
    file: UploadFile,
    signal: AbortSignal,
  ) {
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob =
        file.file || (await (await fetch(file.uri, { signal })).blob());
      form.append(field, blob, file.name);
    } else
      form.append(field, {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);
    const response = await fetch(apiUrl(prefix + path), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal,
    });
    checkAuthStatus(response.status, token);
    const value = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        value?.message || "No se pudo cargar el archivo.",
        response.status,
        value,
      );
    if (!value)
      throw new Error("El servidor devolvió una respuesta no válida.");
    return value;
  }
  return {
    get: () => json<{ conversation: Conversation | null }>("/conversation"),
    create: () => json<{ conversation: Conversation }>("/conversation", "POST"),
    remove: (id: string) => json(`/conversations/${id}`, "DELETE"),
    removeDocument: (id: string, documentId: string) =>
      json(`/conversations/${id}/documents/${documentId}`, "DELETE"),
    upload: (
      id: string,
      file: UploadFile,
      signal: AbortSignal,
    ): Promise<{ document: AssistantDocument }> =>
      multipart(`/conversations/${id}/documents`, "file", file, signal),
    transcribe: (
      file: UploadFile,
      signal: AbortSignal,
    ): Promise<{ text: string }> =>
      multipart("/transcriptions", "audio", file, signal),
    stop: (id: string, messageId: string) =>
      json(`/conversations/${id}/messages/${messageId}/stop`, "POST"),
    async send(
      id: string,
      body: { requestId: string; question: string; documentIds: string[] },
      signal: AbortSignal,
      onEvent: (event: StreamEvent) => void,
    ) {
      const response = await expoFetch(
        apiUrl(prefix + `/conversations/${id}/messages`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal,
        },
      );
      checkAuthStatus(response.status, token);
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new ApiError(
          error?.message || "No se pudo enviar.",
          response.status,
          error,
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No se pudo abrir la respuesta.");
      const decoder = new TextDecoder();
      let buffer = "",
        terminal = false;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index: number;
          while ((index = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, index);
            buffer = buffer.slice(index + 1);
            if (line.trim()) {
              const event = JSON.parse(line) as StreamEvent;
              onEvent(event);
              if (event.type === "done" || event.type === "error")
                terminal = true;
            }
          }
          if (buffer.length > 100000) throw new Error("Respuesta no válida.");
        }
        if (!terminal)
          throw new Error(
            "La conexión se interrumpió. Puedes reintentar el envío.",
          );
      } finally {
        if (!terminal) await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    },
  };
}
