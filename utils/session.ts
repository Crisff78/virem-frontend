import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const AUTH_TOKEN_KEY = 'authToken';
export const LEGACY_TOKEN_KEY = 'token';
export const USER_PROFILE_KEY = 'userProfile';
export const USER_KEY = 'user';

const isWeb = Platform.OS === 'web';
const SESSION_KEYS = [AUTH_TOKEN_KEY, LEGACY_TOKEN_KEY, USER_PROFILE_KEY, USER_KEY];

export type SessionSnapshot<TUser = unknown> = {
    token: string;
    user: TUser | null;
};

type SessionListener = (snapshot: SessionSnapshot) => void;

const sessionListeners = new Set<SessionListener>();

const normalizeText = (value: unknown): string => String(value || '').trim();

const parseJson = <T,>(raw: string | null): T | null => {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

const notifySessionListeners = (snapshot: SessionSnapshot) => {
    sessionListeners.forEach((listener) => {
        try {
            listener(snapshot);
        } catch {
            // noop
        }
    });
};

const getWebItem = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const setWebItem = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // noop
    }
};

const removeWebItems = (keys: string[]) => {
    try {
        keys.forEach((key) => localStorage.removeItem(key));
    } catch {
        // noop
    }
};

const readRawUser = async (): Promise<string | null> => {
    if (isWeb) {
        return getWebItem(USER_PROFILE_KEY) || getWebItem(USER_KEY);
    }

    const secureUser =
        (await SecureStore.getItemAsync(USER_PROFILE_KEY)) ||
        (await SecureStore.getItemAsync(USER_KEY));
    if (secureUser) return secureUser;

    return (
        (await AsyncStorage.getItem(USER_PROFILE_KEY)) ||
        (await AsyncStorage.getItem(USER_KEY))
    );
};

export async function getAuthToken(): Promise<string> {
    if (isWeb) {
        const token = getWebItem(AUTH_TOKEN_KEY) || getWebItem(LEGACY_TOKEN_KEY);
        return normalizeText(token);
    }

    const secureToken =
        (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
        (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
    if (secureToken?.trim()) return normalizeText(secureToken);

    const asyncToken =
        (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
        (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    return normalizeText(asyncToken);
}

export async function getSessionUser<TUser = Record<string, unknown>>(): Promise<TUser | null> {
    const rawUser = await readRawUser();
    return parseJson<TUser>(rawUser);
}

export async function loadSession<TUser = Record<string, unknown>>(): Promise<SessionSnapshot<TUser>> {
    const [token, user] = await Promise.all([getAuthToken(), getSessionUser<TUser>()]);
    return {
        token,
        user,
    };
}

export async function saveSession<TUser = Record<string, unknown>>(
    token?: string,
    userProfile?: TUser
): Promise<SessionSnapshot<TUser>> {
    if (isWeb) {
        if (token) {
            setWebItem(AUTH_TOKEN_KEY, token);
            setWebItem(LEGACY_TOKEN_KEY, token);
        }
        if (userProfile !== undefined) {
            const raw = JSON.stringify(userProfile);
            setWebItem(USER_PROFILE_KEY, raw);
            setWebItem(USER_KEY, raw);
        }
        const snapshot = await loadSession<TUser>();
        notifySessionListeners(snapshot);
        return snapshot;
    }

    if (token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        await SecureStore.setItemAsync(LEGACY_TOKEN_KEY, token);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
        await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
    }

    if (userProfile !== undefined) {
        const raw = JSON.stringify(userProfile);
        await SecureStore.setItemAsync(USER_PROFILE_KEY, raw);
        await SecureStore.setItemAsync(USER_KEY, raw);
        await AsyncStorage.setItem(USER_PROFILE_KEY, raw);
        await AsyncStorage.setItem(USER_KEY, raw);
    }

    const snapshot = await loadSession<TUser>();
    notifySessionListeners(snapshot);
    return snapshot;
}

export async function saveSessionUser<TUser = Record<string, unknown>>(
    userProfile: TUser
): Promise<SessionSnapshot<TUser>> {
    return saveSession<TUser>(undefined, userProfile);
}

export async function clearSessionUser(): Promise<SessionSnapshot> {
    if (isWeb) {
        removeWebItems([USER_PROFILE_KEY, USER_KEY]);
    } else {
        await AsyncStorage.multiRemove([USER_PROFILE_KEY, USER_KEY]);
        await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
    }

    const snapshot = await loadSession();
    notifySessionListeners(snapshot);
    return snapshot;
}

export async function clearSession(): Promise<SessionSnapshot> {
    if (isWeb) {
        removeWebItems(SESSION_KEYS);
    } else {
        await AsyncStorage.multiRemove(SESSION_KEYS);
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
    }

    const snapshot = { token: '', user: null };
    notifySessionListeners(snapshot);
    return snapshot;
}

export function subscribeToSession(listener: SessionListener): () => void {
    sessionListeners.add(listener);
    return () => {
        sessionListeners.delete(listener);
    };
}

