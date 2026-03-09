import Constants from 'expo-constants';
import { Platform } from 'react-native';

const WEB_DEFAULT_BACKEND_URL = 'http://localhost:3000';
const MOBILE_FALLBACK_BACKEND_URL = 'https://virem-backend.onrender.com';

type ExpoConstantsHostShape = {
  expoConfig?: { hostUri?: string | null };
  manifest2?: { extra?: { expoClient?: { hostUri?: string | null } } };
  manifest?: { debuggerHost?: string | null };
};

const extractHostFromUri = (hostUri?: string | null): string | null => {
  if (!hostUri) return null;

  const [host] = hostUri.split(':');
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
};

const resolveNativeDevBackendUrl = (): string | null => {
  const expoConstants = Constants as unknown as ExpoConstantsHostShape;

  const host =
    extractHostFromUri(expoConstants.expoConfig?.hostUri) ||
    extractHostFromUri(expoConstants.manifest2?.extra?.expoClient?.hostUri) ||
    extractHostFromUri(expoConstants.manifest?.debuggerHost);

  if (!host) return null;
  return `http://${host}:3000`;
};

const resolveDefaultBackendUrl = (): string => {
  if (Platform.OS === 'web') return WEB_DEFAULT_BACKEND_URL;
  return resolveNativeDevBackendUrl() || MOBILE_FALLBACK_BACKEND_URL;
};

const envBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

export const BACKEND_URL = envBackendUrl || resolveDefaultBackendUrl();

export const apiUrl = (path: string) =>
  `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
