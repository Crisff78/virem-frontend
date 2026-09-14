import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { BACKEND_URL } from '../config/backend';
import { useAuth } from './AuthProvider';

type SocketJoinAck = { ok: boolean; code?: string; room?: string; citaId?: string; conversacionId?: string };
type RoomEvent = 'conversation' | 'cita' | 'admin_monitoring';
type ActiveRoom = {
    type: RoomEvent;
    id: string;
    owners: number;
    connection?: string;
    pending?: Promise<SocketJoinAck>;
};
type SocketContextValue = {
    socket: Socket | null;
    isConnected: boolean;
    lastError: string;
    ensureConnected: () => Promise<Socket | null>;
    joinConversation: (id: string) => Promise<SocketJoinAck>;
    leaveConversation: (id: string) => void;
    joinCita: (id: string) => Promise<SocketJoinAck>;
    leaveCita: (id: string) => void;
    joinAdminMonitoring: () => Promise<SocketJoinAck>;
    leaveAdminMonitoring: () => void;
};
const SocketContext = createContext<SocketContextValue | null>(null);
const normalizeText = (value: unknown) => String(value || '').trim();
const roomKey = (type: RoomEvent, id: string) => type + ':' + id;
const UNAVAILABLE: SocketJoinAck = { ok: false, code: 'socket_unavailable' };

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token } = useAuth();
    const tokenRef = useRef('');
    tokenRef.current = normalizeText(token);
    const socketRef = useRef<Socket | null>(null);
    const roomsRef = useRef(new Map<string, ActiveRoom>());
    const cleanupRef = useRef<(() => void) | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastError, setLastError] = useState('');

    const sendJoin = useCallback((current: Socket, room: ActiveRoom): Promise<SocketJoinAck> => {
        const key = roomKey(room.type, room.id);
        if (!current.connected || socketRef.current !== current || roomsRef.current.get(key) !== room) {
            return Promise.resolve(UNAVAILABLE);
        }
        const connection = current.id;
        if (room.connection === connection && room.pending) return room.pending;
        room.connection = connection;
        const pending = new Promise<SocketJoinAck>((resolve) => {
            const ack = (error: Error | null, result: SocketJoinAck) => {
                // A leave can run while the server is still authorizing this join.
                if (!roomsRef.current.has(key) && current.connected) {
                    current.emit('leave:' + room.type, ...(room.id ? [room.id] : []));
                }
                const value = error ? { ok: false, code: 'socket_ack_timeout' } : result || { ok: false, code: 'socket_ack_invalid' };
                if (!value.ok && room.connection === connection) room.pending = undefined;
                resolve(value);
            };
            current.timeout(5000).emit('join:' + room.type, ...(room.id ? [room.id] : []), ack);
        });
        room.pending = pending;
        return pending;
    }, []);

    const disposeSocket = useCallback(() => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        roomsRef.current.clear();
        socketRef.current?.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
    }, []);

    const ensureSocket = useCallback(() => {
        const cleanToken = tokenRef.current;
        if (!cleanToken) return null;
        if (socketRef.current && (socketRef.current.auth as { token?: string }).token !== cleanToken) {
            disposeSocket();
        }
        if (!socketRef.current) {
            const current = io(BACKEND_URL, { transports: ['websocket'], autoConnect: false, auth: { token: cleanToken } });
            socketRef.current = current;
            setSocket(current);
            const onConnect = () => {
                setIsConnected(true);
                setLastError('');
                // Socket.IO fires connect after initial connection AND every reconnect.
                roomsRef.current.forEach(room => {
                    void sendJoin(current, room).then(ack => {
                        if (!ack.ok && socketRef.current === current) setLastError(ack.code || 'room_join_failed');
                    });
                });
            };
            const onDisconnect = () => {
                setIsConnected(false);
                roomsRef.current.forEach(room => { room.connection = undefined; room.pending = undefined; });
            };
            const onError = () => { setIsConnected(false); setLastError('socket_connection_failed'); };
            current.on('connect', onConnect);
            current.on('disconnect', onDisconnect);
            current.on('connect_error', onError);
            cleanupRef.current = () => {
                current.off('connect', onConnect);
                current.off('disconnect', onDisconnect);
                current.off('connect_error', onError);
            };
        }
        return socketRef.current;
    }, [disposeSocket, sendJoin]);

    const ensureConnected = useCallback(async (): Promise<Socket | null> => {
        const current = ensureSocket();
        if (!current) return null;
        if (current.connected) return current;
        return new Promise(resolve => {
            const finish = (value: Socket | null) => {
                clearTimeout(timer);
                current.off('connect', onConnect);
                current.off('connect_error', onError);
                current.off('disconnect', onError);
                resolve(value && socketRef.current === current ? value : null);
            };
            const onConnect = () => finish(current);
            const onError = () => finish(null);
            const timer = setTimeout(onError, 5000);
            current.once('connect', onConnect);
            current.once('connect_error', onError);
            current.once('disconnect', onError);
            current.connect();
        });
    }, [ensureSocket]);

    const joinRoom = useCallback(async (type: RoomEvent, resourceId = '') => {
        const id = normalizeText(resourceId);
        if ((type !== 'admin_monitoring' && !id) || !ensureSocket()) return UNAVAILABLE;
        const key = roomKey(type, id);
        const room = roomsRef.current.get(key) || { type, id, owners: 0 };
        room.owners++;
        roomsRef.current.set(key, room);
        const current = await ensureConnected();
        return current ? sendJoin(current, room) : UNAVAILABLE;
    }, [ensureConnected, ensureSocket, sendJoin]);

    const leaveRoom = useCallback((type: RoomEvent, resourceId = '') => {
        const id = normalizeText(resourceId);
        const key = roomKey(type, id);
        const room = roomsRef.current.get(key);
        if (!room || --room.owners > 0) return;
        roomsRef.current.delete(key);
        // Never buffer a stale leave while offline: the next connect restores only active rooms.
        if (socketRef.current?.connected) {
            socketRef.current.emit('leave:' + type, ...(id ? [id] : []));
        }
    }, []);

    const joinConversation = useCallback((id: string) => joinRoom('conversation', id), [joinRoom]);
    const leaveConversation = useCallback((id: string) => leaveRoom('conversation', id), [leaveRoom]);
    const joinCita = useCallback((id: string) => joinRoom('cita', id), [joinRoom]);
    const leaveCita = useCallback((id: string) => leaveRoom('cita', id), [leaveRoom]);
    const joinAdminMonitoring = useCallback(() => joinRoom('admin_monitoring'), [joinRoom]);
    const leaveAdminMonitoring = useCallback(() => leaveRoom('admin_monitoring'), [leaveRoom]);

    useEffect(() => {
        if (!token) { disposeSocket(); setLastError(''); }
        else if (socketRef.current && (socketRef.current.auth as { token?: string }).token !== token) disposeSocket();
    }, [disposeSocket, token]);
    useEffect(() => disposeSocket, [disposeSocket]);

    const value = useMemo(() => ({
        socket, isConnected, lastError, ensureConnected, joinConversation, leaveConversation,
        joinCita, leaveCita, joinAdminMonitoring, leaveAdminMonitoring,
    }), [socket, isConnected, lastError, ensureConnected, joinConversation, leaveConversation,
        joinCita, leaveCita, joinAdminMonitoring, leaveAdminMonitoring]);
    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) throw new Error('useSocket must be used within SocketProvider');
    return context;
}
