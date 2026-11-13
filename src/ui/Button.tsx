import React from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';
import { hapticLight } from './haptics';
import { PressableScale } from '@/ui/PressableScale';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';
  size?: 'md' | 'sm';
  leftIcon?: AppIconName;
  rightIcon?: AppIconName;
  haptics?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  haptics = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const { theme, reducedMotion } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? theme.colors.ink
      : variant === 'secondary'
        ? theme.colors.surface
        : variant === 'danger'
          ? theme.colors.danger
          : variant === 'dangerSoft'
            ? theme.colors.dangerSoft
            : 'transparent';

  const borderColor =
    variant === 'secondary' ? theme.colors.cardBorder : 'transparent';

  const textColor =
    variant === 'primary'
      ? 'onInk'
      : variant === 'danger'
        ? 'onDanger'
        : variant === 'dangerSoft'
          ? 'danger'
          : variant === 'ghost'
            ? 'accent'
            : 'text';

  const height =
    size === 'sm' ? theme.geometry.smallButtonHeight : theme.geometry.buttonHeight;

  const handlePress = () => {
    if (haptics) hapticLight();
    onPress();
  };

  return (
    <PressableScale pressScale={0.97}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 4 : undefined}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'sm' ? height : Math.max(height, theme.touch.min),
          borderRadius: size === 'sm' ? theme.radius.button : theme.radius.button,
          paddingHorizontal: size === 'sm' ? theme.spacing.lg : theme.spacing.xl,
          paddingVertical: size === 'sm' ? theme.spacing.sm : theme.spacing.md,
          gap: theme.spacing.sm,
          backgroundColor,
          borderColor,
          borderWidth: variant === 'secondary' ? 1 : 0,
          opacity: isDisabled
            ? 0.45
            : pressed && !reducedMotion
              ? 0.84
              : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors[textColor]} />
      ) : (
        <>
          {leftIcon ? (
            <AppIcon name={leftIcon} size={18} color={theme.colors[textColor]} />
          ) : null}
          <AppText
            variant={size === 'sm' ? 'label' : 'headline'}
            color={textColor}
            style={styles.label}
          >
            {title}
          </AppText>
          {rightIcon ? (
            <AppIcon name={rightIcon} size={18} color={theme.colors[textColor]} />
          ) : null}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    textAlign: 'center',
  },
});
