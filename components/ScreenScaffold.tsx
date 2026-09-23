import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StatusBar,
  StatusBarStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  /** Hace que el contenido sea scrollable verticalmente. */
  scroll?: boolean;
  /** Centra verticalmente el contenido (sólo cuando scroll=false). */
  center?: boolean;
  /** Edges del SafeArea. Default: top + left + right + bottom. */
  edges?: Edge[];
  /** Color de fondo del scaffold. */
  background?: string;
  /** Estilo del contenedor principal. */
  style?: StyleProp<ViewStyle>;
  /** Estilo del contenedor del contenido (dentro del scroll). */
  contentStyle?: StyleProp<ViewStyle>;
  /** StatusBar style. */
  statusBarStyle?: StatusBarStyle;
  /** Props adicionales para el ScrollView. */
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
  /** Desactiva KeyboardAvoidingView (raro). */
  disableKeyboardAvoid?: boolean;
};

/**
 * Wrapper estándar de pantalla:
 * - SafeArea en bordes correctos (notch, home indicator).
 * - KeyboardAvoidingView en iOS para que el teclado no tape inputs.
 * - ScrollView opcional con keyboardShouldPersistTaps='handled'.
 *
 * Ningún contenido se pierde por teclado / notch / barra inferior si se usa esto.
 */
export const ScreenScaffold: React.FC<Props> = ({
  children,
  scroll = true,
  center = false,
  edges = ['top', 'left', 'right', 'bottom'],
  background = colors.bg,
  style,
  contentStyle,
  statusBarStyle = 'dark-content',
  scrollProps,
  disableKeyboardAvoid = false,
}) => {
  const Body = (
    <View style={[styles.flex, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            center && styles.scrollCenter,
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, center && styles.center, contentStyle]}>{children}</View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background }]} edges={edges}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={background} />
      {disableKeyboardAvoid ? (
        Body
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {Body}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  scrollCenter: { justifyContent: 'center' },
  center: { justifyContent: 'center', alignItems: 'center' },
});
