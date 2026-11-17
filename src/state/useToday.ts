import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayLocalDate } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';

/**
 * Today's local date, refreshed when the screen gains focus and when the app returns
 * to the foreground, so day-dependent text (overdue, due in N days) never goes stale.
 * Setting the same date again does not re-render.
 */
export function useToday(): LocalDate {
  const [today, setToday] = useState<LocalDate>(() => todayLocalDate());

  const refresh = useCallback(() => {
    setToday(todayLocalDate());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return today;
}
