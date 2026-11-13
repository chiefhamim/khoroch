import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { AvatarColorKey } from '@/domain/types';
import { CATEGORY_COLORS, hexToRgba, isCategoryColorKey } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

export interface ProfileAvatarProps {
  name: string;
  colorKey?: AvatarColorKey;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function getProfileAvatarColors(
  colorKey: AvatarColorKey | undefined,
  theme: { scheme: 'light' | 'dark'; colors: { accent: string; accentSoft: string } }
): { bg: string; fg: string } {
  if (!colorKey || colorKey === 'accent') {
    return { bg: theme.colors.accentSoft, fg: theme.colors.accent };
  }
  if (isCategoryColorKey(colorKey)) {
    const spec = CATEGORY_COLORS[colorKey];
    const fg = theme.scheme === 'dark' ? spec.dark : spec.light;
    return {
      bg: hexToRgba(fg, theme.scheme === 'dark' ? 0.2 : 0.14),
      fg,
    };
  }
  return { bg: theme.colors.accentSoft, fg: theme.colors.accent };
}

export function getProfileInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export function ProfileAvatar({
  name,
  colorKey = 'accent',
  size = 40,
  style,
  testID,
}: ProfileAvatarProps) {
  const { theme } = useTheme();
  const colors = getProfileAvatarColors(colorKey, theme);
  const initial = getProfileInitial(name);

  return (
    <View
      testID={testID}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.bg,
        },
        style,
      ]}
    >
      <AppText
        variant={size >= 44 ? 'headline' : 'bodyStrong'}
        style={{
          color: colors.fg,
          fontWeight: '700',
        }}
      >
        {initial}
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
