import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { hapticSelection } from './haptics';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'sm';
  disabled?: boolean;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  testID,
}: SegmentedControlProps<T>) {
  const { theme, reducedMotion } = useTheme();
  const isCompact = size === 'sm';
  const padding = 3;
  const itemMinHeight = isCompact ? 32 : theme.touch.min - padding * 2;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius.pill,
          padding,
          gap: 2,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            disabled={disabled}
            hitSlop={isCompact ? 6 : undefined}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, disabled }}
            onPress={() => {
              if (opt.value !== value) hapticSelection();
              onChange(opt.value);
            }}
            style={({ pressed }) => [
              styles.option,
              !isCompact && styles.optionFill,
              active && theme.scheme === 'light' ? theme.cardShadow : null,
              {
                minHeight: itemMinHeight,
                paddingHorizontal: isCompact ? theme.spacing.md : theme.spacing.lg,
                borderRadius: theme.radius.pill,
                backgroundColor: active
                  ? theme.colors.surfaceRaised
                  : 'transparent',
                opacity: pressed && !reducedMotion ? 0.84 : 1,
              },
            ]}
          >
            <AppText
              variant={isCompact ? 'caption' : 'label'}
              color={active ? 'text' : 'textSecondary'}
              numberOfLines={1}
            >
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
    alignItems: 'center',
    flexShrink: 1,
  },
  option: {
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionFill: {
    flex: 1,
  },
});
