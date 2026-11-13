import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

export interface IconButtonProps {
  icon?: AppIconName;
  children?: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'surface' | 'sunken' | 'ghost' | 'accent' | 'accentSoft';
  size?: number;
  iconSize?: number;
  badgeCount?: number;
  iconColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({
  icon,
  children,
  onPress,
  accessibilityLabel,
  variant = 'sunken',
  size = 40,
  iconSize = 20,
  badgeCount,
  iconColor,
  disabled = false,
  style,
  testID,
}: IconButtonProps) {
  const { theme, reducedMotion } = useTheme();

  const backgroundColor =
    variant === 'accent'
      ? theme.colors.accent
      : variant === 'accentSoft'
        ? theme.colors.accentSoft
        : variant === 'surface'
          ? theme.colors.surfaceRaised
          : variant === 'ghost'
            ? 'transparent'
            : theme.colors.surfaceSunken;

  const fgColor =
    variant === 'accent'
      ? theme.colors.onAccent
      : variant === 'accentSoft'
        ? theme.colors.accent
        : theme.colors.text;

  const hitMargin = Math.max(0, Math.ceil((theme.touch.min - size) / 2));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitMargin}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: theme.radius.pill,
          backgroundColor,
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: variant === 'surface' ? theme.colors.separator : 'transparent',
          opacity: disabled ? 0.45 : pressed && !reducedMotion ? 0.78 : 1,
        },
        style,
      ]}
    >
      {children ?? (icon ? <AppIcon name={icon} size={iconSize} color={iconColor ?? fgColor} /> : null)}
      {badgeCount !== undefined && badgeCount > 0 ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.pill,
              borderColor: theme.colors.bg,
            },
          ]}
        >
          <AppText variant="tab" color="onAccent" style={styles.badgeText}>
            {badgeCount > 9 ? '9+' : String(badgeCount)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
