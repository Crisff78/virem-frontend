import Constants from 'expo-constants';
import { Platform } from 'react-native';

const WEB_LOCAL_BACKEND_URL = 'http://localhost:3000';
const PUBLIC_FALLBACK_BACKEND_URL = 'https://virem-backend.onrender.com';

type ExpoConstantsHostShape = {
  expoConfig?: { hostUri?: string | null };
  manifest2?: { extra?: { expoClient?: { hostUri?: string | null } } };
  manifest?: { debuggerHost?: string | null };
};

const extractHostFromUri = (hostUri?: string | null): string | null => {
  if (!hostUri) return null;

  const [host] = hostUri.split(':');
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;
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

const isLocalWebHost = (): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
};

const isLoopbackUrl = (value: string): boolean => {
  try {
    const { hostname } = new URL(value);
    const host = String(hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
};

const resolveDefaultBackendUrl = (): string => {
  if (Platform.OS === 'web') {
    return isLocalWebHost() ? WEB_LOCAL_BACKEND_URL : PUBLIC_FALLBACK_BACKEND_URL;
  }
  return resolveNativeDevBackendUrl() || PUBLIC_FALLBACK_BACKEND_URL;
};

const normalizeEnvUrl = (value: string): string =>
  value.trim().replace(/^['"]+/, '').replace(/['"]+$/, '');

const compileTimeEnvBackendUrl = String(
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) || ''
);
const runtimeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process;
const runtimeEnvBackendUrl = String(runtimeProcess?.env?.EXPO_PUBLIC_BACKEND_URL || '');
const rawEnvBackendUrl = normalizeEnvUrl(compileTimeEnvBackendUrl || runtimeEnvBackendUrl);
const envBackendUrl =
  Platform.OS === 'web' && !isLocalWebHost() && isLoopbackUrl(rawEnvBackendUrl)
    ? ''
    : rawEnvBackendUrl;

export const BACKEND_URL = envBackendUrl || resolveDefaultBackendUrl();

export const apiUrl = (path: string) =>
  `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
