import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

export interface CardProps {
  children: React.ReactNode;
  tone?: 'surface' | 'alt' | 'soft';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, tone = 'surface', padded = true, style }: CardProps) {
  const { theme } = useTheme();
  const backgroundColor =
    tone === 'alt'
      ? theme.colors.surfaceAlt
      : tone === 'soft'
        ? theme.colors.primarySoft
        : theme.colors.surface;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.xl,
          padding: padded ? theme.spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
