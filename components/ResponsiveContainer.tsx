import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Override del max-width (px). Por defecto usa el del breakpoint actual.
   */
  maxWidth?: number;
  /**
   * Padding horizontal extra. Por defecto el del breakpoint actual.
   */
  horizontalPadding?: number;
  /**
   * Si true, el contenedor crece para llenar el alto disponible.
   */
  flex?: boolean;
};

/**
 * Centra el contenido y aplica un ancho máximo razonable según breakpoint.
 * Evita que en pantallas anchas el contenido se estire infinito.
 */
export const ResponsiveContainer: React.FC<Props> = ({
  children,
  style,
  maxWidth,
  horizontalPadding,
  flex = false,
}) => {
  const { maxContent, paddingH } = useResponsive();
  const effectiveMaxWidth = maxWidth ?? maxContent;
  const effectivePadding = horizontalPadding ?? paddingH;

  return (
    <View
      style={[
        styles.container,
        flex && styles.flex,
        {
          maxWidth: effectiveMaxWidth,
          paddingHorizontal: effectivePadding,
          width: '100%',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  flex: {
    flex: 1,
  },
});
