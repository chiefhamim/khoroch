import { Platform } from 'react-native';
import {
  buildBillReminders,
  isBillReminderId,
  type BillReminder,
  type BillReminderInput,
} from '@/domain/billReminders';
import { getLocale, t } from '@/i18n';
import { toBnDigits } from '@/i18n/displayText';
import { loadNotifications } from './reminders';

export const BILL_REMINDER_CHANNEL_ID = 'bill-due';

/** Marks a notification as ours so a tap can open the Plan tab. */
export const BILL_REMINDER_DATA_KIND = 'bill-due';
export const BILL_REMINDER_ROUTE = '/(tabs)/plan';

export interface BillReminderContent {
  title: string;
  body: string;
  data: { kind: string; route: string; billId: string };
}

export interface BillReminderContentOptions {
  /** True keeps the bill name out of the title: a generic "A bill is due" text is used instead. */
  hideNames?: boolean;
}

/**
 * Lock-screen text: the bill name (unless hidden) and when it is due. Never an amount (AGENTS.md
 * section 5); the strings have no amount placeholder and a test enforces that.
 */
export function buildBillReminderContent(
  reminder: BillReminder,
  options: BillReminderContentOptions = {}
): BillReminderContent {
  const name = reminder.billName.trim();
  const generic = options.hideNames === true;
  const days = getLocale() === 'bn' ? toBnDigits(String(reminder.daysUntilDue)) : reminder.daysUntilDue;
  let title: string;
  if (reminder.daysUntilDue <= 0) {
    title = generic ? t('billReminder.titleTodayGeneric') : t('billReminder.titleToday', { name });
  } else if (reminder.daysUntilDue === 1) {
    title = generic
      ? t('billReminder.titleTomorrowGeneric')
      : t('billReminder.titleTomorrow', { name });
  } else {
    title = generic
      ? t('billReminder.titleInDaysGeneric', { days })
      : t('billReminder.titleInDays', { name, days });
  }
  return {
    title,
    body: reminder.daysUntilDue <= 0 ? t('billReminder.bodyToday') : t('billReminder.bodyEarly'),
    data: { kind: BILL_REMINDER_DATA_KIND, route: BILL_REMINDER_ROUTE, billId: reminder.billId },
  };
}

export interface SyncBillRemindersInput extends BillReminderInput {
  /** The feature switch. Off cancels this feature's reminders and schedules nothing. */
  enabled: boolean;
  /** Keep bill names out of the notification text (the setting, or app lock being on). */
  hideNames?: boolean;
}

export interface SyncBillRemindersResult {
  scheduled: number;
  /** True when nothing needed changing because the right reminders were already scheduled. */
  unchanged?: boolean;
  /** True when reminders were wanted but the OS has not granted permission. */
  permissionMissing?: boolean;
}

let syncQueue: Promise<unknown> = Promise.resolve();

/**
 * Brings this feature's scheduled reminders in line with `input`. Safe to call as often as you like:
 * calls run one after another, and only the difference against what the OS already holds is
 * cancelled or scheduled, so a run that finds nothing to change touches nothing. Only identifiers
 * with the bill prefix are ever cancelled. It never asks for permission.
 */
export function syncBillReminders(input: SyncBillRemindersInput): Promise<SyncBillRemindersResult> {
  const run = syncQueue.then(() => runSyncBillReminders(input));
  syncQueue = run.catch(() => {});
  return run;
}

type NotificationsModule = NonNullable<ReturnType<typeof loadNotifications>>;

interface ScheduledOwn {
  id: string;
  fireMs: number | null;
  title: string;
  body: string;
}

