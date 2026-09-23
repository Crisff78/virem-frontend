import { useEffect } from 'react';

import { useSocket } from '../providers/SocketProvider';
import { useAuth } from '../providers/AuthProvider';

type RoomType = 'conversation' | 'cita';

const normalizeText = (value: unknown) => String(value || '').trim();

export function useSocketRoom(roomType: RoomType, resourceId: string, enabled = true) {
    const { token } = useAuth();
    const {
        joinConversation,
        leaveConversation,
        joinCita,
        leaveCita,
    } = useSocket();

    useEffect(() => {
        const cleanResourceId = normalizeText(resourceId);
        if (!enabled || !cleanResourceId || !token) return;
        // The provider retains this membership across reconnects until cleanup.

        let cancelled = false;

        const join = async () => {
            const result =
                roomType === 'conversation'
                    ? await joinConversation(cleanResourceId)
                    : await joinCita(cleanResourceId);

            if (!cancelled && !result?.ok) {
                console.warn(`[socket] no se pudo unir a ${roomType}:${cleanResourceId}`, result?.code);
            }
        };

        join().catch(() => {
            // noop
        });

        return () => {
            cancelled = true;
            if (roomType === 'conversation') {
                leaveConversation(cleanResourceId);
                return;
            }
            leaveCita(cleanResourceId);
        };
    }, [
        enabled,
        joinCita,
        joinConversation,
        leaveCita,
        leaveConversation,
        resourceId,
        roomType,
        token,
    ]);
}
