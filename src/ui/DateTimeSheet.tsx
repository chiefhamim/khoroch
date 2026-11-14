import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  addDays,
  currentLocalTime,
  daysInMonth,
  formatFriendlyTime,
  formatLocalDate,
  formatMonthYear,
  formatShortDate,
  formatWeekdayDay,
  formatWeekdayDayMonth,
  getCalendarWeekdayLabels,
  isDevice24HourClock,
  parseLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import type { LocalDate, LocalTime, WeekStartDay } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { Button } from './Button';
import { hapticSelection } from './haptics';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';

type PickerMode = 'date' | 'time' | 'datetime';

export interface DateTimeSheetProps {
  visible: boolean;
  mode: PickerMode;
  date?: LocalDate;
  time?: LocalTime | null;
  onDateChange?: (date: LocalDate) => void;
  onTimeChange?: (time: LocalTime) => void;
  /** datetime mode: called once with both values when the person taps Done. */
  onChange?: (value: { date: LocalDate; time: LocalTime }) => void;
  onClose: () => void;
  maxDate?: LocalDate;
  minDate?: LocalDate;
  weekStartsOn?: WeekStartDay;
  use24Hour?: boolean;
  title?: string;
}

const WEEK_START_INDEX: Record<WeekStartDay, number> = { sunday: 0, monday: 1, saturday: 6 };
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day).getDay();
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function sanitizeTime(value: LocalTime | null | undefined): LocalTime {
  if (value && /^\d{2}:\d{2}$/.test(value)) return value;
  return currentLocalTime();
}

/* ---------------------------------------------------------------- Calendar */

