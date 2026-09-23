/**
 * Helpers de texto reutilizables (antes duplicados en 19+ archivos).
 */

export const normalizeText = (value: unknown): string =>
  String(value || '').replace(/\s+/g, ' ').trim();

export const trimText = (value: unknown): string => String(value || '').trim();

export const parseJson = <T = unknown>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};
