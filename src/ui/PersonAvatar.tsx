import React from 'react';
import { StyleSheet, View } from 'react-native';
import { getPersonInitials } from '@/domain/dues';
import type { CategoryColorKey } from '@/domain/types';
import { CATEGORY_COLORS } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

export interface PersonAvatarProps {
  name: string;
  colorKey: CategoryColorKey;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  xs: { box: 24, font: 10 },
  sm: { box: 36, font: 13 },
  md: { box: 42, font: 15 },
  lg: { box: 56, font: 20 },
} as const;

export function PersonAvatar({ name, colorKey, size = 'md' }: PersonAvatarProps) {
  const { theme } = useTheme();
  const metrics = SIZE_MAP[size];
  const palette = CATEGORY_COLORS[colorKey] ?? CATEGORY_COLORS.blue;
  const tint = theme.scheme === 'dark' ? palette.dark : palette.light;
  const initials = getPersonInitials(name);

  return (
    <View
      style={[
        styles.circle,
        {
          width: metrics.box,
          height: metrics.box,
          borderRadius: metrics.box / 2,
          backgroundColor: `${tint}20`,
        },
      ]}
    >
      <AppText
        style={{
          color: tint,
          fontSize: metrics.font,
          fontFamily: 'PlusJakartaSans_600SemiBold',
        }}
      >
        {initials}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
