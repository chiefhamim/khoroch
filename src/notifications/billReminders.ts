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

/**
 * Lock-screen text: the bill name and when it is due. Never an amount (AGENTS.md section 5); the
 * strings have no amount placeholder and a test enforces that.
 */
export function buildBillReminderContent(reminder: BillReminder): BillReminderContent {
  const name = reminder.billName.trim();
  let title: string;
  if (reminder.daysUntilDue <= 0) {
    title = t('billReminder.titleToday', { name });
  } else if (reminder.daysUntilDue === 1) {
    title = t('billReminder.titleTomorrow', { name });
  } else {
    const days = getLocale() === 'bn' ? toBnDigits(String(reminder.daysUntilDue)) : reminder.daysUntilDue;
    title = t('billReminder.titleInDays', { name, days });
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
}

export interface SyncBillRemindersResult {
  scheduled: number;
  /** True when nothing needed changing because the right reminders were already scheduled. */
  unchanged?: boolean;
  /** True when reminders were wanted but the OS has not granted permission. */
  permissionMissing?: boolean;
}

let syncQueue: Promise<unknown> = Promise.resolve();
let lastSignature: string | null = null;

/**
 * Brings this feature's scheduled reminders in line with `input`. Safe to call as often as you like:
 * calls run one after another, and a call whose result would equal what is already scheduled does
 * nothing. Only identifiers with the bill prefix are ever cancelled. It never asks for permission.
 */
export function syncBillReminders(input: SyncBillRemindersInput): Promise<SyncBillRemindersResult> {
  const run = syncQueue.then(() => runSyncBillReminders(input));
  syncQueue = run.catch(() => {});
  return run;
}

type NotificationsModule = NonNullable<ReturnType<typeof loadNotifications>>;

async function listOwnIds(Notifications: NotificationsModule): Promise<string[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.map((r) => r.identifier).filter(isBillReminderId);
}

async function cancelOwn(Notifications: NotificationsModule): Promise<void> {
  for (const id of await listOwnIds(Notifications)) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

async function runSyncBillReminders(input: SyncBillRemindersInput): Promise<SyncBillRemindersResult> {
  if (Platform.OS === 'web') return { scheduled: 0 };
  const Notifications = loadNotifications();
  if (!Notifications) return { scheduled: 0 };

  try {
    if (!input.enabled) {
      await cancelOwn(Notifications);
      lastSignature = null;
      return { scheduled: 0 };
    }

    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      await cancelOwn(Notifications);
      lastSignature = null;
      return { scheduled: 0, permissionMissing: true };
    }

    const reminders = buildBillReminders(input);
    const items = reminders.map((reminder) => ({ reminder, content: buildBillReminderContent(reminder) }));
    const signature = items
      .map(
        ({ reminder, content }) =>
          `${reminder.id}|${reminder.fireAt.getTime()}|${content.title}|${content.body}`
      )
      .join('\n');

    const existing = await listOwnIds(Notifications);
    const wanted = new Set(items.map(({ reminder }) => reminder.id));
    if (
      lastSignature === signature &&
      existing.length === wanted.size &&
      existing.every((id) => wanted.has(id))
    ) {
      return { scheduled: items.length, unchanged: true };
    }

    for (const id of existing) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }

    let channelId: string | undefined;
    if (Platform.OS === 'android' && items.length > 0) {
      try {
        await Notifications.setNotificationChannelAsync(BILL_REMINDER_CHANNEL_ID, {
          name: t('billReminder.channelName'),
          importance: Notifications.AndroidImportance.DEFAULT,
        });
        channelId = BILL_REMINDER_CHANNEL_ID;
      } catch {
        channelId = undefined;
      }
    }

    for (const { reminder, content } of items) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: content.title, body: content.body, data: { ...content.data } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.fireAt,
          ...(channelId ? { channelId } : {}),
        },
      });
    }
    lastSignature = signature;
    return { scheduled: items.length };
  } catch (err) {
    lastSignature = null;
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
