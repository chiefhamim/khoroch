import { daysInMonth, formatLocalDate, isValidLocalDate, parseLocalDate } from './dates';
import { isPaidInPeriod } from './calc';
import type { Period, RecurringBill } from './types';

export type EmiPayoffState = 'finished' | 'paused' | 'active';

export interface EmiPayoff {
  state: EmiPayoffState;
  totalInstallments: number;
  /** Clamped to 0..total. */
  paidInstallments: number;
  leftInstallments: number;
  totalMinor: number;
  paidMinor: number;
  leftMinor: number;
  /** Whole percent 0..100, integer maths. */
  pct: number;
  /** Month the last instalment falls due (1..12). Null when finished or paused. */
  endYear: number | null;
  endMonth: number | null;
  /**
   * Whole budget periods before the current one that passed with no instalment marked paid.
   * 0 when up to date, paused, finished, never paid (no baseline), or this period is already paid.
   * Never more than leftInstallments.
   */
  behindPeriods: number;
}

const MAX_BEHIND_SCAN = 1200;

// The one date-based paid predicate lives in calc.ts; re-exported so existing imports keep working.
export { isPaidInPeriod };

/**
 * Periods strictly between the last payment stamp and the current period that have no payment.
 * The periods are the grid of period starts on the current cycle start day (clamped to month length),
 * so a stamp left over from before the cycle day was changed is compared by date, not by text. A start
 * date counts as missed when lastPaid < start < currentStart. Never paid (or an unreadable stamp) gives 0.
 */
export function countBehindPeriods(
  lastPaidPeriod: string | null | undefined,
  periodStart: string
): number {
  if (lastPaidPeriod == null || !isValidLocalDate(lastPaidPeriod) || !isValidLocalDate(periodStart)) {
    return 0;
  }
  if (lastPaidPeriod >= periodStart) return 0;
  const cur = parseLocalDate(periodStart);
  let index = cur.year * 12 + (cur.month - 1) - 1;
  let behind = 0;
  for (let i = 0; i < MAX_BEHIND_SCAN; i += 1, index -= 1) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const start = formatLocalDate(year, month, Math.min(cur.day, daysInMonth(year, month)));
    if (start > lastPaidPeriod) behind += 1;
    else break;
  }
  return behind;
}

/**
 * Payoff figures for an EMI bill. Every instalment equals `amountMinor` (the bill model has no
 * separate last instalment). Returns null for non-EMI bills and EMIs without a total.
 *
 * Schedule: one instalment per budget period, due on `dayOfMonth`. If this period's instalment is
 * already stamped paid, the next one falls in the next period, otherwise in the current one. When the
 * due day is earlier than the period's start day the due date sits in the following calendar month.
 */
export function computeEmiPayoff(
  bill: RecurringBill,
  period: Pick<Period, 'start'>
): EmiPayoff | null {
  if (bill.kind !== 'emi') return null;
  const total = bill.totalInstallments;
  if (total == null || !Number.isInteger(total) || total <= 0) return null;

  const paid = Math.min(total, Math.max(0, Math.trunc(bill.paidInstallments)));
  const left = total - paid;
  const amount = Math.max(0, Math.trunc(bill.amountMinor));
  const pct = Math.floor((paid * 100) / total);

  let state: EmiPayoffState = 'active';
  let endYear: number | null = null;
  let endMonth: number | null = null;
  let behindPeriods = 0;
  if (left === 0) {
    state = 'finished';
  } else if (!bill.isActive) {
    state = 'paused';
  } else {
    const start = parseLocalDate(period.start);
    const paidThisPeriod = isPaidInPeriod(bill.lastPaidPeriod, period.start);
    const periodsAhead = paidThisPeriod ? left : left - 1;
    const dueShift = bill.dayOfMonth < start.day ? 1 : 0;
    const zeroBased = start.year * 12 + (start.month - 1) + periodsAhead + dueShift;
    endYear = Math.floor(zeroBased / 12);
    endMonth = (zeroBased % 12) + 1;
    behindPeriods = Math.min(left, countBehindPeriods(bill.lastPaidPeriod, period.start));
  }

  return {
    state,
    totalInstallments: total,
    paidInstallments: paid,
    leftInstallments: left,
    totalMinor: total * amount,
    paidMinor: paid * amount,
    leftMinor: left * amount,
    pct,
    endYear,
    endMonth,
    behindPeriods,
  };
}
