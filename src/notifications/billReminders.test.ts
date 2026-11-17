import { en } from '@/i18n/en';
import { bn } from '@/i18n/bn';
import { setLocale } from '@/i18n';
import type { RecurringBill } from '@/domain/types';
import {
  BILL_REMINDER_DATA_KIND,
  BILL_REMINDER_ROUTE,
  buildBillReminderContent,
  subscribeToBillReminderResponses,
  syncBillReminders,
  type SyncBillRemindersInput,
} from './billReminders';

interface Stored {
  identifier: string;
  content: { title?: string; body?: string; data?: Record<string, unknown> };
  trigger: { type: string; date: Date; channelId?: string };
}

const mockState = {
  store: [] as Stored[],
  granted: true,
  cancelled: [] as string[],
  listener: null as null | ((r: unknown) => void),
  lastResponse: null as unknown,
  removed: 0,
};

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 2 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly', DAILY: 'daily' },
  getPermissionsAsync: jest.fn(async () => ({ granted: mockState.granted, canAskAgain: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockState.store.map((s) => ({ ...s }))),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    mockState.cancelled.push(id);
    mockState.store = mockState.store.filter((s) => s.identifier !== id);
  }),
  scheduleNotificationAsync: jest.fn(async (req: Stored & { identifier: string }) => {
    mockState.store = mockState.store.filter((s) => s.identifier !== req.identifier);
    mockState.store.push({ identifier: req.identifier, content: req.content, trigger: req.trigger });
    return req.identifier;
  }),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getLastNotificationResponseAsync: jest.fn(async () => mockState.lastResponse),
  addNotificationResponseReceivedListener: jest.fn((cb: (r: unknown) => void) => {
    mockState.listener = cb;
    return {
      remove: () => {
        mockState.removed += 1;
      },
    };
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NotificationsMock = require('expo-notifications') as {
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  getPermissionsAsync: jest.Mock;
};

function bill(over: Partial<RecurringBill> = {}): RecurringBill {
  return {
    id: 'rent',
    name: 'Rent',
    kind: 'bill',
    amountMinor: 1_234_500,
    dayOfMonth: 5,
    categoryId: null,
    accountId: null,
    totalInstallments: null,
    paidInstallments: 0,
    lastPaidPeriod: null,
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const NOW = new Date(2026, 10, 2, 8, 0, 0, 0);

function input(over: Partial<SyncBillRemindersInput> = {}): SyncBillRemindersInput {
  return {
    enabled: true,
    bills: [bill()],
    period: { start: '2026-11-01', endExcl: '2026-12-01', lengthDays: 30 },
    monthStartDay: 1,
    now: NOW,
    leadDays: 1,
    time: '09:00',
    ...over,
  };
}

const FOREIGN: Stored = {
  identifier: 'daily-weekly-2',
  content: { title: 'Daily money check-in' },
  trigger: { type: 'weekly', date: NOW },
};

const own = () => mockState.store.filter((s) => s.identifier.startsWith('bill-due:'));

beforeEach(async () => {
  setLocale('en');
  mockState.granted = true;
  // Resets the module's remembered signature, then starts each test from an empty schedule.
  await syncBillReminders(input({ enabled: false }));
  mockState.store = [{ ...FOREIGN }];
  mockState.cancelled = [];
  mockState.lastResponse = null;
  mockState.listener = null;
  mockState.removed = 0;
  NotificationsMock.scheduleNotificationAsync.mockClear();
  NotificationsMock.cancelScheduledNotificationAsync.mockClear();
});

describe('syncBillReminders', () => {
  it('schedules the expected identifiers at the expected local times', async () => {
    const res = await syncBillReminders(input());
    expect(res.scheduled).toBe(4);
    expect(own().map((s) => s.identifier).sort()).toEqual([
      'bill-due:rent:2026-11-04',
      'bill-due:rent:2026-11-05',
      'bill-due:rent:2026-12-04',
      'bill-due:rent:2026-12-05',
    ]);
    const early = mockState.store.find((s) => s.identifier === 'bill-due:rent:2026-11-04')!;
    expect(early.trigger.type).toBe('date');
    expect(early.trigger.date.getTime()).toBe(new Date(2026, 10, 4, 9, 0, 0, 0).getTime());
    expect(early.content.title).toBe('Rent is due tomorrow');
    expect(early.content.data).toEqual({
      kind: BILL_REMINDER_DATA_KIND,
      route: BILL_REMINDER_ROUTE,
      billId: 'rent',
      fireMs: new Date(2026, 10, 4, 9, 0, 0, 0).getTime(),
    });
    const day =mockState.store.find((s) => s.identifier === 'bill-due:rent:2026-11-05')!;
    expect(day.content.title).toBe('Rent is due today');
  });

  it('never touches notifications that are not its own', async () => {
    await syncBillReminders(input());
    await syncBillReminders(input({ bills: [bill({ id: 'water', name: 'Water' })] }));
    await syncBillReminders(input({ enabled: false }));
    expect(mockState.store).toEqual([FOREIGN]);
    expect(mockState.cancelled.every((id) => id.startsWith('bill-due:'))).toBe(true);
    expect(mockState.cancelled).not.toContain(FOREIGN.identifier);
  });

  it('cancels its own reminders and schedules nothing when switched off', async () => {
    await syncBillReminders(input());
    expect(own()).toHaveLength(4);
    NotificationsMock.scheduleNotificationAsync.mockClear();
    const res = await syncBillReminders(input({ enabled: false }));
    expect(res.scheduled).toBe(0);
    expect(own()).toHaveLength(0);
    expect(NotificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does nothing when permission is missing, and never asks for it', async () => {
    mockState.granted = false;
    const res = await syncBillReminders(input());
    expect(res).toEqual({ scheduled: 0, permissionMissing: true });
    expect(NotificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(own()).toHaveLength(0);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as Record<string, unknown>;
    expect(mod.requestPermissionsAsync).toBeUndefined();
  });

  it('drops reminders already scheduled when permission is later revoked', async () => {
    await syncBillReminders(input());
    expect(own()).toHaveLength(4);
    mockState.granted = false;
    await syncBillReminders(input());
    expect(own()).toHaveLength(0);
    expect(mockState.store).toEqual([FOREIGN]);
  });

  it('is idempotent: a second run changes nothing and schedules nothing new', async () => {
    await syncBillReminders(input());
    const before = JSON.stringify(own());
    NotificationsMock.scheduleNotificationAsync.mockClear();
    mockState.cancelled = [];
    const res = await syncBillReminders(input());
    expect(res).toEqual({ scheduled: 4, unchanged: true });
    expect(NotificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockState.cancelled).toEqual([]);
    expect(JSON.stringify(own())).toBe(before);
  });

  it('repairs the schedule if something cancelled it behind its back', async () => {
    await syncBillReminders(input());
    mockState.store = mockState.store.filter((s) => s.identifier !== 'bill-due:rent:2026-11-05');
    const res = await syncBillReminders(input());
    expect(res.unchanged).toBeUndefined();
    expect(own()).toHaveLength(4);
  });

  it('drops the reminders of a bill marked paid and keeps the rest', async () => {
    await syncBillReminders(input());
    await syncBillReminders(input({ bills: [bill({ lastPaidPeriod: '2026-11-01' })] }));
    expect(own().map((s) => s.identifier).sort()).toEqual([
      'bill-due:rent:2026-12-04',
      'bill-due:rent:2026-12-05',
    ]);
    expect(mockState.cancelled).toEqual(
      expect.arrayContaining(['bill-due:rent:2026-11-04', 'bill-due:rent:2026-11-05'])
    );
    // Marked unpaid again: they come back.
    await syncBillReminders(input());
    expect(own()).toHaveLength(4);
  });

  it('reschedules when the lead time changes', async () => {
    await syncBillReminders(input());
    await syncBillReminders(input({ leadDays: 0 }));
    expect(own().map((s) => s.identifier).sort()).toEqual([
      'bill-due:rent:2026-11-05',
      'bill-due:rent:2026-12-05',
    ]);
  });

  it('rebuilds the text when the language changes', async () => {
    await syncBillReminders(input({ leadDays: 0 }));
    expect(own()[0].content.title).toBe('Rent is due today');
    setLocale('bn');
    await syncBillReminders(input({ leadDays: 0 }));
    expect(own()[0].content.title).toBe('Rent আজ পরিশোধের দিন');
  });

  it('runs queued calls in order so the last one wins', async () => {
    const a = syncBillReminders(input());
    const b = syncBillReminders(input({ enabled: false }));
    const c = syncBillReminders(input({ leadDays: 0 }));
    await Promise.all([a, b, c]);
    expect(own().map((s) => s.identifier).sort()).toEqual([
      'bill-due:rent:2026-11-05',
      'bill-due:rent:2026-12-05',
    ]);
  });
});

describe('syncBillReminders: only the difference is touched', () => {
  const callCounts = () => ({
    schedule: NotificationsMock.scheduleNotificationAsync.mock.calls.length,
    cancel: NotificationsMock.cancelScheduledNotificationAsync.mock.calls.length,
  });

  it('makes zero cancel and zero schedule calls on a second run after a restart', async () => {
    await syncBillReminders(input());
    // The schedule lives in the OS and the module keeps no memory of it, so a restart is just
    // another run against what the OS already holds. Android reports a date trigger as { value: ms }.
    mockState.store = mockState.store.map((s) =>
      s.identifier.startsWith('bill-due:')
        ? ({ ...s, trigger: { type: 'date', value: s.trigger.date.getTime() } } as unknown as Stored)
        : s
    );
    NotificationsMock.scheduleNotificationAsync.mockClear();
    NotificationsMock.cancelScheduledNotificationAsync.mockClear();
    const res = await syncBillReminders(input());
    expect(res).toEqual({ scheduled: 4, unchanged: true });
    expect(callCounts()).toEqual({ schedule: 0, cancel: 0 });
  });

  it('iOS reports a time interval with no date: compares the stored fire time, no reschedule', async () => {
    await syncBillReminders(input());
    mockState.store = mockState.store.map((s) =>
      s.identifier.startsWith('bill-due:')
        ? ({ ...s, trigger: { type: 'timeInterval', seconds: 3600, repeats: false } } as unknown as Stored)
        : s
    );
    NotificationsMock.scheduleNotificationAsync.mockClear();
    NotificationsMock.cancelScheduledNotificationAsync.mockClear();
    const same = await syncBillReminders(input());
    expect(same).toEqual({ scheduled: 4, unchanged: true });
    expect(callCounts()).toEqual({ schedule: 0, cancel: 0 });
    // A real change in fire time is still noticed through the payload.
    await syncBillReminders(input({ time: '10:30' }));
    expect(callCounts().schedule).toBe(4);
  });

  it('reschedules only the reminders whose time changed', async () => {
    await syncBillReminders(input({ bills: [bill(), bill({ id: 'water', name: 'Water', dayOfMonth: 20 })] }));
    NotificationsMock.scheduleNotificationAsync.mockClear();
    NotificationsMock.cancelScheduledNotificationAsync.mockClear();
    // Move only the rent reminders: bill day 5 -> 6.
    await syncBillReminders(
      input({ bills: [bill({ dayOfMonth: 6 }), bill({ id: 'water', name: 'Water', dayOfMonth: 20 })] })
    );
    const scheduled = NotificationsMock.scheduleNotificationAsync.mock.calls.map(
      (c: [{ identifier: string }]) => c[0].identifier
    );
    expect(scheduled.sort()).toEqual([
      'bill-due:rent:2026-11-05',
      'bill-due:rent:2026-11-06',
      'bill-due:rent:2026-12-05',
      'bill-due:rent:2026-12-06',
    ]);
    const cancelled = NotificationsMock.cancelScheduledNotificationAsync.mock.calls.map(
      (c: [string]) => c[0]
    );
    expect(cancelled.every((id: string) => id.startsWith('bill-due:rent:'))).toBe(true);
    expect(own().filter((s) => s.identifier.includes(':water:'))).toHaveLength(4);
  });

  it('reschedules a reminder whose fire time moved but keeps the others', async () => {
    await syncBillReminders(input());
    NotificationsMock.scheduleNotificationAsync.mockClear();
    NotificationsMock.cancelScheduledNotificationAsync.mockClear();
    await syncBillReminders(input({ time: '10:30' }));
    expect(callCounts().schedule).toBe(4);
    expect(callCounts().cancel).toBe(0);
    const day = mockState.store.find((s) => s.identifier === 'bill-due:rent:2026-11-05')!;
    expect(day.trigger.date.getTime()).toBe(new Date(2026, 10, 5, 10, 30, 0, 0).getTime());
  });
});

describe('syncBillReminders: bill names on the lock screen', () => {
  const secret = 'Zamindar Landlord';
  const secretBill = () => bill({ id: 'b1', name: secret });
  const allText = () => JSON.stringify(mockState.store.filter((s) => s.identifier.startsWith('bill-due:')));

  it('puts the bill name in the notification when names are not hidden', async () => {
    await syncBillReminders(input({ bills: [secretBill()] }));
    expect(allText()).toContain(secret);
  });

  it('keeps every bill name out of what is scheduled when names are hidden', async () => {
    await syncBillReminders(input({ bills: [secretBill()], leadDays: 3, hideNames: true }));
    expect(own().length).toBeGreaterThan(0);
    expect(allText()).not.toContain(secret);
    expect(own().map((s) => s.content.title).sort()).toEqual([
      'A bill is due in 3 days',
      'A bill is due in 3 days',
      'A bill is due today',
      'A bill is due today',
    ]);
  });

  it('rewrites already scheduled reminders when hiding is turned on', async () => {
    await syncBillReminders(input({ bills: [secretBill()] }));
    expect(allText()).toContain(secret);
    await syncBillReminders(input({ bills: [secretBill()], hideNames: true }));
    expect(allText()).not.toContain(secret);
  });

  it('has generic titles in both languages, singular for one day and no name', () => {
    const reminder = (daysUntilDue: number) => ({
      id: 'bill-due:b1:2026-11-05',
      billId: 'b1',
      billName: secret,
      dueDate: '2026-11-05',
      fireDate: '2026-11-05',
      daysUntilDue,
      fireAt: NOW,
    });
    setLocale('en');
    expect(buildBillReminderContent(reminder(0), { hideNames: true }).title).toBe('A bill is due today');
    expect(buildBillReminderContent(reminder(1), { hideNames: true }).title).toBe('A bill is due tomorrow');
    expect(buildBillReminderContent(reminder(3), { hideNames: true }).title).toBe('A bill is due in 3 days');
    setLocale('bn');
    expect(buildBillReminderContent(reminder(3), { hideNames: true }).title).toBe(
      'একটি বিল ৩ দিন পরে পরিশোধের দিন'
    );
    expect(buildBillReminderContent(reminder(0), { hideNames: true }).title).not.toContain(secret);
    setLocale('en');
  });

  it('asks the person to mark it paid only if already paid, without claiming it is unpaid', () => {
    setLocale('en');
    const c = buildBillReminderContent(
      { id: 'x', billId: 'b1', billName: 'Rent', dueDate: '2026-11-05', fireDate: '2026-11-05', daysUntilDue: 0, fireAt: NOW },
      { hideNames: true }
    );
    expect(c.body).toBe('If you have already paid it, open Plan and mark it paid.');
    expect(c.body.toLowerCase()).not.toContain('unpaid');
  });
});

describe('bill reminder text', () => {
  const reminder = (daysUntilDue: number) => ({
    id: 'bill-due:x:2026-11-05',
    billId: 'x',
    billName: 'Electricity bill',
    dueDate: '2026-11-05',
    fireDate: '2026-11-05',
    daysUntilDue,
    fireAt: NOW,
  });

  it('says when it is due in English', () => {
    setLocale('en');
    expect(buildBillReminderContent(reminder(0)).title).toBe('Electricity bill is due today');
    expect(buildBillReminderContent(reminder(1)).title).toBe('Electricity bill is due tomorrow');
    expect(buildBillReminderContent(reminder(3)).title).toBe('Electricity bill is due in 3 days');
  });

  it('says when it is due in Bangla, with Bangla digits', () => {
    setLocale('bn');
    expect(buildBillReminderContent(reminder(0)).title).toBe('Electricity bill আজ পরিশোধের দিন');
    expect(buildBillReminderContent(reminder(3)).title).toBe(
      'Electricity bill ৩ দিন পরে পরিশোধের দিন'
    );
    setLocale('en');
  });

  it('never carries an amount or an ellipsis', () => {
    for (const locale of ['en', 'bn'] as const) {
      setLocale(locale);
      for (const d of [0, 1, 3]) {
        const c = buildBillReminderContent({ ...reminder(d), billName: 'Rent' });
        const text = `${c.title} ${c.body}`;
        expect(text).not.toMatch(/[৳$€]/);
        expect(text).not.toMatch(/\.\.\.|…/);
        expect(text).not.toMatch(/\d{2,}/);
        expect(JSON.stringify(c.data)).not.toMatch(/1234500|amount/i);
      }
    }
    setLocale('en');
  });

  it('has no amount placeholder in any notification string template, in either language', () => {
    const allowed = new Set(['name', 'days']);
    for (const dict of [en, bn] as Record<string, string>[]) {
      const keys = Object.keys(dict).filter((k) => k.startsWith('billReminder.'));
      expect(keys.length).toBeGreaterThanOrEqual(6);
      for (const key of keys) {
        const text = dict[key];
        for (const m of text.matchAll(/\{(\w+)\}/g)) {
          expect(allowed.has(m[1])).toBe(true);
        }
        expect(text).not.toMatch(/amount|total|balance|price|fee|[৳$€]|টাকা|পরিমাণ/i);
        expect(text).not.toMatch(/\.\.\.|…/);
      }
    }
  });
});

describe('subscribeToBillReminderResponses', () => {
  const response = (kind: unknown, id = 'n1') => ({
    actionIdentifier: 'default',
    notification: { request: { identifier: id, content: { data: { kind } } } },
  });

  it('opens Plan when a bill reminder is tapped, once per notification', async () => {
    const open = jest.fn();
    const stop = subscribeToBillReminderResponses(open);
    mockState.listener?.(response(BILL_REMINDER_DATA_KIND, 'tap-1'));
    mockState.listener?.(response(BILL_REMINDER_DATA_KIND, 'tap-1'));
    expect(open).toHaveBeenCalledTimes(1);
    mockState.listener?.(response('something-else', 'tap-2'));
    expect(open).toHaveBeenCalledTimes(1);
    stop();
    expect(mockState.removed).toBe(1);
    mockState.listener?.(response(BILL_REMINDER_DATA_KIND, 'tap-3'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('opens Plan for the tap that launched the app', async () => {
    mockState.lastResponse = response(BILL_REMINDER_DATA_KIND, 'cold-1');
    const open = jest.fn();
    const stop = subscribeToBillReminderResponses(open);
    await Promise.resolve();
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
    stop();
  });
});
