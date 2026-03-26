import { apiUrl } from '../config/backend';
import { getAuthToken } from './session';

type RequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    authenticated?: boolean;
};

export async function requestJson<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
    };

    if (options.authenticated) {
        const token = await getAuthToken();
        if (!token) {
            throw new Error('AUTH_REQUIRED');
        }
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(apiUrl(path), {
        method: options.method || 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const raw = await response.text();
    let data: any = null;
    try {
        data = raw ? JSON.parse(raw) : null;
    } catch {
        data = null;
    }

    if (!response.ok) {
        const message = data?.message || `HTTP ${response.status}`;
        const err = new Error(String(message));
        (err as any).status = response.status;
        (err as any).data = data;
        throw err;
    }

    return data as T;
}

