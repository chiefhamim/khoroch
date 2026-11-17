import { parseLocalDate } from './dates';
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
  if (left === 0) {
    state = 'finished';
  } else if (!bill.isActive) {
    state = 'paused';
  } else {
    const start = parseLocalDate(period.start);
    const paidThisPeriod = bill.lastPaidPeriod === period.start;
    const periodsAhead = paidThisPeriod ? left : left - 1;
    const dueShift = bill.dayOfMonth < start.day ? 1 : 0;
    const zeroBased = start.year * 12 + (start.month - 1) + periodsAhead + dueShift;
    endYear = Math.floor(zeroBased / 12);
    endMonth = (zeroBased % 12) + 1;
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
  };
}
