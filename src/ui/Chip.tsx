import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';
import { PressableScale } from '@/ui/PressableScale';

export interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: AppIconName;
  rightIcon?: AppIconName;
  left?: React.ReactNode;
  variant?: 'surface' | 'sunken';
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  icon,
  rightIcon,
  left,
  variant = 'surface',
  onPress,
  accessibilityLabel,
  style,
  testID,
}: ChipProps) {
  const { theme, reducedMotion } = useTheme();

  const backgroundColor = selected
    ? theme.colors.accentSoft
    : variant === 'sunken'
      ? theme.colors.surfaceSunken
      : theme.colors.surface;

  const borderColor = selected
    ? theme.colors.accent
    : variant === 'sunken'
      ? 'transparent'
      : theme.colors.separator;

  const fgColor = selected ? theme.colors.accent : theme.colors.text;

  return (
    <PressableScale pressScale={0.94}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: theme.touch.min,
          borderRadius: theme.radius.chip,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
          backgroundColor,
          borderColor,
          opacity: pressed && !reducedMotion ? 0.85 : 1,
        },
        style,
      ]}
    >
      {left ? (
        <View style={styles.side}>{left}</View>
      ) : icon ? (
        <AppIcon
          name={icon}
          size={17}
          color={selected ? theme.colors.accent : theme.colors.textSecondary}
        />
      ) : null}
      <AppText variant="label" style={{ color: fgColor }} numberOfLines={1}>
        {label}
      </AppText>
      {rightIcon ? (
        <AppIcon
          name={rightIcon}
          size={15}
          color={selected ? theme.colors.accent : theme.colors.textSecondary}
        />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
