import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { PressableScale } from '@/ui/PressableScale';
import { glassFill, useGlass } from './glass';

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
  const glass = useGlass();
  const tint = glass?.tint ?? null;
  const g = glassFill(theme.mode);

  const backgroundColor = selected
    ? tint
      ? `${tint}29`
      : theme.colors.accentSoft
    : variant === 'sunken'
      ? theme.colors.surfaceSunken
      : glass
        ? g.fill
        : theme.colors.surface;

  const borderColor = selected ? (tint ?? theme.colors.accent) : glass ? g.rim : 'transparent';
  const elevationStyle =
    !selected && variant === 'surface' ? theme.elevation.e1 : theme.elevation.none;

  const fgColor = selected ? (tint ?? theme.colors.accent) : theme.colors.text;

  return (
    <PressableScale
      pressScale={0.95}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        elevationStyle,
        {
          minHeight: theme.touch.min,
          borderRadius: theme.radius.chip,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
          backgroundColor,
          borderColor,
          borderWidth: selected ? 1.5 : glass ? 1 : 0,
          opacity: pressed && !reducedMotion ? 0.88 : 1,
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
      <AppText
        variant="label"
        style={{
          color: fgColor,
          minWidth: estimateSingleLineMinWidth(label, theme.typography.label.fontSize),
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
