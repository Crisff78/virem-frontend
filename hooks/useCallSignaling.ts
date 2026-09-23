import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../providers/SocketProvider';
import { useSocketEvent } from './useSocketEvent';

export type IncomingCallPayload = {
  citaId: string;
  callerRole: 'medico' | 'paciente';
  callerName: string;
  callerUsuarioId: number;
  at: string;
};

type AckResponse = { ok: boolean; code?: string };

const ACK_TIMEOUT = 5000;
const RETRY_DELAY_MS = 1500;
const MAX_RETRIES = 2;

function emitWithAck(socket: any, eventName: string, payload: any): Promise<AckResponse> {
  return new Promise((resolve) => {
    if (!socket) return resolve({ ok: false, code: 'no_socket' });
    let done = false;
    const finish = (r: AckResponse) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, code: 'ack_timeout' }), ACK_TIMEOUT);
    socket.emit(eventName, payload, (resp: AckResponse) => finish(resp || { ok: false, code: 'ack_invalid' }));
  });
}

/**
 * Emit with retry — for latency-sensitive signaling events.
 * Retries on timeout or socket disconnect, ensuring SDP offers/answers
 * and ICE candidates are delivered reliably.
 */
async function emitWithRetry(
  getSocket: () => Promise<any>,
  socketRef: React.MutableRefObject<any>,
  eventName: string,
  payload: any
): Promise<AckResponse> {
  let lastResult: AckResponse = { ok: false, code: 'no_attempt' };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const s = socketRef.current || (await getSocket());
    if (s) socketRef.current = s;

    if (!s?.connected) {
      // Socket not connected — wait and retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      return { ok: false, code: 'socket_disconnected' };
    }

    lastResult = await emitWithAck(s, eventName, payload);
    if (lastResult.ok) return lastResult;

    // If timeout, retry after delay
    if (lastResult.code === 'ack_timeout' && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }

    return lastResult;
  }

  return lastResult;
}

/**
 * Mantiene el estado global de la llamada entrante para mostrar la pantalla
 * IncomingCallScreen automaticamente.
 */
export function useIncomingCallListener() {
  const [incoming, setIncoming] = useState<IncomingCallPayload | null>(null);

  useSocketEvent<IncomingCallPayload>('call:incoming', (payload) => {
    if (!payload?.citaId) return;
    setIncoming({
      citaId: String(payload.citaId),
      callerRole: payload.callerRole === 'medico' ? 'medico' : 'paciente',
      callerName: String(payload.callerName || 'Llamada entrante'),
      callerUsuarioId: Number(payload.callerUsuarioId || 0),
      at: String(payload.at || new Date().toISOString()),
    });
  });

  // Si la otra punta cancela / acepta / cuelga, limpiamos
  useSocketEvent('call:cancelled', () => setIncoming(null));
  useSocketEvent('call:accepted', () => setIncoming(null));
  useSocketEvent('call:rejected', () => setIncoming(null));
  useSocketEvent('call:ended', () => setIncoming(null));

  const dismiss = useCallback(() => setIncoming(null), []);
  return { incoming, dismiss };
}

/**
 * Helpers para emitir eventos call:* desde quien sea.
 * Incluye lógica de retry para asegurar entrega sin latencia.
 */
export function useCallSignaler() {
  const { ensureConnected } = useSocket();
  const socketRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await ensureConnected();
      if (!cancelled) socketRef.current = s;
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureConnected]);

  const invite = useCallback(async (citaId: string) => {
    return emitWithRetry(ensureConnected, socketRef, 'call:invite', { citaId });
  }, [ensureConnected]);

  const accept = useCallback(async (citaId: string) => {
    return emitWithRetry(ensureConnected, socketRef, 'call:accept', { citaId });
  }, [ensureConnected]);

  const reject = useCallback(async (citaId: string, reason?: string) => {
    return emitWithRetry(ensureConnected, socketRef, 'call:reject', { citaId, reason });
  }, [ensureConnected]);

  const end = useCallback(async (citaId: string, reason?: string) => {
    return emitWithRetry(ensureConnected, socketRef, 'call:end', { citaId, reason });
  }, [ensureConnected]);

  const cancel = useCallback(async (citaId: string) => {
    return emitWithRetry(ensureConnected, socketRef, 'call:cancel', { citaId });
  }, [ensureConnected]);

  const reportMediaState = useCallback(
    async (citaId: string, state: { mic?: boolean; camera?: boolean }) => {
      return emitWithRetry(ensureConnected, socketRef, 'call:media-state', { citaId, ...state });
    },
    [ensureConnected]
  );

  return { invite, accept, reject, end, cancel, reportMediaState };
}
