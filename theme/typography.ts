/**
 * Escala tipográfica fija.
 * El escalado responsive se hace en useResponsive.fs() / typography (escala dinámica).
 * Estas constantes son tamaños base sin escalar — usar para tamaños fijos.
 */
export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export const fontSizes = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const lineHeights = {
  tight: 1.2,
  normal: 1.45,
  relaxed: 1.6,
} as const;

/**
 * Tope superior del system fontScale para que tipografías grandes
 * no rompan layouts. Usado en <Text maxFontSizeMultiplier>.
 */
export const MAX_FONT_SIZE_MULTIPLIER = 1.3;
