import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  formatFriendlyDate,
  formatLocalDate,
  isValidLocalDate,
  parseLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import type { LocalDate } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { Sheet } from './Sheet';
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

function localDateToNativeDate(dateStr: LocalDate): Date {
  if (!isValidLocalDate(dateStr)) return new Date();
  const { year, month, day } = parseLocalDate(dateStr);
  return new Date(year, month - 1, day, 12, 0, 0);
}

type IosDateTimePickerComponent = React.ComponentType<{
  value: Date;
  mode: 'date' | 'time';
  display?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  onChange: (e: unknown, selectedDate?: Date) => void;
}>;

function loadIosPickerComponent(): IosDateTimePickerComponent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-community/datetimepicker').default as IosDateTimePickerComponent;
  } catch {
    return null;
  }
}

const NativeIosPicker = Platform.OS === 'ios' ? loadIosPickerComponent() : null;

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
  const [iosOpen, setIosOpen] = useState(false);
  const webInputRef = useRef<{ showPicker?: () => void; click?: () => void } | null>(null);

  const todayRef = today ?? todayLocalDate();
  const display = isValidLocalDate(value)
    ? formatFriendlyDate(value, todayRef)
    : value;

  const handleOpenPicker = () => {
    if (Platform.OS === 'android') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
        DateTimePickerAndroid.open({
          value: localDateToNativeDate(value),
          mode: 'date',
          maximumDate,
          minimumDate,
          onChange: (event: { type?: string }, selectedDate?: Date) => {
            if (event?.type === 'set' && selectedDate) {
              onChange(
                formatLocalDate(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth() + 1,
                  selectedDate.getDate()
                )
              );
            }
          },
        });
      } catch {
        // Native module unavailable (e.g. unit test / Expo Go edge case)
      }
      return;
    }

    if (Platform.OS === 'web') {
      webInputRef.current?.showPicker?.();
      webInputRef.current?.click?.();
      return;
    }

    setIosOpen(true);
  };

  const iosPickerNode =
    Platform.OS === 'ios' && iosOpen && NativeIosPicker ? (
      <NativeIosPicker
        value={localDateToNativeDate(value)}
        mode="date"
        display="spinner"
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        onChange={(_e: unknown, selectedDate?: Date) => {
          if (selectedDate) {
            onChange(
              formatLocalDate(
                selectedDate.getFullYear(),
                selectedDate.getMonth() + 1,
                selectedDate.getDate()
              )
            );
          }
        }}
      />
    ) : null;

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

        {Platform.OS === 'web'
          ? React.createElement('input', {
              ref: webInputRef,
              type: 'date',
              'data-testid': testID ? `${testID}-web-input` : undefined,
              'aria-label': accessibilityLabel ?? label ?? 'Date',
              value,
              onChange: (e: { target?: { value?: string } }) => {
                const next = e.target?.value;
                if (next && isValidLocalDate(next)) {
                  onChange(next);
                }
              },
              style: {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                border: 'none',
              },
            })
          : null}
      </View>

      {Platform.OS === 'ios' ? (
        <Sheet visible={iosOpen} onClose={() => setIosOpen(false)} title={label ?? 'Pick date'}>
          {iosPickerNode}
          <Button title="Done" onPress={() => setIosOpen(false)} />
        </Sheet>
      ) : null}
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
