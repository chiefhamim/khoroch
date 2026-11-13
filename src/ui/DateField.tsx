import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  formatFriendlyDate,
  isValidLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import type { LocalDate } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { DateTimeSheet } from './DateTimeSheet';
import { PressableScale } from '@/ui/PressableScale';

export interface DateFieldProps {
  value: LocalDate;
  onChange: (next: LocalDate) => void;
  label?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  today?: LocalDate;
  accessibilityLabel?: string;
  testID?: string;
}

export function DateField({
  value,
  onChange,
  label,
  maximumDate,
  minimumDate,
  today,
  accessibilityLabel,
  testID,
}: DateFieldProps) {
  const { theme, reducedMotion } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const todayRef = today ?? todayLocalDate();
  const display = isValidLocalDate(value)
    ? formatFriendlyDate(value, todayRef)
    : value;

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
      <View style={styles.wrap}>
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
          <AppIcon name="calendar" size={16} color={theme.colors.textSecondary} />
          <AppText variant="label" numberOfLines={1}>
            {display}
          </AppText>
          <AppIcon name="chevron-down" size={15} color={theme.colors.textTertiary} />
        </PressableScale>

      </View>
      <DateTimeSheet visible={pickerOpen} mode="date" date={value} onDateChange={onChange} onClose={() => setPickerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
