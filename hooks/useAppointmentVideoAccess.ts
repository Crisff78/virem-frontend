import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  appointmentVideoService,
  type CallAccessSnapshot,
} from '../services/appointmentVideoService';
import { useSocketEvent } from './useSocketEvent';

export type CallAccessState = {
  loading: boolean;
  error: string | null;
  snapshot: CallAccessSnapshot | null;
  /** True ahora (recalculado en cada tick) */
  canJoin: boolean;
  /** Texto humano para mostrar al usuario */
  message: string;
  /** Segundos hasta que abra (negativo si ya esta abierta) */
  secondsUntilOpen: number;
  /** Segundos hasta que cierre (0 si ya cerrada) */
  secondsUntilClose: number;
  /** Vuelve a pedir el snapshot al backend */
  refresh: () => Promise<void>;
};

const messages = {
  ok: 'Consulta virtual disponible.',
  cita_sin_fecha: 'La cita no tiene fecha asignada.',
  cita_no_activa: 'Esta cita no está activa.',
  fuera_de_horario_temprano:
    'La sala abrirá cuando se acerque la hora de la cita.',
  fuera_de_horario_tarde: 'La ventana de la consulta virtual ya cerró.',
  unknown: 'No se puede iniciar la consulta virtual.',
};

function clampSec(ms: number) {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor(ms / 1000));
}

export function useAppointmentVideoAccess(citaId?: string | null): CallAccessState {
  const [snapshot, setSnapshot] = useState<CallAccessSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const skewMsRef = useRef(0); // serverNow - clientNow

  const cleanCitaId = (citaId || '').trim();

  const refresh = useCallback(async () => {
    if (!cleanCitaId) return;
    setLoading(true);
    setError(null);
    try {
      const snap = await appointmentVideoService.getAccess(cleanCitaId);
      skewMsRef.current = snap.serverNow - Date.now();
      setSnapshot(snap);
    } catch (err: any) {
      setError(err?.data?.message || err?.message || 'No se pudo verificar el acceso.');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [cleanCitaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tick de UI cada segundo
  useEffect(() => {
    if (!snapshot?.access?.startsAt) return;
    tickInterval.current = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => {
      if (tickInterval.current) clearInterval(tickInterval.current);
    };
  }, [snapshot]);

  // Si la cita cambia de estado, refrescamos
  useSocketEvent('cita_actualizada', (payload: any) => {
    if (!cleanCitaId) return;
    if (String(payload?.citaId || '') === cleanCitaId) {
      refresh();
    }
  });

  return useMemo(() => {
    if (!snapshot) {
      return {
        loading,
        error,
        snapshot: null,
        canJoin: false,
        message: error || (loading ? 'Verificando acceso...' : 'Sin datos de cita.'),
        secondsUntilOpen: 0,
        secondsUntilClose: 0,
        refresh,
      };
    }

    const now = Date.now() + skewMsRef.current;
    const openFrom = snapshot.access.openFrom ?? 0;
    const closesAt = snapshot.access.closesAt ?? 0;

    const isInWindow =
      snapshot.access.canJoin && now >= openFrom && now <= closesAt;

    let reason = snapshot.access.reason;
    if (snapshot.access.canJoin && now < openFrom) reason = 'fuera_de_horario_temprano';
    if (snapshot.access.canJoin && now > closesAt) reason = 'fuera_de_horario_tarde';

    return {
      loading,
      error,
      snapshot,
      canJoin: isInWindow,
      message: messages[reason] || messages.unknown,
      secondsUntilOpen: clampSec(openFrom - now),
      secondsUntilClose: clampSec(closesAt - now),
      refresh,
    };
    // tick fuerza recalculo aunque snapshot/loading/error no cambien
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, loading, error, refresh, tick]);
}

export function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