function triggerMs(trigger: unknown): number | null {
  if (!trigger || typeof trigger !== 'object') return null;
  const rec = trigger as { date?: unknown; value?: unknown };
  const raw = rec.date ?? rec.value;
  if (raw instanceof Date) return raw.getTime();
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function payloadFireMs(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const raw = (data as { fireMs?: unknown }).fireMs;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

async function listOwn(Notifications: NotificationsModule): Promise<ScheduledOwn[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .filter((r) => isBillReminderId(r.identifier))
    .map((r) => ({
      id: r.identifier,
      // iOS reports a date trigger as a time interval with no absolute date; fall back to the fire
      // time we stored in the payload (milliseconds, no user text).
      fireMs: triggerMs(r.trigger) ?? payloadFireMs(r.content.data),
      title: r.content.title ?? '',
      body: r.content.body ?? '',
    }));
}

async function cancelOwn(Notifications: NotificationsModule): Promise<void> {
  for (const item of await listOwn(Notifications)) {
    await Notifications.cancelScheduledNotificationAsync(item.id);
  }
}

async function runSyncBillReminders(input: SyncBillRemindersInput): Promise<SyncBillRemindersResult> {
  if (Platform.OS === 'web') return { scheduled: 0 };
  const Notifications = loadNotifications();
  if (!Notifications) return { scheduled: 0 };

  try {
    if (!input.enabled) {
      await cancelOwn(Notifications);
      return { scheduled: 0 };
    }

    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      await cancelOwn(Notifications);
      return { scheduled: 0, permissionMissing: true };
    }

    const reminders = buildBillReminders(input);
    const items = reminders.map((reminder) => ({
      reminder,
      content: buildBillReminderContent(reminder, { hideNames: input.hideNames }),
    }));

    const existing = await listOwn(Notifications);
    const existingById = new Map(existing.map((e) => [e.id, e]));
    const wanted = new Set(items.map(({ reminder }) => reminder.id));

    const stale = existing.filter((e) => !wanted.has(e.id));
    const toSchedule = items.filter(({ reminder, content }) => {
      const have = existingById.get(reminder.id);
      return (
        !have ||
        have.fireMs !== reminder.fireAt.getTime() ||
        have.title !== content.title ||
        have.body !== content.body
      );
    });

    if (stale.length === 0 && toSchedule.length === 0) {
      return { scheduled: items.length, unchanged: true };
    }

    for (const e of stale) {
      await Notifications.cancelScheduledNotificationAsync(e.id);
    }

    let channelId: string | undefined;
    if (Platform.OS === 'android' && toSchedule.length > 0) {
      try {
        await Notifications.setNotificationChannelAsync(BILL_REMINDER_CHANNEL_ID, {
          name: t('billReminder.channelName'),
          importance: Notifications.AndroidImportance.DEFAULT,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        });
        channelId = BILL_REMINDER_CHANNEL_ID;
      } catch {
        channelId = undefined;
      }
    }

    for (const { reminder, content } of toSchedule) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: content.title,
          body: content.body,
          data: { ...content.data, fireMs: reminder.fireAt.getTime() },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.fireAt,
          ...(channelId ? { channelId } : {}),
        },
      });
    }
    return { scheduled: items.length };
  } catch (err) {
    if (__DEV__) {
      console.warn('[billReminders] sync failed:', err);
    }
    return { scheduled: 0 };
  }
}

let lastHandledResponseKey: string | null = null;

/** Opens the Plan tab when a bill reminder is tapped, including a tap that launched the app. */
export function subscribeToBillReminderResponses(onOpenPlan: () => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};

  let active = true;

  const handleResponse = (
    response: {
      actionIdentifier: string;
      notification: { request: { identifier: string; content: { data?: Record<string, unknown> } } };
    } | null
  ) => {
    if (!active || !response) return;
    if (response.notification.request.content.data?.kind !== BILL_REMINDER_DATA_KIND) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (lastHandledResponseKey === key) return;
    lastHandledResponseKey = key;
    onOpenPlan();
  };

  Notifications.getLastNotificationResponseAsync()
    .then((response) => handleResponse(response))
    .catch(() => {});

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handleResponse(response);
  });

  return () => {
    active = false;
    sub.remove();
  };
}
