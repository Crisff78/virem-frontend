import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    clearSession,
    loadSession,
    saveSession,
    saveSessionUser,
    SessionSnapshot,
    subscribeToSession,
} from '../utils/session';
import { subscribeToAuthFailure } from '../utils/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue<TUser = Record<string, unknown>> = {
    status: AuthStatus;
    isReady: boolean;
    isAuthenticated: boolean;
    token: string;
    user: TUser | null;
    signIn: (token: string, user?: TUser | null) => Promise<SessionSnapshot<TUser>>;
    refreshSession: () => Promise<SessionSnapshot<TUser>>;
    updateUser: (user: TUser) => Promise<SessionSnapshot<TUser>>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const resolveStatus = (token: string): AuthStatus => (token ? 'authenticated' : 'anonymous');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [token, setToken] = useState('');
    const [user, setUser] = useState<Record<string, unknown> | null>(null);
    const tokenRef = useRef('');
    const logoutRef = useRef<Promise<void> | null>(null);
    const snapshotVersionRef = useRef(0);

    const syncSnapshot = useCallback((snapshot: SessionSnapshot<Record<string, unknown>>) => {
        snapshotVersionRef.current++;
        tokenRef.current = snapshot.token || '';
        setToken(snapshot.token || '');
        setUser(snapshot.user || null);
        setStatus(resolveStatus(snapshot.token || ''));
    }, []);

    const refreshSession = useCallback(async () => {
        const version = snapshotVersionRef.current;
        const snapshot = await loadSession<Record<string, unknown>>();
        if (version === snapshotVersionRef.current && !logoutRef.current) syncSnapshot(snapshot);
        return snapshot;
    }, [syncSnapshot]);

    const signIn = useCallback(
        async (nextToken: string, nextUser?: Record<string, unknown> | null) => {
            // A delayed logout must never erase a newly established session.
            await logoutRef.current;
            const snapshot = await saveSession(nextToken, nextUser === null ? undefined : nextUser);
            syncSnapshot(snapshot);
            return snapshot;
        },
        [syncSnapshot]
    );

    const updateUser = useCallback(
        async (nextUser: Record<string, unknown>) => {
            const snapshot = await saveSessionUser(nextUser);
            syncSnapshot(snapshot);
            return snapshot;
        },
        [syncSnapshot]
    );

    const signOut = useCallback(async () => {
        if (logoutRef.current) return logoutRef.current;
        syncSnapshot({ token: '', user: null });
        const pending = clearSession().then(() => undefined).finally(() => { logoutRef.current = null; });
        logoutRef.current = pending;
        return pending;
    }, [syncSnapshot]);

    useEffect(() => subscribeToAuthFailure(requestToken => {
        // Ignore failures from requests made by an older session.
        if (!tokenRef.current || (requestToken && requestToken !== tokenRef.current)) return;
        void signOut().catch(() => { /* Already anonymous even if device storage fails. */ });
    }), [signOut]);

    useEffect(() => {
        refreshSession().catch(() => {
            syncSnapshot({ token: '', user: null });
        });

        return subscribeToSession((snapshot) => {
            if (logoutRef.current && snapshot.token) return;
            syncSnapshot(snapshot as SessionSnapshot<Record<string, unknown>>);
        });
    }, [refreshSession, syncSnapshot]);

    const value = useMemo<AuthContextValue>(
        () => ({
            status,
            isReady: status !== 'loading',
            isAuthenticated: Boolean(token),
            token,
            user,
            signIn,
            refreshSession,
            updateUser,
            signOut,
        }),
        [refreshSession, signIn, signOut, status, token, updateUser, user]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth<TUser = Record<string, unknown>>() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }

    return context as AuthContextValue<TUser>;
}
