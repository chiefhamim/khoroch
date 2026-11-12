import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const { theme, reducedMotion } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceAlt,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.xs,
          gap: theme.spacing.xs,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, disabled }}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.option,
              {
                minHeight: theme.touch.min - theme.spacing.xs * 2,
                borderRadius: theme.radius.sm,
                backgroundColor: active ? theme.colors.surface : 'transparent',
                borderColor: active ? theme.colors.border : 'transparent',
                borderWidth: active ? 1 : 0,
                opacity: pressed && !reducedMotion ? 0.85 : 1,
              },
            ]}
          >
            <AppText variant="label" color={active ? 'primary' : 'textMuted'}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
