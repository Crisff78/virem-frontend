import { useWindowDimensions } from 'react-native';
import { contentMaxWidth, horizontalPadding } from '../theme/spacing';

// iPhone 14 Pro es la referencia de diseño base
const BASE_WIDTH = 390;

export const BREAKPOINTS = {
  smallPhone: 360,
  phone: 480,
  tablet: 600,
  desktop: 1024,
  wide: 1440,
} as const;

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isMobile  = width < BREAKPOINTS.tablet;
  const isTablet  = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop;

  const isSmallMobile  = width < BREAKPOINTS.smallPhone;
  const isLargeDesktop = width >= BREAKPOINTS.wide;
  const isPhone = isMobile;
  const isLandscape = width > height;

  // Escala tipografía relativa al ancho de pantalla.
  // Clamp: mínimo 75% (phones pequeños), máximo 160% (tablets grandes).
  const fs = (size: number): number => {
    const scale = Math.min(Math.max(width / BASE_WIDTH, 0.75), 1.15);
    return Math.round(size * scale);
  };

  // Escala espaciado y dimensiones (rango más conservador que fs).
  const rs = (size: number): number => {
    const scale = Math.min(Math.max(width / BASE_WIDTH, 0.8), 1.1);
    return Math.round(size * scale);
  };

  // Porcentaje del ancho/alto de pantalla
  const wp = (percent: number): number => (width  * percent) / 100;
  const hp = (percent: number): number => (height * percent) / 100;

  // Escala semántica de tipografía lista para usar en StyleSheet
  const typography = {
    xs:    fs(10),
    sm:    fs(12),
    base:  fs(14),
    lg:    fs(16),
    xl:    fs(18),
    '2xl': fs(22),
    '3xl': fs(28),
    '4xl': fs(34),
  };

  // Helper para elegir valor según breakpoint
  const select = <TMobile, TTablet = TMobile, TDesktop = TMobile>(
    options: { mobile: TMobile; tablet?: TTablet; desktop?: TDesktop }
  ): TMobile | TTablet | TDesktop => {
    if (isDesktop && options.desktop !== undefined) return options.desktop;
    if ((isTablet || isDesktop) && options.tablet !== undefined) return options.tablet;
    return options.mobile;
  };

  // Clamped spacing: never outside min/max whatever the device.
  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(rs(value), min), max);

  // Layout values shared with ResponsiveContainer.
  const paddingH = horizontalPadding(width);
  const maxContent = contentMaxWidth(width);

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isSmallMobile,
    isLargeDesktop,
    fs,
    rs,
    wp,
    hp,
    typography,
    select,
    isPhone,
    isLandscape,
    clamp,
    paddingH,
    maxContent,
  };
};
