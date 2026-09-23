import { Platform } from 'react-native';

/**
 * Convierte un color hex (#rgb / #rrggbb) + opacidad a rgba.
 * Si ya es rgba/hsla/rgb/named se devuelve tal cual.
 */
const toRgba = (color: string, opacity: number): string => {
  const trimmed = color.trim();
  if (!trimmed.startsWith('#')) return trimmed;

  const hex = trimmed.slice(1);
  const expanded =
    hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.padEnd(6, '0').slice(0, 6);

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const safeOpacity = Math.max(0, Math.min(1, opacity));
  return `rgba(${r}, ${g}, ${b}, ${safeOpacity})`;
};

/**
 * Sombra cross-platform. En web genera boxShadow con opacidad real
 * (antes la opacidad se perdía). En nativo usa los props clásicos.
 */
export const shadow = (
  color: string = '#000',
  opacity: number = 0.1,
  radius: number = 10,
  offset: { width: number; height: number } = { width: 0, height: 2 },
  elevation: number = 5
): any => {
  return Platform.select({
    web: {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${toRgba(color, opacity)}`,
    },
    default: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: offset,
      elevation,
    },
  });
};

export const textShadow = (
  color: string = 'rgba(0,0,0,0.5)',
  offset: { width: number; height: number } = { width: 0, height: 2 },
  radius: number = 4
): any => {
  return Platform.select({
    web: {
      textShadow: `${offset.width}px ${offset.height}px ${radius}px ${color}`,
    },
    default: {
      textShadowColor: color,
      textShadowOffset: offset,
      textShadowRadius: radius,
    },
  });
};
