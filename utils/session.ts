import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const AUTH_TOKEN_KEY = 'authToken';
export const LEGACY_TOKEN_KEY = 'token';
export const USER_PROFILE_KEY = 'userProfile';
export const USER_KEY = 'user';

const isWeb = Platform.OS === 'web';

export async function getAuthToken(): Promise<string> {
    if (isWeb) {
        const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
        return String(token || '').trim();
    }

    const secureToken =
        (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
        (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
    if (secureToken?.trim()) return secureToken.trim();

    const asyncToken =
        (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
        (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    return String(asyncToken || '').trim();
}

export async function saveSession(token?: string, userProfile?: unknown): Promise<void> {
    if (isWeb) {
        if (token) {
            localStorage.setItem(AUTH_TOKEN_KEY, token);
            localStorage.setItem(LEGACY_TOKEN_KEY, token);
        }
        if (userProfile) {
            const raw = JSON.stringify(userProfile);
            localStorage.setItem(USER_PROFILE_KEY, raw);
            localStorage.setItem(USER_KEY, raw);
        }
        return;
    }

    if (token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        await SecureStore.setItemAsync(LEGACY_TOKEN_KEY, token);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
        await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
    }

    if (userProfile) {
        const raw = JSON.stringify(userProfile);
        await SecureStore.setItemAsync(USER_PROFILE_KEY, raw);
        await SecureStore.setItemAsync(USER_KEY, raw);
        await AsyncStorage.setItem(USER_PROFILE_KEY, raw);
        await AsyncStorage.setItem(USER_KEY, raw);
    }
}

export async function clearSession(): Promise<void> {
    if (isWeb) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        localStorage.removeItem(USER_PROFILE_KEY);
        localStorage.removeItem(USER_KEY);
        return;
    }

    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, LEGACY_TOKEN_KEY, USER_PROFILE_KEY, USER_KEY]);
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_PROFILE_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
}

