import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { formatFriendlyTime, isDevice24HourClock } from '@/domain/dates';
import type { LocalTime } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { Sheet } from './Sheet';

export interface TimeFieldProps {
  value: LocalTime;
  onChange: (next: LocalTime) => void;
  label?: string;
  use24Hour?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

function localTimeToDate(timeStr: LocalTime): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  const d = new Date();
  if (match) {
    const h = Number.parseInt(match[1], 10);
    const m = Number.parseInt(match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      d.setHours(h, m, 0, 0);
      return d;
    }
  }
  d.setHours(21, 0, 0, 0);
  return d;
}

function formatDateToHHmm(d: Date): LocalTime {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

type IosDateTimePickerComponent = React.ComponentType<{
  value: Date;
  mode: 'date' | 'time';
  display?: string;
  is24Hour?: boolean;
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

export function TimeField({
  value,
  onChange,
  label,
  use24Hour,
  accessibilityLabel,
  testID,
}: TimeFieldProps) {
  const { theme, reducedMotion } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const webInputRef = useRef<{ showPicker?: () => void; click?: () => void } | null>(null);

  const resolved24Hour = use24Hour ?? isDevice24HourClock();
  const display = value.trim() ? formatFriendlyTime(value, resolved24Hour) : 'Add time';

  const handleOpenPicker = () => {
    if (Platform.OS === 'android') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
        DateTimePickerAndroid.open({
          value: localTimeToDate(value),
          mode: 'time',
          is24Hour: resolved24Hour,
          onChange: (event: { type?: string }, selectedDate?: Date) => {
            if (event?.type === 'set' && selectedDate) {
              onChange(formatDateToHHmm(selectedDate));
            }
          },
        });
      } catch {
        // Native module unavailable
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
        value={localTimeToDate(value)}
        mode="time"
        display="spinner"
        is24Hour={resolved24Hour}
        onChange={(_e: unknown, selectedDate?: Date) => {
          if (selectedDate) {
            onChange(formatDateToHHmm(selectedDate));
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
        <Pressable
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
        </Pressable>

        {Platform.OS === 'web'
          ? React.createElement('input', {
              ref: webInputRef,
              type: 'time',
              'data-testid': testID ? `${testID}-web-input` : undefined,
              'aria-label': accessibilityLabel ?? label ?? 'Time',
              value,
              onChange: (e: { target?: { value?: string } }) => {
                const next = e.target?.value;
                if (next && /^\d{2}:\d{2}/.test(next)) {
                  onChange(next.slice(0, 5));
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
        <Sheet visible={iosOpen} onClose={() => setIosOpen(false)} title={label ?? 'Pick time'}>
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
