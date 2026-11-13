import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { CategoryColorKey } from '@/domain/types';
import { getCategoryTileVisual } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';

export interface IconTileProps {
  icon?: AppIconName | null;
  colorKey?: CategoryColorKey | string | null;
  size?: 'sm' | 'md' | 'lg' | number;
  selected?: boolean;
  neutral?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconTile({
  icon,
  colorKey = 'gray',
  size = 'md',
  selected = false,
  neutral = false,
  style,
  testID,
}: IconTileProps) {
  const { theme } = useTheme();
  const boxSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
        ? 32
        : size === 'lg'
          ? 48
          : theme.geometry.iconTile;
  const glyphSize = Math.round(boxSize * 0.48);

  const visual = neutral
    ? { fg: theme.colors.textSecondary, bg: theme.colors.surfaceSunken }
    : getCategoryTileVisual(colorKey, theme.scheme);

  return (
    <View
      testID={testID}
      style={[
        styles.tile,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: theme.radius.iconTile,
          backgroundColor: visual.bg,
          borderWidth: selected ? 2 : 0,
          borderColor: selected ? visual.fg : 'transparent',
        },
        style,
      ]}
    >
      <AppIcon name={icon ?? 'circle-ellipsis'} size={glyphSize} color={visual.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
