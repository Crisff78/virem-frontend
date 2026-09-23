import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../utils/api';
import { VideoCallApi, CallState } from './useVideoCall.types';

export function useVideoCall(citaId: string): VideoCallApi {
  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [jitsiConfig, setJitsiConfig] = useState<any>(null);

  const mountedRef = useRef(false);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    setState('joining');
    setError(null);

    try {
      console.log('[Video Call] Requesting Jitsi access for cita:', citaId);
      const response = await apiClient.post<any>(
        `/api/video/me/citas/${citaId}/token`,
        { body: {}, authenticated: true }
      );

      if (!response.success || response.provider !== 'jitsi' || !response.jitsi) {
        throw new Error(response.message || 'Jitsi no disponible');
      }

      setJitsiConfig(response.jitsi);
      setState('connected');

    } catch (err: any) {
      console.error('[Video Call] Error:', err);
      setError(err.message || 'No se pudo conectar a la videollamada');
      setState('idle');
    }
  }, [citaId, state]);

  const end = useCallback(async (reason?: string) => {
    setState('ended');
    try {
      await apiClient.post(`/api/video/me/citas/${citaId}/end`, {
        body: { reason },
        authenticated: true,
      });
    } catch (_) {}
  }, [citaId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (state !== 'connected') return;
    const timer = setInterval(() => setDurationSec(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  return {
    state,
    error,
    durationSec,
    remainingMs,
    start,
    end,
    provider: 'jitsi',
    jitsiConfig,
  };
}
