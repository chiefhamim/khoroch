import { ALL_REMINDER_DAYS } from '@/domain/types';
import { syncReminderSchedule } from './reminders';

const mockState = {
  store: [] as { identifier: string }[],
  cancelled: [] as string[],
};

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly', DAILY: 'daily' },
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockState.store.map((s) => ({ ...s }))),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    mockState.cancelled.push(id);
    mockState.store = mockState.store.filter((s) => s.identifier !== id);
  }),
  scheduleNotificationAsync: jest.fn(async () => 'new-id'),
  setNotificationChannelAsync: jest.fn(async () => {}),
}));

describe('daily check-in sync and bill reminders share the schedule', () => {
  it('rescheduling the daily check-in leaves bill reminders alone', async () => {
    mockState.store = [
      { identifier: 'old-checkin-1' },
      { identifier: 'bill-due:rent:2026-11-05' },
      { identifier: 'old-checkin-2' },
      { identifier: 'bill-due:water:2026-11-12' },
    ];
    mockState.cancelled = [];
    await syncReminderSchedule({ enabled: false, time: '21:00', days: [...ALL_REMINDER_DAYS] });
    expect(mockState.cancelled.sort()).toEqual(['old-checkin-1', 'old-checkin-2']);
    expect(mockState.store.map((s) => s.identifier)).toEqual([
      'bill-due:rent:2026-11-05',
      'bill-due:water:2026-11-12',
    ]);
  });
});
