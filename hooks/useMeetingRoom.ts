import { useVideoCall } from './useVideoCall';

/**
 * useMeetingRoom handles the connection and room state.
 * Currently integrated into useLiveKitCall/useVideoCall.
 */
export const useMeetingRoom = (citaId: string | undefined) => {
  const call = useVideoCall(citaId || '');
  return {
    room: call.room || call.jitsiConfig || null,
    state: call.state,
    error: call.error,
    connect: call.start,
    disconnect: call.end,
  };
};

/**
 * useRealtimePresence handles participants.
 * Jitsi handles this internally in the iframe.
 */
export const useRealtimePresence = (citaId: string | undefined) => {
  return {
    localParticipant: null,
    remoteParticipants: [],
  };
};
