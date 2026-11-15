import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  SHORT_MONTHS_BY_LOCALE,
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
const QUICK_MINUTES = [0, 15, 30, 45];
const WHEEL_ROW_H = 42;
const WHEEL_VISIBLE_ROWS = 5;
const WHEEL_H = WHEEL_ROW_H * WHEEL_VISIBLE_ROWS;
const WHEEL_PAD = WHEEL_ROW_H * 2;
const WHEEL_EMPTY_STYLE = { paddingVertical: WHEEL_PAD };

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
  const { theme, reducedMotion } = useTheme();
  const locale = useLocale();
  const today = todayLocalDate();
  const todayParts = parseLocalDate(today);
  const initial = parseLocalDate(value);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const [pickingMonth, setPickingMonth] = useState(false);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // Follow selections made outside the grid (quick chips) into their month.
    setLastValue(value);
    if (initial.year !== view.year || initial.month !== view.month) {
      setView({ year: initial.year, month: initial.month });
    }
  }

  const minParts = minDate ? parseLocalDate(minDate) : null;
  const maxParts = maxDate ? parseLocalDate(maxDate) : null;

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
  const canPrevMonth = !minDate || formatLocalDate(prev.year, prev.month, daysInMonth(prev.year, prev.month)) >= minDate;
  const canNextMonth = !maxDate || formatLocalDate(next.year, next.month, 1) <= maxDate;
  const canPrevYear = !minParts || view.year - 1 >= minParts.year;
  const canNextYear = !maxParts || view.year + 1 <= maxParts.year;

  const canPrev = pickingMonth ? canPrevYear : canPrevMonth;
  const canNext = pickingMonth ? canNextYear : canNextMonth;

  const monthSlide = useSharedValue(0);
  const animateMonthStep = useCallback(
    (delta: number) => {
      if (reducedMotion) return;
      monthSlide.set(delta * 20);
      monthSlide.set(withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) }));
    },
    [monthSlide, reducedMotion]
  );

  const stepMonth = useCallback(
    (delta: -1 | 1) => {
      if (delta === -1 && !canPrevMonth) return;
      if (delta === 1 && !canNextMonth) return;
      hapticSelection();
      animateMonthStep(delta);
      setView((v) => shiftMonth(v.year, v.month, delta));
    },
    [animateMonthStep, canNextMonth, canPrevMonth]
  );

  const gridSwipe = usePanGesture({
    activeOffsetX: [-18, 18],
    failOffsetY: [-10, 10],
    onDeactivate: (e) => {
      'worklet';
      if (Math.abs(e.translationX) < 36 && Math.abs(e.velocityX) < 300) return;
      const delta = e.translationX < 0 ? 1 : -1;
      runOnJS(stepMonth)(delta);
    },
  });

  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: monthSlide.get() }],
  }));

  const rows: (LocalDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  // Nearby quick year pills (up to 4 years bounded by min/max).
  const quickYears = useMemo(() => {
    const ceiling = maxParts ? maxParts.year : todayParts.year + 1;
    const floor = minParts ? minParts.year : ceiling - 30;
    let end = Math.min(ceiling, Math.max(view.year + 1, Math.min(ceiling, view.year + 2)));
    const start = Math.max(floor, end - 3);
    end = Math.min(ceiling, start + 3);
    const list: number[] = [];
    for (let y = start; y <= end; y += 1) list.push(y);
    return list;
  }, [maxParts, minParts, todayParts.year, view.year]);

  const monthNames = SHORT_MONTHS_BY_LOCALE[locale];
  const monthRows: number[][] = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
  ];

  const isMonthEnabled = (year: number, month: number) => {
    const start = formatLocalDate(year, month, 1);
    const end = formatLocalDate(year, month, daysInMonth(year, month));
    if (minDate && end < minDate) return false;
    if (maxDate && start > maxDate) return false;
    return true;
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={styles.monthHeader}>
        <PressableScale
          pressScale={0.96}
          accessibilityRole="button"
          accessibilityLabel={t('dateTime.pickMonthYear')}
          accessibilityState={{ expanded: pickingMonth }}
          onPress={() => {
            hapticSelection();
            setPickingMonth((p) => !p);
          }}
          style={[
            styles.monthPill,
            {
              borderRadius: theme.radius.pill,
              backgroundColor: pickingMonth ? theme.colors.accentSoft : theme.colors.surfaceSunken,
              borderColor: pickingMonth ? theme.colors.accent : 'transparent',
            },
          ]}
        >
          <AppText
            variant="headline"
            style={{ color: pickingMonth ? theme.colors.accent : theme.colors.text }}
          >
            {formatMonthYear(view.year, view.month, locale)}
          </AppText>
          <AppIcon
            name={pickingMonth ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={pickingMonth ? theme.colors.accent : theme.colors.textSecondary}
          />
        </PressableScale>

        <View style={[styles.monthNav, { gap: theme.spacing.xs }]}>
          {[
            {
              key: 'prev',
              icon: 'chevron-left' as const,
              enabled: canPrev,
              label: pickingMonth ? t('dateTime.prevYear') : t('dateTime.prevMonth'),
              onPress: () => {
                hapticSelection();
                if (pickingMonth) {
                  setView((v) => ({ ...v, year: v.year - 1 }));
                } else {
                  animateMonthStep(-1);
                  setView(prev);
                }
              },
            },
            {
              key: 'next',
              icon: 'chevron-right' as const,
              enabled: canNext,
              label: pickingMonth ? t('dateTime.nextYear') : t('dateTime.nextMonth'),
              onPress: () => {
                hapticSelection();
                if (pickingMonth) {
                  setView((v) => ({ ...v, year: v.year + 1 }));
                } else {
                  animateMonthStep(1);
                  setView(next);
                }
              },
            },
          ].map((btn) => (
            <PressableScale
              key={btn.key}
              accessibilityRole="button"
              accessibilityLabel={btn.label}
              accessibilityState={{ disabled: !btn.enabled }}
              disabled={!btn.enabled}
              hitSlop={6}
              onPress={btn.onPress}
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

      {pickingMonth ? (
        <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
          {quickYears.length > 1 ? (
            <View style={[styles.yearRow, { gap: theme.spacing.xs }]}>
              {quickYears.map((yr) => {
                const active = yr === view.year;
                return (
                  <PressableScale
                    key={yr}
                    pressScale={0.95}
                    accessibilityRole="button"
                    accessibilityLabel={String(yr)}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      hapticSelection();
                      setView((v) => ({ ...v, year: yr }));
                    }}
                    style={[
                      styles.yearPill,
                      {
                        borderRadius: theme.radius.pill,
                        backgroundColor: active ? theme.colors.accentSoft : theme.colors.surfaceSunken,
                        borderColor: active ? theme.colors.accent : 'transparent',
                      },
                    ]}
                  >
                    <AppText
                      variant="label"
                      tabularNums
                      style={{ color: active ? theme.colors.accent : theme.colors.textSecondary }}
                    >
                      {yr}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          ) : null}

          <View style={{ gap: theme.spacing.xs }}>
            {monthRows.map((mRow, rIdx) => (
              <View key={rIdx} style={[styles.monthGridRow, { gap: theme.spacing.xs }]}>
                {mRow.map((m) => {
                  const enabled = isMonthEnabled(view.year, m);
                  const selected = view.month === m;
                  const isCurrentMonth = view.year === todayParts.year && m === todayParts.month;
                  return (
                    <PressableScale
                      key={m}
                      pressScale={0.95}
                      accessibilityRole="button"
                      accessibilityLabel={`${monthNames[m - 1]} ${view.year}`}
                      accessibilityState={{ selected, disabled: !enabled }}
                      disabled={!enabled}
                      onPress={() => {
                        hapticSelection();
                        setView((v) => ({ ...v, month: m }));
                        setPickingMonth(false);
                      }}
                      style={[
                        styles.monthCell,
                        {
                          borderRadius: theme.radius.md,
                          backgroundColor: selected
                            ? theme.scheme === 'dark'
                              ? theme.colors.accentSoft
                              : theme.colors.accent
                            : theme.colors.surfaceSunken,
                          borderWidth: (selected && theme.scheme === 'dark') || (isCurrentMonth && !selected) ? 1.5 : 0,
                          borderColor: theme.colors.accent,
                          opacity: enabled ? 1 : 0.35,
                        },
                      ]}
                    >
                      <AppText
                        variant="bodyStrong"
                        style={{
                          color: selected
                            ? theme.scheme === 'dark'
                              ? theme.colors.accent
                              : theme.colors.onAccent
                            : isCurrentMonth
                              ? theme.colors.accent
                              : theme.colors.text,
                        }}
                      >
                        {monthNames[m - 1]}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <GestureDetector gesture={gridSwipe}>
          <Animated.View style={gridStyle}>
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
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

/* ---------------------------------------------------------------- Time Wheel */

const WheelColumn = memo(function WheelColumn({
  items,
  selectedIndex,
  onSelectIndex,
  accessibilityLabel,
}: {
  items: { key: string; label: string }[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();
  const listRef = useRef<FlatList<{ key: string; label: string }>>(null);
  const draggingRef = useRef(false);
  const momentumRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgrammaticRef = useRef(selectedIndex);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (draggingRef.current) return;
    if (lastProgrammaticRef.current === selectedIndex) return;
    lastProgrammaticRef.current = selectedIndex;
    listRef.current?.scrollToOffset?.({
      offset: Math.max(0, selectedIndex) * WHEEL_ROW_H,
      animated: true,
    });
  }, [selectedIndex]);

  const commitOffset = useCallback(
    (y: number) => {
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / WHEEL_ROW_H)));
      lastProgrammaticRef.current = idx;
      if (idx !== selectedIndex) {
        hapticSelection();
        onSelectIndex(idx);
      }
    },
    [items.length, onSelectIndex, selectedIndex]
  );

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    draggingRef.current = false;
    const y = e.nativeEvent.contentOffset.y;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      if (!momentumRef.current) commitOffset(y);
    }, 65);
  };

  const handleMomentumBegin = () => {
    momentumRef.current = true;
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    momentumRef.current = false;
    draggingRef.current = false;
    commitOffset(e.nativeEvent.contentOffset.y);
  };

  const renderItem = useCallback(
    ({ item, index }: { item: { key: string; label: string }; index: number }) => {
      const selected = index === selectedIndex;
      const dist = Math.abs(index - selectedIndex);
      return (
        <PressableScale
          pressScale={0.95}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel} ${item.label}`}
          accessibilityState={{ selected }}
          onPress={() => {
            hapticSelection();
            lastProgrammaticRef.current = index;
            listRef.current?.scrollToOffset?.({ offset: index * WHEEL_ROW_H, animated: true });
            onSelectIndex(index);
          }}
          style={styles.wheelItem}
        >
          <AppText
            variant={selected ? 'title' : 'bodyStrong'}
            tabularNums
            style={{
              fontSize: selected ? 21 : 17,
              color: selected ? theme.colors.accent : theme.colors.textTertiary,
              opacity: selected ? 1 : dist === 1 ? 0.72 : 0.42,
            }}
          >
            {item.label}
          </AppText>
        </PressableScale>
      );
    },
    [accessibilityLabel, onSelectIndex, selectedIndex, theme.colors.accent, theme.colors.textTertiary]
  );

  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      style={styles.wheelList}
      contentContainerStyle={WHEEL_EMPTY_STYLE}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      snapToInterval={WHEEL_ROW_H}
      snapToAlignment="start"
      decelerationRate={0.988}
      initialScrollIndex={Math.max(0, Math.min(items.length - 1, selectedIndex))}
      getItemLayout={(_data, index) => ({
        length: WHEEL_ROW_H,
        offset: WHEEL_ROW_H * index,
        index,
      })}
      onScrollBeginDrag={() => {
        draggingRef.current = true;
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      }}
      onScrollEndDrag={handleScrollEndDrag}
      onMomentumScrollBegin={handleMomentumBegin}
      onMomentumScrollEnd={handleMomentumEnd}
    />
  );
});

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
  const [inputMode, setInputMode] = useState<'wheel' | 'keypad'>('wheel');
  const [activeField, setActiveField] = useState<'hour' | 'minute'>('hour');
  const [digitBuffer, setDigitBuffer] = useState<string>('');

  const [h, m] = value.split(':').map(Number);
  const isPm = h >= 12;
  const hour12 = h % 12 === 0 ? 12 : h % 12;

  const setHour24 = useCallback(
    (nextH: number) => {
      onChange(`${pad(nextH)}:${pad(m)}`);
    },
    [m, onChange]
  );
  const setMinute = useCallback(
    (nextM: number) => {
      onChange(`${pad(h)}:${pad(nextM)}`);
    },
    [h, onChange]
  );
  const setPeriod = useCallback(
    (pm: boolean) => {
      if (pm === isPm) return;
      onChange(`${pad(pm ? (h % 12) + 12 : h % 12)}:${pad(m)}`);
    },
    [h, isPm, m, onChange]
  );

  const hourItems = useMemo(
    () =>
      use24Hour
        ? Array.from({ length: 24 }, (_, i) => ({ key: `h${i}`, label: pad(i), value: i }))
        : Array.from({ length: 12 }, (_, i) => {
            const labelNum = i + 1;
            const actual24 = (labelNum % 12) + (isPm ? 12 : 0);
            return { key: `h${labelNum}`, label: String(labelNum), value: actual24 };
          }),
    [isPm, use24Hour]
  );

  const minuteItems = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ key: `m${i}`, label: pad(i) })),
    []
  );

  const selectedHourIndex = use24Hour ? h : hour12 - 1;

  // Smart 2-digit keypad entry for hour and minute.
  const handleKey = (digit: number) => {
    hapticSelection();
    if (activeField === 'hour') {
      if (digitBuffer.length === 0) {
        if (use24Hour) {
          if (digit >= 3) {
            onChange(`${pad(digit)}:${pad(m)}`);
            setDigitBuffer('');
            setActiveField('minute');
          } else {
            setDigitBuffer(String(digit));
          }
        } else {
          if (digit >= 2) {
            const next24 = (digit % 12) + (isPm ? 12 : 0);
            onChange(`${pad(next24)}:${pad(m)}`);
            setDigitBuffer('');
            setActiveField('minute');
          } else {
            setDigitBuffer(String(digit));
          }
        }
        return;
      }
      const combined = Number(`${digitBuffer}${digit}`);
      if (use24Hour) {
        const clamped = combined <= 23 ? combined : digit;
        onChange(`${pad(clamped)}:${pad(m)}`);
      } else {
        const valid12 = combined >= 1 && combined <= 12 ? combined : digit === 0 ? 12 : digit;
        const next24 = (valid12 % 12) + (isPm ? 12 : 0);
        onChange(`${pad(next24)}:${pad(m)}`);
      }
      setDigitBuffer('');
      setActiveField('minute');
      return;
    }

    // Minute entry
    if (digitBuffer.length === 0) {
      if (digit >= 6) {
        onChange(`${pad(h)}:${pad(digit)}`);
        setDigitBuffer('');
      } else {
        setDigitBuffer(String(digit));
      }
      return;
    }
    const combined = Number(`${digitBuffer}${digit}`);
    const nextM = combined <= 59 ? combined : digit;
    onChange(`${pad(h)}:${pad(nextM)}`);
    setDigitBuffer('');
  };

  const handleBackspace = () => {
    hapticSelection();
    if (digitBuffer.length > 0) {
      setDigitBuffer('');
      return;
    }
    if (activeField === 'minute') {
      setActiveField('hour');
    }
  };

  const hourDisplay =
    activeField === 'hour' && digitBuffer.length > 0
      ? `${digitBuffer}_`
      : use24Hour
        ? pad(h)
        : pad(hour12);
  const minuteDisplay =
    activeField === 'minute' && digitBuffer.length > 0 ? `${digitBuffer}_` : pad(m);

  return (
    <View style={{ gap: theme.spacing.sm + 2 }}>
      {/* Top quick controls: Now pill + Scroll/Keypad switch */}
      <View style={styles.timeTopBar}>
        <PressableScale
          pressScale={0.96}
          accessibilityRole="button"
          accessibilityLabel={t('dateTime.now')}
          onPress={() => {
            hapticSelection();
            setDigitBuffer('');
            onChange(currentLocalTime());
          }}
          style={[styles.nowPill, { borderRadius: theme.radius.pill, borderColor: theme.colors.separator }]}
        >
          <AppIcon name="clock" size={14} color={theme.colors.accent} />
          <AppText variant="label">{t('dateTime.now')}</AppText>
        </PressableScale>

        <View style={[styles.modeSwitch, { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.pill }]}>
          {(['wheel', 'keypad'] as const).map((mKey) => {
            const active = inputMode === mKey;
            const label = mKey === 'wheel' ? t('dateTime.wheel') : t('dateTime.keypad');
            return (
              <PressableScale
                key={mKey}
                pressScale={0.96}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelection();
                  setDigitBuffer('');
                  setInputMode(mKey);
                }}
                style={[
                  styles.modeBtn,
                  {
                    borderRadius: theme.radius.pill,
                    backgroundColor: active ? theme.colors.surfaceRaised : 'transparent',
                    borderColor: active ? theme.colors.separator : 'transparent',
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  numberOfLines={1}
                  style={{
                    color: active ? theme.colors.text : theme.colors.textTertiary,
                    fontWeight: active ? '600' : '500',
                  }}
                >
                  {label}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {inputMode === 'wheel' ? (
        <>
          <View style={[styles.wheelRowWrap, { gap: theme.spacing.sm }]}>
            <View
              style={[
                styles.wheelFrame,
                {
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: theme.radius.lg,
                },
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.wheelHighlight,
                  {
                    backgroundColor: theme.colors.surfaceRaised,
                    borderColor: theme.colors.cardBorder,
                    borderRadius: theme.radius.md,
                  },
                ]}
              />
              <View style={styles.wheelColumns}>
                <View style={styles.wheelCol}>
                  <WheelColumn
                    items={hourItems}
                    selectedIndex={selectedHourIndex}
                    accessibilityLabel={t('dateTime.hour')}
                    onSelectIndex={(idx) => setHour24(hourItems[idx]?.value ?? h)}
                  />
                </View>
                <AppText variant="headline" color="textTertiary" style={styles.wheelColon}>
                  :
                </AppText>
                <View style={styles.wheelCol}>
                  <WheelColumn
                    items={minuteItems}
                    selectedIndex={m}
                    accessibilityLabel={t('dateTime.minute')}
                    onSelectIndex={(idx) => setMinute(idx)}
                  />
                </View>
              </View>
            </View>
            {!use24Hour ? (
              <View
                style={[
                  styles.wheelPeriodCard,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderRadius: theme.radius.lg,
                    gap: theme.spacing.xs,
                  },
                ]}
              >
                {[false, true].map((pm) => {
                  const active = pm === isPm;
                  return (
                    <PressableScale
                      key={pm ? 'pm' : 'am'}
                      pressScale={0.95}
                      accessibilityRole="button"
                      accessibilityLabel={pm ? 'PM' : 'AM'}
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        hapticSelection();
                        setPeriod(pm);
                      }}
                      style={[
                        styles.wheelPeriodBtn,
                        {
                          borderRadius: theme.radius.md,
                          backgroundColor: active ? theme.colors.surfaceRaised : 'transparent',
                          borderColor: active ? theme.colors.accent : 'transparent',
                        },
                      ]}
                    >
                      <AppText
                        variant="bodyStrong"
                        style={{ color: active ? theme.colors.accent : theme.colors.textTertiary }}
                      >
                        {pm ? 'PM' : 'AM'}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={[styles.quickMinRow, { gap: theme.spacing.xs }]}>
            {QUICK_MINUTES.map((qm) => {
              const selected = m === qm;
              return (
                <PressableScale
                  key={qm}
                  pressScale={0.95}
                  accessibilityRole="button"
                  accessibilityLabel={`:${pad(qm)}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    hapticSelection();
                    setMinute(qm);
                  }}
                  style={[
                    styles.quickMinChip,
                    {
                      borderRadius: theme.radius.pill,
                      backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surfaceSunken,
                      borderColor: selected ? theme.colors.accent : 'transparent',
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    tabularNums
                    style={{ color: selected ? theme.colors.accent : theme.colors.textSecondary }}
                  >
                    :{pad(qm)}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={[styles.timeDisplay, { gap: theme.spacing.sm }]}>
            {(['hour', 'minute'] as const).map((field, idx) => {
              const active = activeField === field;
              const txt = field === 'hour' ? hourDisplay : minuteDisplay;
              return (
                <React.Fragment key={field}>
                  {idx === 1 ? (
                    <AppText variant="headline" color="textTertiary" style={{ fontSize: 26 }}>
                      :
                    </AppText>
                  ) : null}
                  <PressableScale
                    pressScale={0.96}
                    accessibilityRole="button"
                    accessibilityLabel={field === 'hour' ? t('dateTime.hour') : t('dateTime.minute')}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      hapticSelection();
                      setDigitBuffer('');
                      setActiveField(field);
                    }}
                    style={[
                      styles.keypadSegment,
                      {
                        borderRadius: theme.radius.md,
                        backgroundColor: active ? theme.colors.accentSoft : theme.colors.surfaceSunken,
                        borderColor: active ? theme.colors.accent : 'transparent',
                      },
                    ]}
                  >
                    <AppText
                      variant="headline"
                      tabularNums
                      style={{ fontSize: 26, lineHeight: 32, color: active ? theme.colors.accent : theme.colors.text }}
                    >
                      {txt}
                    </AppText>
                  </PressableScale>
                </React.Fragment>
              );
            })}
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

          <View style={{ gap: theme.spacing.xs }}>
            {[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ].map((row, rIdx) => (
              <View key={rIdx} style={[styles.optionRow, { gap: theme.spacing.xs }]}>
                {row.map((num) => (
                  <PressableScale
                    key={num}
                    pressScale={0.94}
                    accessibilityRole="button"
                    accessibilityLabel={String(num)}
                    onPress={() => handleKey(num)}
                    style={[
                      styles.keypadBtn,
                      { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md },
                    ]}
                  >
                    <AppText variant="title" tabularNums>
                      {num}
                    </AppText>
                  </PressableScale>
                ))}
              </View>
            ))}
            <View style={[styles.optionRow, { gap: theme.spacing.xs }]}>
              <PressableScale
                pressScale={0.94}
                accessibilityRole="button"
                accessibilityLabel={use24Hour ? t('dateTime.now') : isPm ? 'AM' : 'PM'}
                onPress={() => {
                  hapticSelection();
                  if (use24Hour) {
                    setDigitBuffer('');
                    onChange(currentLocalTime());
                  } else {
                    setPeriod(!isPm);
                  }
                }}
                style={[
                  styles.keypadBtn,
                  { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md },
                ]}
              >
                <AppText variant="label" color="accent">
                  {use24Hour ? t('dateTime.now') : isPm ? 'PM → AM' : 'AM → PM'}
                </AppText>
              </PressableScale>
              <PressableScale
                pressScale={0.94}
                accessibilityRole="button"
                accessibilityLabel="0"
                onPress={() => handleKey(0)}
                style={[
                  styles.keypadBtn,
                  { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md },
                ]}
              >
                <AppText variant="title" tabularNums>
                  0
                </AppText>
              </PressableScale>
              <PressableScale
                pressScale={0.94}
                accessibilityRole="button"
                accessibilityLabel={t('dateTime.backspace')}
                onPress={handleBackspace}
                style={[
                  styles.keypadBtn,
                  { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md },
                ]}
              >
                <AppIcon name="delete" size={19} color={theme.colors.textSecondary} />
              </PressableScale>
            </View>
          </View>
        </View>
      )}
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
      scroll={showDate}
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
        <TimePicker key={seenOpen ? 'time-open' : 'time-closed'} value={draftTime} onChange={setDraftTime} use24Hour={resolved24} />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  monthPill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderWidth: 1 },
  monthNav: { flexDirection: 'row' },
  navBtn: { width: 36, height: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  yearRow: { flexDirection: 'row' },
  yearPill: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  monthGridRow: { flexDirection: 'row' },
  monthCell: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  weekdayLabel: { width: '100%', textAlign: 'center' },
  day: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap' },
  quick: { minHeight: 34, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nowPill: { minHeight: 34, paddingHorizontal: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeSwitch: { flexDirection: 'row', padding: 3 },
  modeBtn: { minHeight: 30, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  wheelRowWrap: { flexDirection: 'row', alignItems: 'stretch', height: WHEEL_H },
  wheelFrame: { flex: 1, height: WHEEL_H, overflow: 'hidden', justifyContent: 'center', position: 'relative' },
  wheelHighlight: { position: 'absolute', left: 10, right: 10, top: WHEEL_PAD, height: WHEEL_ROW_H, borderWidth: 1 },
  wheelColumns: { flexDirection: 'row', alignItems: 'center', height: WHEEL_H, paddingHorizontal: 10 },
  wheelCol: { flex: 1, height: WHEEL_H },
  wheelList: { height: WHEEL_H },
  wheelItem: { height: WHEEL_ROW_H, alignItems: 'center', justifyContent: 'center' },
  wheelColon: { paddingHorizontal: 4, fontSize: 22, fontWeight: '700' },
  wheelPeriodCard: { width: 76, height: WHEEL_H, padding: 6, justifyContent: 'center' },
  wheelPeriodBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  quickMinRow: { flexDirection: 'row' },
  quickMinChip: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  timeDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  keypadSegment: { minWidth: 74, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  period: { padding: 4, gap: 4, marginLeft: 4 },
  periodBtn: { minWidth: 50, minHeight: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  optionRow: { flexDirection: 'row' },
  keypadBtn: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
});
