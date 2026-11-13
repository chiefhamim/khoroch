import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatFriendlyTime, isDevice24HourClock } from '@/domain/dates';
import type { LocalTime } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { DateTimeSheet } from './DateTimeSheet';
import { SettingsRow } from './SettingsRow';
import { PressableScale } from '@/ui/PressableScale';

export interface TimeFieldProps {
  value: LocalTime;
  onChange: (next: LocalTime) => void;
  label?: string;
  use24Hour?: boolean;
  accessibilityLabel?: string;
  variant?: 'pill' | 'row';
  rowLabel?: string;
  testID?: string;
}

export function TimeField({
  value,
  onChange,
  label,
  use24Hour,
  accessibilityLabel,
  variant = 'pill',
  rowLabel,
  testID,
}: TimeFieldProps) {
  const { theme, reducedMotion } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const resolved24Hour = use24Hour ?? isDevice24HourClock();
  const display = value.trim() ? formatFriendlyTime(value, resolved24Hour) : 'Add time';

  const handleOpenPicker = () => {
    setPickerOpen(true);
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <AppText variant="label" color="textSecondary">
          {label}
        </AppText>
      ) : null}
      <View style={variant === 'row' ? styles.customWrap : styles.wrap}>
        {variant === 'row' ? (
          <SettingsRow
            testID={testID}
            label={rowLabel ?? label ?? 'Time'}
            value={display}
            showChevron
            accessibilityLabel={accessibilityLabel ?? `${rowLabel ?? label ?? 'Time'}, ${display}`}
            onPress={handleOpenPicker}
          />
        ) : (
          <PressableScale pressScale={0.985}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? (label ? `${label}: ${display}` : display)}
            hitSlop={4}
            onPress={handleOpenPicker}
            style={({ pressed }) => [
              styles.pill,
              {
                minHeight: 40,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.surfaceSunken,
                paddingHorizontal: theme.spacing.md,
                gap: theme.spacing.sm,
                opacity: pressed && !reducedMotion ? 0.8 : 1,
              },
            ]}
          >
            <AppIcon name="clock" size={16} color={theme.colors.textSecondary} />
            <AppText variant="label" numberOfLines={1} tabularNums>
              {display}
            </AppText>
            <AppIcon name="chevron-down" size={15} color={theme.colors.textTertiary} />
          </PressableScale>
        )}

      </View>
      <DateTimeSheet visible={pickerOpen} mode="time" time={value} onTimeChange={onChange} onClose={() => setPickerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  customWrap: {
    position: 'relative',
    width: '100%',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
