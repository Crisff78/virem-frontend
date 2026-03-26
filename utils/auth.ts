import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_KEY = 'authToken';
export const LEGACY_TOKEN_KEY = 'token';
export const STORAGE_KEY = 'user';
export const LEGACY_USER_STORAGE_KEY = 'userProfile';
export const MEDICO_CACHE_BY_EMAIL_KEY = 'medicoProfileByEmail';
export const SETTINGS_KEY = 'pacienteSettings';

/**
 * Retrieve the current auth token from the most reliable storage layer available.
 * Web uses localStorage; mobile tries SecureStore first, then AsyncStorage.
 */
export const getAuthToken = async (): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      return (
        localStorage.getItem(AUTH_TOKEN_KEY) ||
        localStorage.getItem(LEGACY_TOKEN_KEY) ||
        ''
      ).trim();
    }

    const secureToken =
      (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) ||
      (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY));
    if (secureToken && secureToken.trim()) return secureToken.trim();

    const asyncToken =
      (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
      (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    return String(asyncToken || '').trim();
  } catch {
    return '';
  }
};

/**
 * Save auth token + optional user profile into all storage layers.
 */
export const saveSession = async (token?: string, userProfile?: unknown): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(LEGACY_TOKEN_KEY, token);
      }
      if (userProfile) {
        const raw = JSON.stringify(userProfile);
        localStorage.setItem(LEGACY_USER_STORAGE_KEY, raw);
        localStorage.setItem(STORAGE_KEY, raw);
      }
    } catch (e) {
      console.log('localStorage save failed:', e);
    }
    return;
  }

  try {
    if (token) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      await SecureStore.setItemAsync(LEGACY_TOKEN_KEY, token);
      await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
    }
    if (userProfile) {
      const raw = JSON.stringify(userProfile);
      await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, raw);
      await AsyncStorage.setItem(STORAGE_KEY, raw);
    }
  } catch (e) {
    console.log('SecureStore save failed:', e);
  }
};

/**
 * Clear all auth-related storage (for logout).
 */
export const clearSession = async (): Promise<void> => {
  const keysToRemove = [AUTH_TOKEN_KEY, LEGACY_TOKEN_KEY, STORAGE_KEY, LEGACY_USER_STORAGE_KEY, 'user'];

  if (Platform.OS === 'web') {
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
    return;
  }

  for (const k of keysToRemove) {
    try {
      await SecureStore.deleteItemAsync(k);
    } catch {}
    try {
      await AsyncStorage.removeItem(k);
    } catch {}
  }
};

/**
 * Load raw user JSON from the best available storage source.
 */
export const loadRawUserFromStorage = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return (
        localStorage.getItem(LEGACY_USER_STORAGE_KEY) ||
        localStorage.getItem(STORAGE_KEY) ||
        null
      );
    }

    const secureRaw =
      (await SecureStore.getItemAsync(LEGACY_USER_STORAGE_KEY)) ||
      (await SecureStore.getItemAsync(STORAGE_KEY));
    if (secureRaw) return secureRaw;

    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Persist user profile data across all storage layers.
 */
export const persistUserProfile = async (user: unknown): Promise<void> => {
  const raw = JSON.stringify(user);

  try {
    await AsyncStorage.setItem(STORAGE_KEY, raw);
    await AsyncStorage.setItem('user', raw);
  } catch {}

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(LEGACY_USER_STORAGE_KEY, raw);
      localStorage.setItem('user', raw);
    } else {
      await SecureStore.setItemAsync(LEGACY_USER_STORAGE_KEY, raw);
    }
  } catch {}
};
