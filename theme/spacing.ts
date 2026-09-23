/**
 * Escala de espaciado (4-pt grid).
 * Usar siempre estas constantes en lugar de números mágicos.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 64,
} as const;

export type SpacingToken = keyof typeof spacing;

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radii;

/**
 * Padding horizontal recomendado por viewport.
 * Mobile: 16. Tablet: 24. Desktop: 32.
 */
export const horizontalPadding = (width: number): number => {
  if (width >= 1024) return spacing.xxl;
  if (width >= 600) return spacing.xl;
  return spacing.base;
};

/**
 * Ancho máximo del contenedor central por viewport.
 * Evita que el contenido se estire en monitores grandes.
 */
export const contentMaxWidth = (width: number): number => {
  if (width >= 1440) return 1280;
  if (width >= 1024) return 1024;
  return width;
};
