import { addDays, daysInMonth, formatLocalDate, parseLocalDate, todayLocalDate } from './dates';
import { isBillPaidInPeriod, isExpenseBillOutstanding } from './calc';
import { getPeriod } from './period';
import type { BillReminderLeadDays, LocalDate, Period, RecurringBill } from './types';

/**
 * Most bill reminders scheduled at once. Android limits the alarms one app may hold (500 on some
 * phones), and the other reminders share that budget, so 30 is a safe ceiling. The soonest 30 are
 * kept; the list is rebuilt on every app start, return to the app, and bill or settings change, so
 * later ones roll in as earlier ones pass.
 */
export const MAX_SCHEDULED_BILL_REMINDERS = 30;

/** Time of day used when no daily check-in time has been chosen. */
export const DEFAULT_BILL_REMINDER_TIME = '09:00';

/** Every identifier this feature schedules starts with this, so it can be cancelled without touching others. */
export const BILL_REMINDER_ID_PREFIX = 'bill-due:';

export interface BillReminder {
  /** `bill-due:<billId>:<fireDate>`: stable for the same bill and day, so rescheduling is idempotent. */
  id: string;
  billId: string;
  billName: string;
  /** Local date the bill is due. */
  dueDate: LocalDate;
  /** Local date the reminder fires (the due date, or lead days before it). */
  fireDate: LocalDate;
  /** Whole days from fireDate to dueDate: 0, or the lead days. */
  daysUntilDue: number;
  /** Local wall-clock moment the reminder fires. */
  fireAt: Date;
}

export interface BillReminderInput {
  bills: readonly RecurringBill[];
  /** The budget period containing `now`. */
  period: Period;
  /** Cycle start day (1..28), used to find the period after `period`. */
  monthStartDay: number;
  now: Date;
  leadDays: BillReminderLeadDays;
  /** 'HH:mm' local. Anything unreadable falls back to 09:00. */
  time?: string | null;
  maxCount?: number;
}

export function billReminderId(billId: string, fireDate: LocalDate): string {
  return `${BILL_REMINDER_ID_PREFIX}${billId}:${fireDate}`;
}

export function isBillReminderId(id: string): boolean {
  return id.startsWith(BILL_REMINDER_ID_PREFIX);
}

function readTime(value: string | null | undefined): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec((value ?? '').trim());
  if (match) {
    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    if (hour <= 23 && minute <= 59) return { hour, minute };
  }
  return { hour: 9, minute: 0 };
}

/**
 * The date inside `period` that falls on `dayOfMonth`, clamped to the length of that month
 * (a bill due on the 31st falls on the 30th in a 30-day month). When the due day is earlier than
 * the cycle start day it sits in the month after the period starts, the same rule as the EMI payoff.
 */
export function dueDateInPeriod(period: Pick<Period, 'start'>, dayOfMonth: number): LocalDate {
  const start = parseLocalDate(period.start);
  const shift = dayOfMonth < start.day ? 1 : 0;
  const zeroBased = start.year * 12 + (start.month - 1) + shift;
  const year = Math.floor(zeroBased / 12);
  const month = (zeroBased % 12) + 1;
  return formatLocalDate(year, month, Math.min(Math.max(1, dayOfMonth), daysInMonth(year, month)));
}

function atTime(date: LocalDate, time: { hour: number; minute: number }): Date {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day, time.hour, time.minute, 0, 0);
}

/**
 * The reminders to schedule, soonest first, at most `maxCount`.
 *
 * For every active, unfinished expense bill that is not paid for the period, one reminder on the due
 * date and, when `leadDays` is above 0, one `leadDays` before it. The following period's due date is
 * covered too (it cannot be paid yet), so reminders keep coming if the app is not opened for a while.
 * An instalment plan never gets more reminders than it has instalments left. Reminders already in the
 * past are dropped.
 */
export function buildBillReminders(input: BillReminderInput): BillReminder[] {
  const { bills, period, monthStartDay, now, leadDays } = input;
  const maxCount = input.maxCount ?? MAX_SCHEDULED_BILL_REMINDERS;
  const time = readTime(input.time);
  const nextPeriod = getPeriod(period.endExcl, monthStartDay);
  const offsets = leadDays > 0 ? [leadDays, 0] : [0];
  const nowMs = now.getTime();
  const out: BillReminder[] = [];

  for (const bill of bills) {
    if (!isExpenseBillOutstanding(bill)) continue;

    const dues: LocalDate[] = [];
    const currentUnpaid = !isBillPaidInPeriod(bill, period);
    if (currentUnpaid) dues.push(dueDateInPeriod(period, bill.dayOfMonth));
    let nextAllowed = !isBillPaidInPeriod(bill, nextPeriod);
    if (bill.kind === 'emi' && bill.totalInstallments != null) {
      const left = bill.totalInstallments - bill.paidInstallments;
      nextAllowed = nextAllowed && left >= (currentUnpaid ? 2 : 1);
    }
    if (nextAllowed) dues.push(dueDateInPeriod(nextPeriod, bill.dayOfMonth));

    for (const dueDate of dues) {
      for (const offset of offsets) {
        const fireDate = addDays(dueDate, -offset);
        const fireAt = atTime(fireDate, time);
        if (fireAt.getTime() <= nowMs) continue;
        out.push({
          id: billReminderId(bill.id, fireDate),
          billId: bill.id,
          billName: bill.name,
          dueDate,
          fireDate,
          daysUntilDue: offset,
          fireAt,
        });
      }
    }
  }

  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.slice(0, Math.max(0, maxCount));
}

/** Convenience for callers that only have the cycle start day: derives the current period from `now`. */
export function buildBillRemindersForNow(
  input: Omit<BillReminderInput, 'period'>
): BillReminder[] {
  return buildBillReminders({
    ...input,
    period: getPeriod(todayLocalDate(input.now), input.monthStartDay),
  });
}
