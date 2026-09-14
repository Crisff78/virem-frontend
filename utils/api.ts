import { apiUrl, BACKEND_URL } from '../config/backend';
import { getAuthToken } from './session';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
    authenticated?: boolean;
    authToken?: string;
    query?: Record<string, QueryValue>;
    signal?: AbortSignal;
    timeoutMs?: number;
};

type AuthFailureListener = (requestToken: string) => void;
const authFailureListeners = new Set<AuthFailureListener>();
export function subscribeToAuthFailure(listener: AuthFailureListener): () => void {
    authFailureListeners.add(listener);
    return () => { authFailureListeners.delete(listener); };
}
function notifyAuthFailure(token: string) {
    authFailureListeners.forEach(listener => listener(token));
}

const DEFAULT_TIMEOUT_MS = 10000;
async function withDeadline<T>(signal: AbortSignal | null | undefined, timeoutMs: number | undefined,
    run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = Number.isFinite(timeoutMs) && Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort = () => {};
    const interrupted = new Promise<never>((_resolve, reject) => {
        onAbort = () => {
            const error = new Error('Solicitud cancelada.'); error.name = 'AbortError';
            reject(error); controller.abort();
        };
        if (signal?.aborted) { onAbort(); return; }
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => {
            reject(new ApiError('La solicitud tardo demasiado. Intenta nuevamente.', 408, null));
            controller.abort();
        }, timeout);
    });
    try {
        return await Promise.race([interrupted, Promise.resolve().then(() => {
            if (controller.signal.aborted) { const error = new Error('Solicitud cancelada.'); error.name = 'AbortError'; throw error; }
            return run(controller.signal);
        })]);
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
    }
}

export class ApiError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

const toQueryString = (query?: Record<string, QueryValue>) => {
    if (!query) return '';

    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.append(key, String(value));
    });

    const raw = params.toString();
    return raw ? `?${raw}` : '';
};

const parseResponseBody = async (response: Response): Promise<any> => {
    const raw = await response.text();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
};

export class ApiClient {
    private readonly tokenProvider: () => Promise<string>;

    constructor(tokenProvider: () => Promise<string> = getAuthToken) {
        this.tokenProvider = tokenProvider;
    }

    private async send(path: string, init: RequestInit): Promise<Response> {
        const url = path.startsWith(BACKEND_URL + '/') ? path : apiUrl(path);
        if (/^https?:\/\//i.test(path) && !path.startsWith(BACKEND_URL + '/')) {
            throw new ApiError('Destino de API invalido.', 400, null);
        }
        const response = await fetch(url, init);
        const authorization = new Headers(init.headers).get('Authorization') || '';
        const requestToken = authorization.replace(/^Bearer\s+/i, '').trim();
        if ((response.status === 401 || response.status === 403) && /^Bearer\s+/i.test(authorization)) {
            notifyAuthFailure(requestToken);
        }
        // Include body download in the deadline; retain Response for legacy screens.
        const text = await response.text();
        return new Response([204, 205, 304].includes(response.status) ? null : text, {
            status: response.status, statusText: response.statusText, headers: response.headers,
        });
    }

    fetch(path: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
        const { timeoutMs, signal, ...init } = options;
        return withDeadline(signal, timeoutMs, nextSignal => this.send(path, { ...init, signal: nextSignal }));
    }

    async request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
        return withDeadline(options.signal, options.timeoutMs, async signal => {
            const headers: Record<string, string> = {
                Accept: 'application/json',
                ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {}),
            };

            if (options.authenticated) {
                const token = String(options.authToken || (await this.tokenProvider()) || '').trim();
                if (signal.aborted) { const error = new Error('Solicitud cancelada.'); error.name = 'AbortError'; throw error; }
                if (!token) {
                    notifyAuthFailure('');
                    throw new ApiError('AUTH_REQUIRED', 401, null);
                }
                headers.Authorization = `Bearer ${token}`;
            }

            if (signal.aborted) { const error = new Error('Solicitud cancelada.'); error.name = 'AbortError'; throw error; }
            const response = await this.send(`${path}${toQueryString(options.query)}`, {
                method: options.method || 'GET',
                headers,
                body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
                signal,
            });

            const data = await parseResponseBody(response);

            if (!response.ok) {
                const message =
                    (typeof data === 'object' && data && 'message' in data ? String((data as any).message) : '') ||
                    (typeof data === 'object' && data && 'error' in data ? String((data as any).error) : '') ||
                    `HTTP ${response.status}`;
                throw new ApiError(message, response.status, data);
            }

            return data as T;
        });
    }

    get<T = any>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
        return this.request<T>(path, { ...options, method: 'GET' });
    }

    post<T = any>(path: string, options: Omit<RequestOptions, 'method'> = {}) {
        return this.request<T>(path, { ...options, method: 'POST' });
    }

    put<T = any>(path: string, options: Omit<RequestOptions, 'method'> = {}) {
        return this.request<T>(path, { ...options, method: 'PUT' });
    }

    patch<T = any>(path: string, options: Omit<RequestOptions, 'method'> = {}) {
        return this.request<T>(path, { ...options, method: 'PATCH' });
    }

    delete<T = any>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
        return this.request<T>(path, { ...options, method: 'DELETE' });
    }
}

export const apiClient = new ApiClient();

export async function requestJson<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(path, options);
}
