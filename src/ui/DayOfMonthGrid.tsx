import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { hapticSelection } from './haptics';
import { PressableScale } from '@/ui/PressableScale';

const DAYS_1_TO_28 = Array.from({ length: 28 }, (_, i) => i + 1);

export interface DayOfMonthGridProps {
  value: number;
  onChange: (day: number) => void;
  testID?: string;
}

export function DayOfMonthGrid({ value, onChange, testID }: DayOfMonthGridProps) {
  const { theme, reducedMotion } = useTheme();

  return (
    <View testID={testID} style={styles.grid}>
      {DAYS_1_TO_28.map((day) => {
        const active = day === value;
        return (
          <View key={day} style={styles.cellWrap}>
            <PressableScale pressScale={0.92}
              testID={testID ? `${testID}-day-${day}` : undefined}
              accessibilityRole="button"
              accessibilityLabel={`Day ${day}`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (day !== value) hapticSelection();
                onChange(day);
              }}
              style={({ pressed }) => [
                styles.cell,
                {
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.pill,
                  backgroundColor: active ? theme.colors.accent : theme.colors.surfaceSunken,
                  opacity: pressed && !reducedMotion ? 0.8 : 1,
                },
              ]}
            >
              <AppText
                variant="label"
                tabularNums
                color={active ? 'onAccent' : 'text'}
              >
                {String(day)}
              </AppText>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cellWrap: {
    width: `${100 / 7}%`,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
