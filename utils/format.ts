/**
 * Shared formatting and text normalization utilities used across all screens.
 */

/** Collapse whitespace and trim. */
export const normalizeString = (value: unknown): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

/** Normalize for search: strip accents, lowercase, collapse whitespace. */
export const normalizeForSearch = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Strip non-digit characters and optionally cap length. */
export const normalizeDigits = (value: unknown, maxLength?: number): string => {
  const digits = String(value || '').replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
};

/** Return a clean photo URL or empty string (rejects blob: URLs). */
export const sanitizeFotoUrl = (value: unknown): string => {
  const clean = normalizeString(value);
  if (!clean) return '';
  if (clean.toLowerCase().startsWith('blob:')) return '';
  return clean;
};

/** Parse a date string to epoch ms; returns +Infinity if unparseable. */
export const parseDateMs = (value: string | null | undefined): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

/** Format a date string into a locale-friendly short representation. */
export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return 'Sin horario';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin horario';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** Format a date with full year. */
export const formatDateTimeFull = (value: string | null | undefined): string => {
  if (!value) return 'Sin horario';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin horario';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** Human-friendly relative future label ("en X min", "en X h", etc). */
export const formatRelativeIn = (value: string | null | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= 0) return 'Inicia pronto';
  if (diffMin < 60) return `en ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `en ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  return `en ${diffDay} dia(s)`;
};

/** Human-friendly relative past label ("hace X min", "hace X h", etc). */
export const toRelativeTime = (value: string | null | undefined): string => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Ahora';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return 'hace segundos';
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `hace ${diffDay} dia(s)`;
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** Format a price value using DOP currency. */
export const formatPrice = (value: number | null | undefined): string => {
  if (!Number.isFinite(value as number) || Number(value) <= 0) return 'No especificado';
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 2,
  }).format(Number(value));
};

/** Safely parse JSON or return null. */
export const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** Extract user ID from varying field names. */
export const extractUserId = (value: unknown): string => {
  const source = (value || {}) as Record<string, unknown>;
  return normalizeString(source.usuarioid || source.id);
};

/** Prefix a doctor name with "Dr." if not already present. */
export const addDoctorPrefix = (rawName: string): string => {
  const clean = normalizeString(rawName);
  if (!clean) return 'Doctor';
  const normalized = clean.toLowerCase();
  if (normalized.startsWith('dr ') || normalized.startsWith('dr.')) return clean;
  return `Dr. ${clean}`;
};

/** Convert a raw date value to YYYY-MM-DD format for SQL comparison. */
export const toComparableSqlDate = (rawValue: unknown): string => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (isoPrefix?.[1]) return isoPrefix[1];

  const parts = raw.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (/^\d+$/.test(dd) && /^\d+$/.test(mm) && /^\d+$/.test(yyyy)) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Safe integer parsing. */
export const toInt = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};
