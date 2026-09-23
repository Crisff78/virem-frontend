/**
 * FadeInView — animates children with a fade-in on mount.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, type ViewProps } from 'react-native';

type Props = ViewProps & {
  duration?: number;
  delay?: number;
  children: React.ReactNode;
};

const FadeInView: React.FC<Props> = ({ duration = 400, delay = 0, children, style, ...rest }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [opacity, duration, delay]);

  return (
    <Animated.View style={[{ opacity }, style]} {...rest}>
      {children}
    </Animated.View>
  );
};

export default FadeInView;
