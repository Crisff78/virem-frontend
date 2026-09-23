/**
 * Skeleton placeholder component for loading states.
 */
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type Props = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
};

const Skeleton: React.FC<Props> = ({
  width = '100%',
  height = 20,
  borderRadius = 12,
  style,
}) => {
  const pulse = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height: height as any, borderRadius, opacity: pulse },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e2e8f0',
  },
});

export default Skeleton;
