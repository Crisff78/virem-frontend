import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import colors from '../theme/colors';

export type FeedbackKind = 'success' | 'error' | 'info';

export type FeedbackState = {
  kind: FeedbackKind;
  message: string;
} | null;

type Props = {
  feedback: FeedbackState;
  onDismiss?: () => void;
  /** Optional: auto-dismiss after this many ms (default 4000). Pass 0 to disable. */
  autoHideMs?: number;
};

const PALETTE: Record<FeedbackKind, { bg: string; border: string; icon: any; iconColor: string; text: string }> = {
  success: {
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.35)',
    icon: 'check-circle',
    iconColor: colors.green,
    text: '#14532d',
  },
  error: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    icon: 'error-outline',
    iconColor: colors.red,
    text: '#7f1d1d',
  },
  info: {
    bg: 'rgba(19,127,236,0.10)',
    border: 'rgba(19,127,236,0.35)',
    icon: 'info-outline',
    iconColor: colors.primary,
    text: '#0f172a',
  },
};

const FeedbackBanner: React.FC<Props> = ({ feedback, onDismiss, autoHideMs = 4000 }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!feedback) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    if (autoHideMs > 0 && onDismiss) {
      const id = setTimeout(() => onDismiss(), autoHideMs);
      return () => clearTimeout(id);
    }
  }, [feedback, autoHideMs, onDismiss, opacity]);

  if (!feedback) return null;

  const palette = PALETTE[feedback.kind];

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <MaterialIcons name={palette.icon} size={20} color={palette.iconColor} />
      <Text style={[styles.message, { color: palette.text }]} numberOfLines={3}>
        {feedback.message}
      </Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <MaterialIcons name="close" size={18} color={palette.text} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default FeedbackBanner;
