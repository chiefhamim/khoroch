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
  const glyphSize = Math.round(boxSize * 0.5);

  const fg = neutral
    ? theme.colors.textSecondary
    : getCategoryTileVisual(colorKey, theme.scheme).fg;

  return (
    <View
      testID={testID}
      style={[
        styles.tile,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: theme.radius.iconTile,
          backgroundColor: theme.colors.surfaceSunken,
          borderWidth: selected ? 2 : 0,
          borderColor: selected ? fg : 'transparent',
        },
        style,
      ]}
    >
      <AppIcon name={icon ?? 'shapes'} size={glyphSize} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
