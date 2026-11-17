import React from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { containsBengali } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText, estimateBanglaWeightedUnits } from './AppText';
import { hapticLight } from './haptics';
import { PressableScale } from '@/ui/PressableScale';
import { glassFill, useGlass } from './glass';

/**
 * Estimates single-line dp width for short Bangla CTA labels in flex-row buttons.
 * Uses weighted glyph units so Yoga never over-pushes icons
 * while preventing Android Fabric from wrapping the trailing word onto a clipped line 2.
 */
function estimateBanglaCtaMinWidth(title: string, fontSize: number): number | undefined {
  const units = estimateBanglaWeightedUnits(title);
  if (units > 18) return undefined;
  const fontScale = Math.max(1, PixelRatio.getFontScale?.() ?? 1);
  return Math.ceil((units * (fontSize * 0.64) + 12) * fontScale);
}

export interface ButtonProps {
  title: string;
  onPress: () => void;
  /** Overrides the primary fill colour (used by onboarding steps). */
  tint?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';
  size?: 'md' | 'sm';
  leftIcon?: AppIconName;
  rightIcon?: AppIconName;
  haptics?: boolean;
  disabled?: boolean;
  loading?: boolean;
  numberOfLines?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  tint,
  size = 'md',
  leftIcon,
  rightIcon,
  haptics = false,
  disabled = false,
  loading = false,
  numberOfLines,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const { theme, reducedMotion } = useTheme();
  const glass = useGlass();
  const isDisabled = disabled || loading;

  const isFilled = variant === 'primary' || variant === 'danger';

  const backgroundColor =
    isDisabled && isFilled
      ? theme.colors.surfaceSunken
      : variant === 'primary'
        ? tint ?? theme.colors.accent
        : variant === 'secondary'
          ? glass
            ? glassFill(theme.colors).fill
            : theme.colors.surface
          : variant === 'danger'
            ? theme.colors.danger
            : variant === 'dangerSoft'
              ? theme.colors.dangerSoft
              : 'transparent';

  const textColor =
    isDisabled && isFilled
      ? 'textTertiary'
      : variant === 'primary'
        ? 'onAccent'
        : variant === 'danger'
          ? 'onDanger'
          : variant === 'dangerSoft'
            ? 'danger'
            : variant === 'ghost'
              ? 'accent'
              : 'text';

  const elevationStyle = isDisabled
    ? theme.elevation.none
    : isFilled
      ? theme.elevation.e2
      : variant === 'secondary'
        ? theme.elevation.e1
        : theme.elevation.none;

  const height =
    size === 'sm' ? theme.geometry.smallButtonHeight : theme.geometry.buttonHeight;
  const labelFontSize =
    size === 'sm' ? theme.typography.label.fontSize : theme.typography.headline.fontSize;
  const banglaMinWidth = containsBengali(title)
    ? estimateBanglaCtaMinWidth(title, labelFontSize)
    : undefined;

  const handlePress = () => {
    if (haptics) hapticLight();
    onPress();
  };

  return (
    <PressableScale
      pressScale={0.97}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 4 : undefined}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        elevationStyle,
        {
          minHeight: size === 'sm' ? height : Math.max(height, theme.touch.min),
          borderRadius: theme.radius.button,
          paddingHorizontal: size === 'sm' ? theme.spacing.lg : theme.spacing.xl,
          paddingVertical: size === 'sm' ? theme.spacing.sm : theme.spacing.md,
          gap: theme.spacing.sm,
          backgroundColor,
          opacity:
            isDisabled && !isFilled
              ? 0.55
              : pressed && !reducedMotion
                ? 0.88
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
            numberOfLines={numberOfLines}
            style={[styles.label, banglaMinWidth !== undefined ? { minWidth: banglaMinWidth } : null]}
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
    flexShrink: 1,
  },
});
