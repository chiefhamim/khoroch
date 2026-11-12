import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';

const VALID_IONICONS = Ionicons.glyphMap as Record<string, unknown>;

export function resolveIoniconName(icon: string | undefined | null): keyof typeof Ionicons.glyphMap {
  if (icon && icon in VALID_IONICONS) {
    return icon as keyof typeof Ionicons.glyphMap;
  }
  return 'ellipsis-horizontal';
}

export interface CategoryIconProps {
  icon?: string | null;
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'primary' | 'income' | 'expense';
}

export function CategoryIcon({
  icon,
  size = 'md',
  tone = 'neutral',
}: CategoryIconProps) {
  const { theme } = useTheme();
  const boxSize = size === 'sm' ? theme.spacing.xxxl : theme.touch.min - theme.spacing.xs;
  const iconSize = size === 'sm' ? 16 : 20;

  const fgColor =
    tone === 'primary'
      ? theme.colors.primary
      : tone === 'income'
        ? theme.colors.income
        : tone === 'expense'
          ? theme.colors.expense
          : theme.colors.text;

  const bgColor =
    tone === 'primary' ? theme.colors.primarySoft : theme.colors.surfaceAlt;

  return (
    <View
      style={[
        styles.circle,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: theme.radius.pill,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Ionicons name={resolveIoniconName(icon)} size={iconSize} color={fgColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