function Calendar({
  value,
  onSelect,
  maxDate,
  minDate,
  weekStartsOn,
}: {
  value: LocalDate;
  onSelect: (date: LocalDate) => void;
  maxDate?: LocalDate;
  minDate?: LocalDate;
  weekStartsOn: WeekStartDay;
}) {
  const { theme } = useTheme();
  const locale = useLocale();
  const today = todayLocalDate();
  const initial = parseLocalDate(value);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // Follow selections made outside the grid (quick chips) into their month.
    setLastValue(value);
    if (initial.year !== view.year || initial.month !== view.month) {
      setView({ year: initial.year, month: initial.month });
    }
  }

  const firstIndex = WEEK_START_INDEX[weekStartsOn];
  const weekdayHeaders = getCalendarWeekdayLabels(weekStartsOn, locale);

  const cells = useMemo(() => {
    const first = formatLocalDate(view.year, view.month, 1);
    const lead = (weekdayOf(first) - firstIndex + 7) % 7;
    const count = daysInMonth(view.year, view.month);
    const out: (LocalDate | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d += 1) out.push(formatLocalDate(view.year, view.month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view, firstIndex]);

  const prev = shiftMonth(view.year, view.month, -1);
  const next = shiftMonth(view.year, view.month, 1);
  const canPrev = !minDate || formatLocalDate(prev.year, prev.month, daysInMonth(prev.year, prev.month)) >= minDate;
  const canNext = !maxDate || formatLocalDate(next.year, next.month, 1) <= maxDate;

  const rows: (LocalDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={styles.monthHeader}>
        <AppText variant="headline" accessibilityRole="header">
          {formatMonthYear(view.year, view.month, locale)}
        </AppText>
        <View style={[styles.monthNav, { gap: theme.spacing.xs }]}>
          {[
            { key: 'prev', icon: 'chevron-left' as const, enabled: canPrev, target: prev, label: t('dateTime.prevMonth') },
            { key: 'next', icon: 'chevron-right' as const, enabled: canNext, target: next, label: t('dateTime.nextMonth') },
          ].map((btn) => (
            <PressableScale
              key={btn.key}
              accessibilityRole="button"
              accessibilityLabel={btn.label}
              accessibilityState={{ disabled: !btn.enabled }}
              disabled={!btn.enabled}
              onPress={() => {
                hapticSelection();
                setView(btn.target);
              }}
              style={[
                styles.navBtn,
                {
                  borderRadius: theme.radius.pill,
                  borderColor: theme.colors.separator,
                  opacity: btn.enabled ? 1 : 0.35,
                },
              ]}
            >
              <AppIcon name={btn.icon} size={18} color={theme.colors.text} />
            </PressableScale>
          ))}
        </View>
      </View>

      <View style={styles.week}>
        {weekdayHeaders.map((name) => (
          <View key={name} style={styles.cell}>
            <AppText variant="caption" color="textTertiary" numberOfLines={1} style={styles.weekdayLabel}>
              {name}
            </AppText>
          </View>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.week}>
          {row.map((cell, cellIndex) => {
            if (!cell) return <View key={`e${cellIndex}`} style={styles.cell} />;
            const disabled = Boolean((maxDate && cell > maxDate) || (minDate && cell < minDate));
            const selected = cell === value;
            const isToday = cell === today;
            return (
              <View key={cell} style={styles.cell}>
                <PressableScale
                  pressScale={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={cell}
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    hapticSelection();
                    onSelect(cell);
                  }}
                  style={[
                    styles.day,
                    {
                      borderRadius: theme.radius.pill,
                      backgroundColor: selected ? theme.colors.accent : 'transparent',
                      borderWidth: isToday && !selected ? 1.5 : 0,
                      borderColor: theme.colors.accent,
                    },
                  ]}
                >
                  <AppText
                    variant={selected || isToday ? 'bodyStrong' : 'body'}
                    tabularNums
                    style={{
                      color: selected
                        ? theme.colors.onAccent
                        : disabled
                          ? theme.colors.textTertiary
                          : isToday
                            ? theme.colors.accent
                            : theme.colors.text,
                      opacity: disabled ? 0.38 : 1,
                    }}
                  >
                    {parseLocalDate(cell).day}
                  </AppText>
                </PressableScale>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- Time */

function TimePicker({
  value,
  onChange,
  use24Hour,
}: {
  value: LocalTime;
  onChange: (time: LocalTime) => void;
  use24Hour: boolean;
}) {
  const { theme } = useTheme();
  const [part, setPart] = useState<'hour' | 'minute'>('hour');
  const [h, m] = value.split(':').map(Number);
  const isPm = h >= 12;
  const hour12 = h % 12 === 0 ? 12 : h % 12;

  const setHour = (next: number) => {
    onChange(`${pad(next)}:${pad(m)}`);
    setPart('minute');
  };
  const setMinute = (next: number) => onChange(`${pad(h)}:${pad(next)}`);
  const setPeriod = (pm: boolean) => {
    if (pm === isPm) return;
    onChange(`${pad(pm ? (h % 12) + 12 : h % 12)}:${pad(m)}`);
  };

  const segment = (key: 'hour' | 'minute', label: string) => {
    const active = part === key;
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={key === 'hour' ? t('dateTime.hour') : t('dateTime.minute')}
        accessibilityState={{ selected: active }}
        onPress={() => {
          hapticSelection();
          setPart(key);
        }}
        style={[
          styles.timeSegment,
          {
            borderRadius: theme.radius.md,
            backgroundColor: active ? theme.colors.accentSoft : theme.colors.surfaceSunken,
            borderColor: active ? theme.colors.accent : 'transparent',
          },
        ]}
      >
        <AppText variant="display" tabularNums style={{ color: active ? theme.colors.accent : theme.colors.text }}>
          {label}
        </AppText>
      </PressableScale>
    );
  };

  const hourOptions = use24Hour
    ? Array.from({ length: 24 }, (_, i) => i)
    : [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  const options =
    part === 'hour'
      ? hourOptions.map((opt) => {
          const actual = use24Hour ? opt : (opt % 12) + (isPm ? 12 : 0);
          return { key: `h${opt}`, label: use24Hour ? pad(opt) : String(opt), selected: actual === h, onPress: () => setHour(actual) };
        })
      : MINUTES.map((opt) => ({
          key: `m${opt}`,
          label: pad(opt),
          selected: opt === m,
          onPress: () => setMinute(opt),
        }));

  const columns = use24Hour && part === 'hour' ? 6 : 4;
  const rows: (typeof options)[] = [];
  for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={[styles.timeDisplay, { gap: theme.spacing.sm }]}>
        {segment('hour', use24Hour ? pad(h) : String(hour12))}
        <AppText variant="display" color="textTertiary">:</AppText>
        {segment('minute', pad(m))}
        {!use24Hour ? (
          <View style={[styles.period, { borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceSunken }]}>
            {[false, true].map((pm) => {
              const active = pm === isPm;
              return (
                <PressableScale
                  key={pm ? 'pm' : 'am'}
                  accessibilityRole="button"
                  accessibilityLabel={pm ? 'PM' : 'AM'}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    hapticSelection();
                    setPeriod(pm);
                  }}
                  style={[
                    styles.periodBtn,
                    {
                      borderRadius: theme.radius.sm,
                      backgroundColor: active ? theme.colors.surfaceRaised : 'transparent',
                      borderColor: active ? theme.colors.separator : 'transparent',
                    },
                  ]}
                >
                  <AppText variant="label" style={{ color: active ? theme.colors.text : theme.colors.textTertiary }}>
                    {pm ? 'PM' : 'AM'}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {rows.map((row, i) => (
          <View key={i} style={[styles.optionRow, { gap: theme.spacing.sm }]}>
            {row.map((opt) => (
              <PressableScale
                key={opt.key}
                pressScale={0.94}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected: opt.selected }}
                onPress={() => {
                  hapticSelection();
                  opt.onPress();
                }}
                style={[
                  styles.option,
                  {
                    borderRadius: theme.radius.md,
                    backgroundColor: opt.selected ? theme.colors.accent : theme.colors.surfaceSunken,
                  },
                ]}
              >
                <AppText
                  variant="bodyStrong"
                  tabularNums
                  style={{ color: opt.selected ? theme.colors.onAccent : theme.colors.text }}
                >
                  {opt.label}
                </AppText>
              </PressableScale>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------------------------------------------------------------- Sheet */

export function DateTimeSheet({
  visible,
  mode,
  date,
  time,
  onDateChange,
  onTimeChange,
  onChange,
  onClose,
  maxDate,
  minDate,
  weekStartsOn = 'saturday',
  use24Hour,
  title,
}: DateTimeSheetProps) {
  const { theme } = useTheme();
  const locale = useLocale();
  const today = todayLocalDate();
  const resolved24 = use24Hour ?? isDevice24HourClock();

  const [draftDate, setDraftDate] = useState<LocalDate>(date ?? today);
  const [draftTime, setDraftTime] = useState<LocalTime>(sanitizeTime(time));
  const [tab, setTab] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date');
  const [seenOpen, setSeenOpen] = useState(visible);

  // Re-seed the drafts every time the sheet opens (adjusting state during render, not in an effect).
  if (visible && !seenOpen) {
    setSeenOpen(true);
    setDraftDate(date ?? today);
    setDraftTime(sanitizeTime(time));
    setTab(mode === 'time' ? 'time' : 'date');
  }
  if (!visible && seenOpen) setSeenOpen(false);

  const quickDays: { label: string; value: LocalDate }[] = [
    { label: t('common.today'), value: today },
    { label: t('common.yesterday'), value: addDays(today, -1) },
    {
      label: formatWeekdayDay(addDays(today, -2), locale),
      value: addDays(today, -2),
    },
  ].filter((q) => (!maxDate || q.value <= maxDate) && (!minDate || q.value >= minDate));

  const commit = () => {
    if (mode === 'date') onDateChange?.(draftDate);
    if (mode === 'time') onTimeChange?.(draftTime);
    if (mode === 'datetime') {
      onDateChange?.(draftDate);
      onTimeChange?.(draftTime);
      onChange?.({ date: draftDate, time: draftTime });
    }
    onClose();
  };

  const summary = `${formatWeekdayDayMonth(draftDate, locale)}${
    mode === 'datetime' ? `, ${formatFriendlyTime(draftTime, resolved24)}` : ''
  }`;

  const showDate = mode === 'date' || (mode === 'datetime' && tab === 'date');
  const showTime = mode === 'time' || (mode === 'datetime' && tab === 'time');

  const sheetTitle =
    title ?? (mode === 'time' ? t('common.time') : mode === 'datetime' ? t('dateTime.when') : t('common.pickDate'));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={sheetTitle}
      scroll
      footer={
        <Button
          title={mode === 'time' ? `${t('common.done')} · ${formatFriendlyTime(draftTime, resolved24)}` : `${t('common.done')} · ${summary}`}
          onPress={commit}
          testID="datetime-done"
        />
      }
    >
      {mode === 'datetime' ? (
        <View style={[styles.tabs, { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.pill }]}>
          {(['date', 'time'] as const).map((key) => {
            const active = tab === key;
            const tabLabel =
              key === 'date'
                ? formatShortDate(draftDate, locale)
                : formatFriendlyTime(draftTime, resolved24);
            return (
              <PressableScale
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={key === 'date' ? t('dateTime.dateTab') : t('dateTime.timeTab')}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelection();
                  setTab(key);
                }}
                style={[
                  styles.tab,
                  {
                    borderRadius: theme.radius.pill,
                    backgroundColor: active ? theme.colors.surfaceRaised : 'transparent',
                    borderColor: active ? theme.colors.separator : 'transparent',
                  },
                ]}
              >
                <AppIcon
                  name={key === 'date' ? 'calendar' : 'clock'}
                  size={16}
                  color={active ? theme.colors.text : theme.colors.textTertiary}
                />
                <AppText
                  variant="label"
                  numberOfLines={1}
                  style={{
                    color: active ? theme.colors.text : theme.colors.textTertiary,
                    minWidth: estimateSingleLineMinWidth(tabLabel, theme.typography.label.fontSize),
                    textAlign: 'center',
                  }}
                >
                  {tabLabel}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {showDate ? (
        <>
          {quickDays.length > 0 ? (
            <View style={[styles.quickRow, { gap: theme.spacing.sm }]}>
              {quickDays.map((q) => {
                const active = q.value === draftDate;
                return (
                  <PressableScale
                    key={q.value}
                    accessibilityRole="button"
                    accessibilityLabel={q.label}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      hapticSelection();
                      setDraftDate(q.value);
                    }}
                    style={[
                      styles.quick,
                      {
                        borderRadius: theme.radius.pill,
                        borderColor: active ? theme.colors.accent : theme.colors.separator,
                        backgroundColor: active ? theme.colors.accentSoft : 'transparent',
                      },
                    ]}
                  >
                    <AppText
                      variant="label"
                      numberOfLines={1}
                      style={{
                        color: active ? theme.colors.accent : theme.colors.text,
                        minWidth: estimateSingleLineMinWidth(q.label, theme.typography.label.fontSize),
                        textAlign: 'center',
                      }}
                    >
                      {q.label}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          ) : null}
          <Calendar
            key={seenOpen ? 'open' : 'closed'}
            value={draftDate}
            onSelect={(next) => {
              setDraftDate(next);
              if (mode === 'datetime') setTab('time');
            }}
            maxDate={maxDate}
            minDate={minDate}
            weekStartsOn={weekStartsOn}
          />
        </>
      ) : null}

      {showTime ? (
        <>
          <View style={[styles.quickRow, { gap: theme.spacing.sm }]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('dateTime.now')}
              onPress={() => {
                hapticSelection();
                setDraftTime(currentLocalTime());
              }}
              style={[styles.quick, { borderRadius: theme.radius.pill, borderColor: theme.colors.separator }]}
            >
              <AppIcon name="clock" size={14} color={theme.colors.textSecondary} />
              <AppText
                variant="label"
                numberOfLines={1}
                style={{
                  minWidth: estimateSingleLineMinWidth(t('dateTime.now'), theme.typography.label.fontSize),
                  textAlign: 'center',
                }}
              >
                {t('dateTime.now')}
              </AppText>
            </PressableScale>
          </View>
          <TimePicker value={draftTime} onChange={setDraftTime} use24Hour={resolved24} />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  monthNav: { flexDirection: 'row' },
  navBtn: { width: 44, height: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  weekdayLabel: { width: '100%', textAlign: 'center' },
  day: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap' },
  quick: { minHeight: 40, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  timeSegment: { minWidth: 76, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  period: { padding: 4, gap: 4, marginLeft: 4 },
  periodBtn: { minWidth: 52, minHeight: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  optionRow: { flexDirection: 'row' },
  option: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
