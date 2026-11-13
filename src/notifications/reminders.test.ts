import { SqliteRepo } from '@/data/sqliteRepo';
import {
  ALL_REMINDER_DAYS,
  MON_FRI_REMINDER_DAYS,
  SUN_THU_REMINDER_DAYS,
  normalizeReminderDays,
  normalizeReminderSettings,
} from '@/domain/types';
import { DEFAULT_SETTINGS } from '@/data/repo';
import {
  REMINDER_NOTIFICATION_CONTENT,
  buildReminderTriggerSpecs,
  parseReminderTime,
} from './reminders';

describe('reminders pure scheduling & day conversion', () => {
  it('parses valid HH:mm strings and rejects invalid ones', () => {
    expect(parseReminderTime('21:00')).toEqual({ hour: 21, minute: 0 });
    expect(parseReminderTime('00:05')).toEqual({ hour: 0, minute: 5 });
    expect(parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 });

    expect(parseReminderTime('24:00')).toBeNull();
    expect(parseReminderTime('21:60')).toBeNull();
    expect(parseReminderTime('9:00')).toBeNull();
    expect(parseReminderTime('abc')).toBeNull();
    expect(parseReminderTime('')).toBeNull();
  });

  it('converts legacy everyday/weekdays strings and sanitizes day arrays on read', () => {
    expect(normalizeReminderDays('everyday')).toEqual([...ALL_REMINDER_DAYS]);
    expect(normalizeReminderDays('weekdays')).toEqual([...MON_FRI_REMINDER_DAYS]);
    expect(normalizeReminderDays([4, 0, 2, 2, -1, 7, 1.5])).toEqual([0, 2, 4]);
    expect(normalizeReminderDays([])).toEqual([]);
    expect(normalizeReminderDays(undefined)).toEqual([...ALL_REMINDER_DAYS]);

    expect(
      normalizeReminderSettings(
        { enabled: true, time: '20:30', days: 'everyday' },
        DEFAULT_SETTINGS.reminder
      )
    ).toEqual({
      enabled: true,
      time: '20:30',
      days: [0, 1, 2, 3, 4, 5, 6],
    });

    expect(
      normalizeReminderSettings(
        { enabled: true, time: '21:00', days: 'weekdays' },
        DEFAULT_SETTINGS.reminder
      )
    ).toEqual({
      enabled: true,
      time: '21:00',
      days: [1, 2, 3, 4, 5],
    });
  });

  it('SqliteRepo.getSettings converts legacy everyday/weekdays DB rows to days: number[]', async () => {
    const fakeDb = {
      getAllAsync: jest.fn().mockResolvedValue([
        { key: 'onboarding_done', value: 'true' },
        { key: 'reminder', value: JSON.stringify({ enabled: true, time: '21:00', days: 'everyday' }) },
      ]),
    } as unknown as Parameters<typeof SqliteRepo extends new (db: infer D) => unknown ? (d: D) => void : never>[0];

    const repo = new SqliteRepo(fakeDb);
    const settings = await repo.getSettings();
    expect(settings.reminder).toEqual({
      enabled: true,
      time: '21:00',
      days: [0, 1, 2, 3, 4, 5, 6],
    });

    (fakeDb.getAllAsync as jest.Mock).mockResolvedValueOnce([
      { key: 'reminder', value: JSON.stringify({ enabled: true, time: '20:00', days: 'weekdays' }) },
    ]);
    const weekdaySettings = await repo.getSettings();
    expect(weekdaySettings.reminder.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('schedules one weekly trigger per selected day (0=Sun..6=Sat -> Expo 1=Sun..7=Sat)', () => {
    const everyday = buildReminderTriggerSpecs({
      enabled: true,
      time: '21:30',
      days: [...ALL_REMINDER_DAYS],
    });
    expect(everyday).toHaveLength(7);
    expect(everyday).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        kind: 'weekly',
        weekday,
        hour: 21,
        minute: 30,
      }))
    );

    const sunThu = buildReminderTriggerSpecs({
      enabled: true,
      time: '20:15',
      days: [...SUN_THU_REMINDER_DAYS],
    });
    expect(sunThu).toHaveLength(5);
    expect(sunThu).toEqual(
      [1, 2, 3, 4, 5].map((weekday) => ({
        kind: 'weekly',
        weekday,
        hour: 20,
        minute: 15,
      }))
    );

    expect(
      buildReminderTriggerSpecs({
        enabled: true,
        time: '21:00',
        days: [],
      })
    ).toEqual([]);
  });

  it('returns empty trigger list when disabled or invalid time (cancels all)', () => {
    expect(
      buildReminderTriggerSpecs({
        enabled: false,
        time: '21:00',
        days: [...ALL_REMINDER_DAYS],
      })
    ).toEqual([]);

    expect(
      buildReminderTriggerSpecs({
        enabled: true,
        time: '99:99',
        days: [...SUN_THU_REMINDER_DAYS],
      })
    ).toEqual([]);
  });

  it('notification content never contains amounts, digits, or currency symbols', () => {
    const combined = `${REMINDER_NOTIFICATION_CONTENT.title} ${REMINDER_NOTIFICATION_CONTENT.body}`;
    expect(combined).not.toMatch(/\d/);
    expect(combined).not.toMatch(/[৳$€]/);
    expect(REMINDER_NOTIFICATION_CONTENT.data.route).toBe('/check-in');
  });
});
