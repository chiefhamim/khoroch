import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_BILL_REMINDER_TIME } from '@/domain/billReminders';
import { getPeriod } from '@/domain/period';
import { todayLocalDate } from '@/domain/dates';
import { useLocale } from '@/i18n';
import { syncBillReminders } from '@/notifications/billReminders';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';
import { useLockState } from './LockContext';

/** Wait this long after the last change before rescheduling, so a burst of edits causes one run. */
export const BILL_REMINDER_SYNC_DEBOUNCE_MS = 500;

/**
 * Keeps the scheduled bill reminders in line with the bills and settings: on app start, after data
 * changes (a bill added, edited, deleted, marked paid or unpaid), when the reminder settings, cycle
 * day or language change, and when the app returns to the foreground. Runs are debounced, and
 * nothing runs while the feature is off and the cleanup already happened.
 * It never asks for notification permission; that happens only when the person turns the switch on.
 * When the feature is on but the permission is gone (for example a backup restored onto another
 * phone), the setting is switched off so the switch never reads on while nothing is scheduled.
 */
export function useBillReminderSync(): void {
  const { repo, settings, updateSetting } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const locale = useLocale();
  const lockState = useLockState();
  const [foregroundTick, setForegroundTick] = useState(0);
  const clearedRef = useRef(false);
  const billSettingsRef = useRef(settings.billReminders);
  const updateSettingRef = useRef(updateSetting);
  useEffect(() => {
    billSettingsRef.current = settings.billReminders;
    updateSettingRef.current = updateSetting;
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const { enabled, leadDays } = settings.billReminders;
  // App lock on means the lock screen must not show bill names, whatever the switch says.
  const hideNames =
    settings.billReminders.hideNames === true || lockState.enabled || settings.appLockEnabled;
  const onboardingDone = settings.onboardingDone;
  const monthStartDay = settings.monthStartDay;
  // Reuse the daily check-in time once the person has turned that reminder on; before that the
  // stored 21:00 is only a default, which is too late for a bill, so use the morning default.
  const time = settings.reminder.enabled ? settings.reminder.time : DEFAULT_BILL_REMINDER_TIME;

  useEffect(() => {
    if (!onboardingDone) return;
    if (!enabled && clearedRef.current) return;
    let active = true;
    const timer = setTimeout(() => {
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
        const result = await syncBillReminders({
          enabled: true,
          bills,
          period: getPeriod(todayLocalDate(now), monthStartDay),
          monthStartDay,
          now,
          leadDays,
          time,
          hideNames,
        });
        if (result.permissionMissing) {
          await updateSettingRef.current('billReminders', {
            ...billSettingsRef.current,
            enabled: false,
          });
        }
      })().catch(() => {});
    }, BILL_REMINDER_SYNC_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    repo,
    onboardingDone,
    enabled,
    leadDays,
    monthStartDay,
    time,
    locale,
    hideNames,
    dataVersion,
    foregroundTick,
  ]);
}
