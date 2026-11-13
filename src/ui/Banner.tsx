import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

export interface BannerProps {
  message: string;
  icon?: AppIconName;
  tone?: 'accent' | 'danger' | 'neutral';
  onPress?: () => void;
  showChevron?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Banner({
  message,
  icon = 'repeat',
  tone = 'accent',
  onPress,
  showChevron,
  right,
  style,
  accessibilityLabel,
  testID,
}: BannerProps) {
  const { theme, reducedMotion } = useTheme();

  const backgroundColor =
    tone === 'danger'
      ? theme.colors.dangerSoft
      : tone === 'neutral'
        ? theme.colors.surfaceSunken
        : theme.colors.accentSoft;

  const fgColor =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'neutral'
        ? theme.colors.textSecondary
        : theme.colors.accent;

  const textKey = tone === 'danger' ? 'danger' : tone === 'neutral' ? 'text' : 'accent';
  const resolvedChevron = showChevron ?? Boolean(onPress && !right);

  const inner = (
    <View
      style={[
        styles.row,
        {
          minHeight: theme.touch.min,
          borderRadius: theme.radius.card,
          backgroundColor,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
        },
        style,
      ]}
    >
      <AppIcon name={icon} size={18} color={fgColor} />
      <AppText variant="label" color={textKey} style={styles.text} numberOfLines={2}>
        {message}
      </AppText>
      {right}
      {resolvedChevron ? (
        <AppIcon name="chevron-right" size={16} color={fgColor} />
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel ?? message}>
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? message}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed && !reducedMotion ? 0.85 : 1,
      })}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
  },
});
