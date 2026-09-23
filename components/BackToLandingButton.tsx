import React from 'react';
import { Pressable, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type Props = {
  /** Texto del botón. Por defecto "Volver al inicio". */
  label?: string;
  /** Color del icono y del texto. */
  color?: string;
  /** Estilos extra para el contenedor (p. ej. posición absoluta). */
  style?: ViewStyle | ViewStyle[];
};

/**
 * Botón reutilizable para regresar al Landing desde Login / Registro.
 * Si el Landing ya está en el stack vuelve a él; si se entró por enlace
 * directo, navega al Landing sin sacar al usuario de la app.
 */
const BackToLandingButton: React.FC<Props> = ({
  label = 'Volver al inicio',
  color = '#1F4770',
  style,
}) => {
  const navigation = useNavigation<any>();

  const goToLanding = () => {
    navigation.navigate('Landing');
  };

  return (
    <Pressable
      onPress={goToLanding}
      accessibilityRole="button"
      accessibilityLabel="Volver al inicio"
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
        pressed && styles.buttonPressed,
        style as any,
      ]}
    >
      <MaterialCommunityIcons name="arrow-left" size={20} color={color} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  buttonPressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BackToLandingButton;
