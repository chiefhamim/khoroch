import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

export interface SettingsRowProps {
  label: string;
  subtitle?: string;
  value?: string;
  icon?: AppIconName;
  left?: React.ReactNode;
  trailing?: React.ReactNode;
  locked?: boolean;
  showChevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function SettingsRow({
  label,
  subtitle,
  value,
  icon,
  left,
  trailing,
  locked = false,
  showChevron = false,
  destructive = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  testID,
}: SettingsRowProps) {
  const { theme, reducedMotion } = useTheme();
  const fgColor = destructive ? 'danger' : 'text';

  const rowBody = (
    <View
      style={[
        styles.row,
        {
          minHeight: 56,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
          opacity: disabled && !locked ? 0.5 : 1,
        },
      ]}
    >
      {left ? (
        <View style={styles.left}>{left}</View>
      ) : icon ? (
        <AppIcon
          name={icon}
          size={19}
          color={destructive ? theme.colors.danger : theme.colors.textSecondary}
        />
      ) : null}

      <View style={styles.center}>
        <AppText variant="bodyStrong" color={fgColor}>
          {label}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.right, { gap: theme.spacing.xs }]}>
        {value ? (
          <AppText variant="body" color="textSecondary" numberOfLines={1}>
            {value}
          </AppText>
        ) : null}
        {locked ? (
          <AppIcon name="lock" size={15} color={theme.colors.textTertiary} />
        ) : null}
        {trailing}
        {showChevron && !locked ? (
          <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
        ) : null}
      </View>
    </View>
  );

  if (!onPress || disabled) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel ?? label}>
        {rowBody}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${label}, ${value}` : label)}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed && !reducedMotion ? 0.72 : 1,
      })}
    >
      {rowBody}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
