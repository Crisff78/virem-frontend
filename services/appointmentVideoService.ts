import { apiClient } from '../utils/api';

export type CallAccessReason =
  | 'ok'
  | 'cita_sin_fecha'
  | 'cita_no_activa'
  | 'fuera_de_horario_temprano'
  | 'fuera_de_horario_tarde'
  | 'unknown';

export type CallAccessSnapshot = {
  serverNow: number;
  cita: {
    citaId: string;
    modalidad: string;
    estadoCodigo: string;
    fechaHoraInicio: string | null;
    durationMin: number;
  } | null;
  access: {
    canJoin: boolean;
    reason: CallAccessReason;
    openFrom: number | null;
    startsAt: number | null;
    endsAt: number | null;
    closesAt: number | null;
  };
};

export type CallTokenResponse = {
  serverNow: number;
  provider: 'zego' | 'livekit';
  success: boolean;
  message?: string;
  livekit?: {
    url: string;
    token: string;
  };
  zego?: {
    appId: number;
    server: string;
    token: string;
    roomId: string;
    userId: string;
    userName: string;
    ttlSeconds: number;
  };
  access: {
    canJoin: boolean;
    startsAt: number;
    endsAt: number;
    closesAt: number;
    durationMin: number;
  };
  sala: { videoSalaId: string; estado: string } | null;
};

const normalize = (raw: any, fallback: CallAccessSnapshot['access']['reason'] = 'unknown'): CallAccessSnapshot['access']['reason'] => {
  const v = String(raw || '').trim();
  if (!v) return fallback;
  if (
    v === 'ok' ||
    v === 'cita_sin_fecha' ||
    v === 'cita_no_activa' ||
    v === 'fuera_de_horario_temprano' ||
    v === 'fuera_de_horario_tarde'
  ) {
    return v;
  }
  return fallback;
};

export const appointmentVideoService = {
  async getAccess(citaId: string): Promise<CallAccessSnapshot> {
    const payload = await apiClient.get<any>(
      `/api/video/me/citas/${encodeURIComponent(citaId)}/access`,
      { authenticated: true }
    );
    return {
      serverNow: Number(payload?.serverNow || Date.now()),
      cita: payload?.cita
        ? {
            citaId: String(payload.cita.citaId || ''),
            modalidad: String(payload.cita.modalidad || ''),
            estadoCodigo: String(payload.cita.estadoCodigo || ''),
            fechaHoraInicio: payload.cita.fechaHoraInicio || null,
            durationMin: Number(payload.cita.durationMin || 30),
          }
        : null,
      access: {
        canJoin: Boolean(payload?.access?.canJoin),
        reason: normalize(payload?.access?.reason),
        openFrom: payload?.access?.openFrom ?? null,
        startsAt: payload?.access?.startsAt ?? null,
        endsAt: payload?.access?.endsAt ?? null,
        closesAt: payload?.access?.closesAt ?? null,
      },
    };
  },

  async requestToken(citaId: string): Promise<CallTokenResponse> {
    return apiClient.post<CallTokenResponse>(
      `/api/video/me/citas/${encodeURIComponent(citaId)}/token`,
      { body: {}, authenticated: true }
    );
  },

  async sendInvite(citaId: string): Promise<{ success: boolean; invitedUsuarioId?: number }> {
    return apiClient.post(
      `/api/video/me/citas/${encodeURIComponent(citaId)}/invite`,
      { authenticated: true }
    );
  },

  async endCall(citaId: string): Promise<{ success: boolean }> {
    return apiClient.post(
      `/api/video/me/citas/${encodeURIComponent(citaId)}/end`,
      { authenticated: true }
    );
  },
};
