import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { addDays, formatLocalDate, parseLocalDate, todayLocalDate } from '@/domain/dates';
import type { LocalDate, LocalTime } from '@/domain/types';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';
import { Chip } from './Chip';
import { Sheet } from './Sheet';

type PickerMode = 'date' | 'time';

export interface DateTimeSheetProps {
  visible: boolean;
  mode: PickerMode;
  date?: LocalDate;
  time?: LocalTime;
  onDateChange?: (date: LocalDate) => void;
  onTimeChange?: (time: LocalTime) => void;
  onClose: () => void;
}

const PARTS = [
  { label: 'Morning', time: '09:00' },
  { label: 'Noon', time: '13:00' },
  { label: 'Evening', time: '18:00' },
  { label: 'Night', time: '21:00' },
] as const;

function dayLabel(date: LocalDate, today: LocalDate): string {
  if (date === today) return t('common.today');
  if (date === addDays(today, -1)) return t('common.yesterday');
  return new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' }).format(
    new Date(`${date}T12:00:00`)
  );
}

export function DateTimeSheet({
  visible,
  mode,
  date,
  time,
  onDateChange,
  onTimeChange,
  onClose,
}: DateTimeSheetProps) {
  const { theme } = useTheme();
  const today = todayLocalDate();
  const [showEarlier, setShowEarlier] = useState(false);
  const [exact, setExact] = useState(false);
  const [draftDate, setDraftDate] = useState<LocalDate>(date ?? today);
  const [draftTime, setDraftTime] = useState<LocalTime>(time ?? '21:00');
  const recentDates = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDays(today, -index)),
    [today]
  );
  const monthDays = useMemo(() => {
    const parsed = parseLocalDate(draftDate);
    const first = formatLocalDate(parsed.year, parsed.month, 1);
    const days = new Date(parsed.year, parsed.month, 0).getDate();
    return Array.from({ length: days }, (_, index) => addDays(first, index));
  }, [draftDate]);
  const [hour, minute] = draftTime.split(':').map(Number);

  const selectDate = (next: LocalDate) => {
    setDraftDate(next);
    onDateChange?.(next);
    onClose();
  };
  const selectTime = (next: LocalTime) => {
    setDraftTime(next);
    onTimeChange?.(next);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={mode === 'date' ? t('common.pickDate') : t('common.time')}
      scroll
    >
      {mode === 'date' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {recentDates.map((item) => (
              <Chip
                key={item}
                label={dayLabel(item, today)}
                selected={item === draftDate}
                onPress={() => setDraftDate(item)}
              />
            ))}
            <Chip
              label={t('dateTime.earlier')}
              selected={showEarlier}
              onPress={() => setShowEarlier((current) => !current)}
            />
          </ScrollView>
          {showEarlier ? (
            <View style={[styles.calendar, { borderColor: theme.colors.separator }]}>
              {monthDays.map((item) => (
                <Chip
                  key={item}
                  label={String(parseLocalDate(item).day)}
                  selected={item === draftDate}
                  onPress={() => setDraftDate(item)}
                  style={styles.day}
                />
              ))}
            </View>
          ) : null}
          <Button title={t('common.done')} onPress={() => selectDate(draftDate)} />
        </>
      ) : (
        <>
          <View style={styles.wrap}>
            {PARTS.map((part) => (
              <Chip
                key={part.time}
                label={part.label}
                selected={draftTime === part.time}
                onPress={() => selectTime(part.time)}
              />
            ))}
            <Chip
              label={t('dateTime.exactTime')}
              selected={exact}
              onPress={() => setExact(true)}
            />
          </View>
          {exact ? (
            <View style={styles.wrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {Array.from({ length: 24 }, (_, item) => (
                  <Chip
                    key={item}
                    label={String(item).padStart(2, '0')}
                    selected={hour === item}
                    onPress={() => setDraftTime(`${String(item).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)}
                  />
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {Array.from({ length: 12 }, (_, item) => item * 5).map((item) => (
                  <Chip
                    key={item}
                    label={String(item).padStart(2, '0')}
                    selected={minute === item}
                    onPress={() => setDraftTime(`${String(hour).padStart(2, '0')}:${String(item).padStart(2, '0')}`)}
                  />
                ))}
              </ScrollView>
              <Button title={t('common.done')} onPress={() => selectTime(draftTime)} />
            </View>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  wrap: { gap: 8 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  day: { width: '13%' },
});
