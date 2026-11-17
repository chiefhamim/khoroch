import {
  BILL_REMINDER_ID_PREFIX,
  MAX_SCHEDULED_BILL_REMINDERS,
  billReminderId,
  buildBillReminders,
  buildBillRemindersForNow,
  dueDateInPeriod,
  isBillReminderId,
  type BillReminder,
} from './billReminders';
import { getPeriod } from './period';
import type { RecurringBill } from './types';

function bill(over: Partial<RecurringBill> = {}): RecurringBill {
  return {
    id: 'rent',
    name: 'Rent',
    kind: 'bill',
    amountMinor: 1_000_000,
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

function at(y: number, m: number, d: number, h = 8, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function run(
  bills: RecurringBill[],
  now: Date,
  opts: { leadDays?: 0 | 1 | 3; monthStartDay?: number; time?: string | null; maxCount?: number } = {}
): BillReminder[] {
  return buildBillRemindersForNow({
    bills,
    monthStartDay: opts.monthStartDay ?? 1,
    now,
    leadDays: opts.leadDays ?? 1,
    time: opts.time === undefined ? '09:00' : opts.time,
    maxCount: opts.maxCount,
  });
}

const ids = (list: BillReminder[]) => list.map((r) => r.id);

describe('dueDateInPeriod', () => {
  it('falls in the period month when the due day is on or after the cycle start day', () => {
    expect(dueDateInPeriod(getPeriod('2026-11-17', 1), 5)).toBe('2026-11-05');
    expect(dueDateInPeriod(getPeriod('2026-11-17', 10), 15)).toBe('2026-11-15');
    expect(dueDateInPeriod(getPeriod('2026-11-17', 10), 10)).toBe('2026-11-10');
  });

  it('falls in the following month when the due day is before the cycle start day', () => {
    expect(dueDateInPeriod(getPeriod('2026-11-17', 10), 5)).toBe('2026-12-05');
    expect(dueDateInPeriod(getPeriod('2026-12-20', 10), 5)).toBe('2027-01-05');
  });

  it('clamps to the month length', () => {
    expect(dueDateInPeriod(getPeriod('2026-11-17', 1), 31)).toBe('2026-11-30');
    expect(dueDateInPeriod(getPeriod('2027-02-10', 1), 31)).toBe('2027-02-28');
    expect(dueDateInPeriod(getPeriod('2028-02-10', 1), 30)).toBe('2028-02-29');
    expect(dueDateInPeriod(getPeriod('2026-02-20', 15), 31)).toBe('2026-02-28');
    expect(dueDateInPeriod(getPeriod('2026-01-31', 28), 31)).toBe('2026-01-31');
  });
});

describe('buildBillReminders', () => {
  it('schedules the day before and the due day, for this period and the next, soonest first', () => {
    const list = run([bill()], at(2026, 11, 2));
    expect(ids(list)).toEqual([
      'bill-due:rent:2026-11-04',
      'bill-due:rent:2026-11-05',
      'bill-due:rent:2026-12-04',
      'bill-due:rent:2026-12-05',
    ]);
    expect(list.map((r) => r.dueDate)).toEqual(['2026-11-05', '2026-11-05', '2026-12-05', '2026-12-05']);
    expect(list.map((r) => r.daysUntilDue)).toEqual([1, 0, 1, 0]);
    expect(list[0].fireAt.getTime()).toBe(at(2026, 11, 4, 9, 0).getTime());
    expect(list[1].fireAt.getTime()).toBe(at(2026, 11, 5, 9, 0).getTime());
    expect(list[0].billName).toBe('Rent');
    expect(list[0].billId).toBe('rent');
  });

  it('skips a bill that is already paid this period but keeps the next period', () => {
    const paid = bill({ lastPaidPeriod: '2026-11-01' });
    expect(ids(run([paid], at(2026, 11, 2)))).toEqual([
      'bill-due:rent:2026-12-04',
      'bill-due:rent:2026-12-05',
    ]);
  });

  it('is unpaid again when the stamp belongs to an older period', () => {
    const old = bill({ lastPaidPeriod: '2026-10-01' });
    expect(ids(run([old], at(2026, 11, 2))).slice(0, 2)).toEqual([
      'bill-due:rent:2026-11-04',
      'bill-due:rent:2026-11-05',
    ]);
  });

  it('never schedules in the past', () => {
    // After the early reminder time but before the due-day time.
    expect(ids(run([bill()], at(2026, 11, 5, 8, 0))).slice(0, 2)).toEqual([
      'bill-due:rent:2026-11-05',
      'bill-due:rent:2026-12-04',
    ]);
    // After the due-day time: this period is finished, only the next remains.
    expect(ids(run([bill()], at(2026, 11, 5, 10, 0)))).toEqual([
      'bill-due:rent:2026-12-04',
      'bill-due:rent:2026-12-05',
    ]);
    // Exactly at the fire time counts as past.
    expect(ids(run([bill()], at(2026, 11, 5, 9, 0))).slice(0, 1)).toEqual(['bill-due:rent:2026-12-04']);
  });

  it('on the day only when lead days is 0, and 3 days before when it is 3', () => {
    expect(ids(run([bill()], at(2026, 11, 2), { leadDays: 0 }))).toEqual([
      'bill-due:rent:2026-11-05',
      'bill-due:rent:2026-12-05',
    ]);
    const three = run([bill()], at(2026, 11, 1), { leadDays: 3 });
    expect(ids(three)).toEqual([
      'bill-due:rent:2026-11-02',
      'bill-due:rent:2026-11-05',
      'bill-due:rent:2026-12-02',
      'bill-due:rent:2026-12-05',
    ]);
    expect(three.map((r) => r.daysUntilDue)).toEqual([3, 0, 3, 0]);
  });

  it('uses the given time of day and falls back to 09:00 when it cannot be read', () => {
    const early = run([bill()], at(2026, 11, 2), { time: '07:30' });
    expect(early[0].fireAt.getHours()).toBe(7);
    expect(early[0].fireAt.getMinutes()).toBe(30);
    for (const bad of ['', '9:00', '25:00', '12:61', 'abc', null]) {
      const r = run([bill()], at(2026, 11, 2), { time: bad });
      expect(r[0].fireAt.getHours()).toBe(9);
      expect(r[0].fireAt.getMinutes()).toBe(0);
    }
  });

  it('clamps a bill due on the 31st to the last day of a shorter month', () => {
    const list = run([bill({ id: 'b31', dayOfMonth: 31 })], at(2026, 11, 20));
    expect(ids(list)).toEqual([
      'bill-due:b31:2026-11-29',
      'bill-due:b31:2026-11-30',
      'bill-due:b31:2026-12-30',
      'bill-due:b31:2026-12-31',
    ]);
    const feb = run([bill({ id: 'b31', dayOfMonth: 31 })], at(2027, 2, 1));
    expect(ids(feb).slice(0, 2)).toEqual(['bill-due:b31:2027-02-27', 'bill-due:b31:2027-02-28']);
    const leap = run([bill({ id: 'b31', dayOfMonth: 31 })], at(2028, 2, 1));
    expect(ids(leap).slice(0, 2)).toEqual(['bill-due:b31:2028-02-28', 'bill-due:b31:2028-02-29']);
  });

  it('crosses the year boundary, including a due day early in January', () => {
    const list = run([bill({ id: 'jan', dayOfMonth: 1 })], at(2026, 12, 20));
    expect(ids(list)).toEqual(['bill-due:jan:2026-12-31', 'bill-due:jan:2027-01-01']);
    // The early reminder for the 1st lands on the last day of the old year, in the previous period.
    const first = run([bill({ id: 'jan', dayOfMonth: 1 })], at(2026, 12, 20));
    expect(first[0].dueDate).toBe('2027-01-01');
    expect(first[0].fireDate).toBe('2026-12-31');
  });

  it('follows a cycle start day other than 1', () => {
    // Period 10 Nov to 9 Dec. Day 5 is due on 5 Dec (inside this period), day 15 on 15 Nov.
    const list = run(
      [bill({ id: 'five', dayOfMonth: 5 }), bill({ id: 'fifteen', dayOfMonth: 15 })],
      at(2026, 11, 12),
      { monthStartDay: 10, leadDays: 0 }
    );
    expect(list.map((r) => [r.id, r.dueDate])).toEqual([
      ['bill-due:fifteen:2026-11-15', '2026-11-15'],
      ['bill-due:fifteen:2026-12-15', '2026-12-15'],
      ['bill-due:five:2026-12-05', '2026-12-05'],
      ['bill-due:five:2027-01-05', '2027-01-05'],
    ].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)));
  });

  it('treats a bill as paid only for the period that holds its stamp under a custom cycle day', () => {
    // Paid for the 10 Nov period: only the next period remains.
    const paid = bill({ id: 'p', dayOfMonth: 15, lastPaidPeriod: '2026-11-10' });
    expect(ids(run([paid], at(2026, 11, 12), { monthStartDay: 10, leadDays: 0 }))).toEqual([
      'bill-due:p:2026-12-15',
    ]);
  });

  it('skips inactive bills, salary and finished instalment plans', () => {
    const list = run(
      [
        bill({ id: 'off', isActive: false }),
        bill({ id: 'pay', kind: 'salary' }),
        bill({ id: 'done', kind: 'emi', totalInstallments: 6, paidInstallments: 6 }),
        bill({ id: 'ok', dayOfMonth: 20 }),
      ],
      at(2026, 11, 2)
    );
    expect(new Set(list.map((r) => r.billId))).toEqual(new Set(['ok']));
  });

  it('never gives an instalment plan more reminders than instalments left', () => {
    // One left and unpaid: only this period's due date.
    const lastOne = bill({ id: 'e1', kind: 'emi', totalInstallments: 6, paidInstallments: 5 });
    expect(ids(run([lastOne], at(2026, 11, 2), { leadDays: 0 }))).toEqual(['bill-due:e1:2026-11-05']);
    // Two left and unpaid: this and next.
    const two = bill({ id: 'e2', kind: 'emi', totalInstallments: 6, paidInstallments: 4 });
    expect(ids(run([two], at(2026, 11, 2), { leadDays: 0 }))).toEqual([
      'bill-due:e2:2026-11-05',
      'bill-due:e2:2026-12-05',
    ]);
    // This period's instalment is paid and one is left: just the next.
    const paidOne = bill({
      id: 'e3',
      kind: 'emi',
      totalInstallments: 6,
      paidInstallments: 5,
      lastPaidPeriod: '2026-11-01',
    });
    expect(ids(run([paidOne], at(2026, 11, 2), { leadDays: 0 }))).toEqual(['bill-due:e3:2026-12-05']);
  });

  it('keeps only the soonest reminders up to the cap, in order', () => {
    expect(MAX_SCHEDULED_BILL_REMINDERS).toBe(30);
    const many = Array.from({ length: 20 }, (_, i) =>
      bill({ id: `b${String(i).padStart(2, '0')}`, dayOfMonth: 3 + (i % 20) })
    );
    const all = run(many, at(2026, 11, 1), { maxCount: 1000 });
    expect(all.length).toBeGreaterThan(30);
    const capped = run(many, at(2026, 11, 1));
    expect(capped).toHaveLength(30);
    expect(ids(capped)).toEqual(ids(all).slice(0, 30));
    const times = capped.map((r) => r.fireAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(run(many, at(2026, 11, 1), { maxCount: 5 })).toHaveLength(5);
    expect(run(many, at(2026, 11, 1), { maxCount: 0 })).toEqual([]);
  });

  it('gives the same list and the same identifiers on a second run', () => {
    const bills = [bill(), bill({ id: 'water', name: 'Water', dayOfMonth: 12 })];
    const a = run(bills, at(2026, 11, 2));
    const b = run(bills, at(2026, 11, 2, 8, 30));
    expect(ids(a)).toEqual(ids(b));
    expect(new Set(ids(a)).size).toBe(a.length);
  });

  it('accepts an explicit period', () => {
    const list = buildBillReminders({
      bills: [bill()],
      period: getPeriod('2026-11-02', 1),
      monthStartDay: 1,
      now: at(2026, 11, 2),
      leadDays: 0,
    });
    expect(ids(list)).toEqual(['bill-due:rent:2026-11-05', 'bill-due:rent:2026-12-05']);
  });
});

describe('bill reminder identifiers', () => {
  it('derives the id from the bill id and the fire date, under one prefix', () => {
    expect(billReminderId('abc', '2026-11-04')).toBe('bill-due:abc:2026-11-04');
    expect(BILL_REMINDER_ID_PREFIX).toBe('bill-due:');
    expect(isBillReminderId('bill-due:abc:2026-11-04')).toBe(true);
    expect(isBillReminderId('daily-checkin')).toBe(false);
    expect(isBillReminderId('xbill-due:abc')).toBe(false);
  });
});
