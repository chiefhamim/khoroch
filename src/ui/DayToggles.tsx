import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { AppLanguage } from '@/domain/types';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { hapticSelection } from './haptics';
import { PressableScale } from '@/ui/PressableScale';

/** Expo Notifications convention: 1 = Sunday .. 7 = Saturday */
const DAY_ITEMS: readonly {
  weekday: number;
  short: Record<AppLanguage, string>;
  full: Record<AppLanguage, string>;
}[] = [
  { weekday: 1, short: { en: 'S', bn: 'র' }, full: { en: 'Sunday', bn: 'রবিবার' } },
  { weekday: 2, short: { en: 'M', bn: 'সো' }, full: { en: 'Monday', bn: 'সোমবার' } },
  { weekday: 3, short: { en: 'T', bn: 'ম' }, full: { en: 'Tuesday', bn: 'মঙ্গলবার' } },
  { weekday: 4, short: { en: 'W', bn: 'বু' }, full: { en: 'Wednesday', bn: 'বুধবার' } },
  { weekday: 5, short: { en: 'T', bn: 'বৃ' }, full: { en: 'Thursday', bn: 'বৃহস্পতিবার' } },
  { weekday: 6, short: { en: 'F', bn: 'শু' }, full: { en: 'Friday', bn: 'শুক্রবার' } },
  { weekday: 7, short: { en: 'S', bn: 'শ' }, full: { en: 'Saturday', bn: 'শনিবার' } },
];

export interface DayTogglesProps {
  selectedDays: readonly number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  testID?: string;
}

export function DayToggles({
  selectedDays,
  onChange,
  disabled = false,
  testID,
}: DayTogglesProps) {
  const locale = useLocale();
  const { theme, reducedMotion } = useTheme();
  const activeSet = new Set(selectedDays);

  const toggleDay = (weekday: number) => {
    const nextSet = new Set(selectedDays);
    if (nextSet.has(weekday)) {
      nextSet.delete(weekday);
    } else {
      nextSet.add(weekday);
    }
    hapticSelection();
    onChange(Array.from(nextSet).sort((a, b) => a - b));
  };

  return (
    <View testID={testID} style={[styles.row, { gap: theme.spacing.xs }]}>
      {DAY_ITEMS.map((item) => {
        const active = activeSet.has(item.weekday);
        return (
          <PressableScale pressScale={0.92}
            key={item.weekday}
            testID={testID ? `${testID}-day-${item.weekday}` : undefined}
            disabled={disabled}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={item.full[locale]}
            accessibilityState={{ selected: active, disabled }}
            onPress={() => toggleDay(item.weekday)}
            style={({ pressed }) => [
              styles.circle,
              {
                width: 36,
                height: 36,
                borderRadius: theme.radius.pill,
                backgroundColor: active ? theme.colors.accent : theme.colors.surfaceSunken,
                opacity: disabled ? 0.5 : pressed && !reducedMotion ? 0.8 : 1,
              },
            ]}
          >
            <AppText variant="label" color={active ? 'onAccent' : 'textSecondary'} numberOfLines={1}>
              {item.short[locale]}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
