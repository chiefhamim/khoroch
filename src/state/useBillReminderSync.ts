import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_BILL_REMINDER_TIME } from '@/domain/billReminders';
import { getPeriod } from '@/domain/period';
import { todayLocalDate } from '@/domain/dates';
import { useLocale } from '@/i18n';
import { syncBillReminders } from '@/notifications/billReminders';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';

/**
 * Keeps the scheduled bill reminders in line with the bills and settings: on app start, whenever
 * any data changes (a bill added, edited, deleted, marked paid or unpaid), when the reminder
 * settings, cycle day or language change, and when the app returns to the foreground.
 * It never asks for notification permission; that happens only when the person turns the switch on.
 */
export function useBillReminderSync(): void {
  const { repo, settings } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const locale = useLocale();
  const [foregroundTick, setForegroundTick] = useState(0);
  const clearedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const { enabled, leadDays } = settings.billReminders;
  const onboardingDone = settings.onboardingDone;
  const monthStartDay = settings.monthStartDay;
  // Reuse the daily check-in time once the person has turned that reminder on; before that the
  // stored 21:00 is only a default, which is too late for a bill, so use the morning default.
  const time = settings.reminder.enabled ? settings.reminder.time : DEFAULT_BILL_REMINDER_TIME;

  useEffect(() => {
    if (!onboardingDone) return;
    if (!enabled && clearedRef.current) return;
    let active = true;
    (async () => {
      if (!enabled) {
        await syncBillReminders({
          enabled: false,
          bills: [],
          period: getPeriod(todayLocalDate(), monthStartDay),
          monthStartDay,
          now: new Date(),
          leadDays,
        });
        clearedRef.current = true;
        return;
      }
      clearedRef.current = false;
      const bills = await repo.listRecurringBills({ includeInactive: true });
      if (!active) return;
      const now = new Date();
      await syncBillReminders({
        enabled: true,
        bills,
        period: getPeriod(todayLocalDate(now), monthStartDay),
        monthStartDay,
        now,
        leadDays,
        time,
      });
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [repo, onboardingDone, enabled, leadDays, monthStartDay, time, locale, dataVersion, foregroundTick]);
}
