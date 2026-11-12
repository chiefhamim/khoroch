import { Platform } from 'react-native';
import type { ReminderSettings } from '@/domain/types';

export interface ParsedReminderTime {
  hour: number;
  minute: number;
}

export type ReminderTriggerSpec =
  | {
      kind: 'daily';
      hour: number;
      minute: number;
    }
  | {
      kind: 'weekly';
      weekday: number; // 1 = Sunday .. 7 = Saturday (Expo Notifications convention)
      hour: number;
      minute: number;
    };

/** Monday–Friday in Expo Notifications weekday numbering (1 = Sun .. 7 = Sat). */
export const WEEKDAY_NUMBERS: readonly number[] = [2, 3, 4, 5, 6];

export const REMINDER_CHANNEL_ID = 'daily-checkin';

/**
 * Reminder text strictly avoids financial numbers, currency symbols, or totals
 * to protect lock-screen privacy (SPEC §12.2 / DECISIONS).
 */
export const REMINDER_NOTIFICATION_CONTENT = {
  title: 'Daily money check-in',
  body: "Take a minute to log today's expenses and review your day.",
  data: { route: '/check-in' },
} as const;

export function parseReminderTime(value: string): ParsedReminderTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

/**
 * Pure scheduler builder: returns the trigger list to register, or `[]` when reminders
 * are disabled or the configured time is invalid (signaling cancel-all with no reschedule).
 */
export function buildReminderTriggerSpecs(reminder: ReminderSettings): ReminderTriggerSpec[] {
  if (!reminder.enabled) return [];
  const parsed = parseReminderTime(reminder.time);
  if (!parsed) return [];

  if (reminder.days === 'everyday') {
    return [{ kind: 'daily', hour: parsed.hour, minute: parsed.minute }];
  }

  return WEEKDAY_NUMBERS.map((weekday) => ({
    kind: 'weekly',
    weekday,
    hour: parsed.hour,
    minute: parsed.minute,
  }));
}

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

export function isNotificationsSupported(): boolean {
  return Platform.OS !== 'web';
}

export function configureNotificationHandler(): void {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Ignore unsupported handler registration.
  }
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const Notifications = loadNotifications();
  if (!Notifications) return 'unsupported';
  try {
    const res = await Notifications.getPermissionsAsync();
    if (res.granted) return 'granted';
    if (!res.canAskAgain || res.status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied'> {
  const Notifications = loadNotifications();
  if (!Notifications) return 'denied';
  try {
    const res = await Notifications.requestPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function cancelAllReminders(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignore on unsupported runtimes.
  }
}

/**
 * Cancels all existing reminders and (when enabled + permitted) schedules fresh local triggers.
 * Re-running on app start ensures timezone changes take effect without duplicates.
 */
export async function syncReminderSchedule(
  reminder: ReminderSettings
): Promise<{ scheduled: number; permissionDenied?: boolean }> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return { scheduled: 0 };
  }

  await cancelAllReminders();

  const specs = buildReminderTriggerSpecs(reminder);
  if (specs.length === 0) {
    return { scheduled: 0 };
  }

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      return {
        scheduled: 0,
        permissionDenied: perm.status === 'denied' || !perm.canAskAgain,
      };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Daily Check-in Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    for (const spec of specs) {
      const trigger =
        spec.kind === 'daily'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              channelId: REMINDER_CHANNEL_ID,
              hour: spec.hour,
              minute: spec.minute,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              channelId: REMINDER_CHANNEL_ID,
              weekday: spec.weekday,
              hour: spec.hour,
              minute: spec.minute,
            };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: REMINDER_NOTIFICATION_CONTENT.title,
          body: REMINDER_NOTIFICATION_CONTENT.body,
          data: { ...REMINDER_NOTIFICATION_CONTENT.data },
        },
        trigger,
      });
    }

    return { scheduled: specs.length };
  } catch {
    return { scheduled: 0 };
  }
}

export function subscribeToCheckInResponses(onOpenCheckIn: () => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};

  let active = true;

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!active || !response) return;
      if (response.notification.request.content.data?.route === '/check-in') {
        onOpenCheckIn();
      }
    })
    .catch(() => {});

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.content.data?.route === '/check-in') {
      onOpenCheckIn();
    }
  });

  return () => {
    active = false;
    sub.remove();
  };
}
