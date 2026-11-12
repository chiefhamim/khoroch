import { addDays, todayLocalDate } from '@/domain/dates';
import type { CurrencyCode, LocalDate, NewTransaction } from '@/domain/types';

interface SampleTemplate {
  type: 'expense' | 'income';
  categoryId: string;
  description: string;
  bdtAmount: number; // major units
}

const EXPENSE_TEMPLATES: readonly SampleTemplate[] = [
  { type: 'expense', categoryId: 'food_dining', description: 'Lunch', bdtAmount: 280 },
  { type: 'expense', categoryId: 'food_dining', description: 'Coffee', bdtAmount: 180 },
  { type: 'expense', categoryId: 'food_dining', description: 'Dinner', bdtAmount: 450 },
  { type: 'expense', categoryId: 'food_dining', description: 'Snacks & tea', bdtAmount: 95 },
  { type: 'expense', categoryId: 'groceries', description: 'Weekly groceries', bdtAmount: 1450 },
  { type: 'expense', categoryId: 'groceries', description: 'Vegetables & fruit', bdtAmount: 620 },
  { type: 'expense', categoryId: 'transportation', description: 'Rickshaw', bdtAmount: 60 },
  { type: 'expense', categoryId: 'transportation', description: 'Uber ride', bdtAmount: 320 },
  { type: 'expense', categoryId: 'transportation', description: 'CNG fare', bdtAmount: 180 },
  { type: 'expense', categoryId: 'utilities', description: 'Electricity bill', bdtAmount: 1850 },
  { type: 'expense', categoryId: 'utilities', description: 'Internet bill', bdtAmount: 1200 },
  { type: 'expense', categoryId: 'utilities', description: 'Mobile recharge', bdtAmount: 300 },
  { type: 'expense', categoryId: 'shopping', description: 'Household items', bdtAmount: 950 },
  { type: 'expense', categoryId: 'health', description: 'Pharmacy', bdtAmount: 480 },
  { type: 'expense', categoryId: 'entertainment', description: 'Movie tickets', bdtAmount: 800 },
  { type: 'expense', categoryId: 'subscriptions', description: 'Streaming subscription', bdtAmount: 550 },
  { type: 'expense', categoryId: 'personal_care', description: 'Haircut', bdtAmount: 250 },
];

function scaleAmountMinor(bdtMajor: number, currency: CurrencyCode): number {
  const factor = currency === 'BDT' ? 1 : 0.01;
  return Math.max(100, Math.round(bdtMajor * factor) * 100);
}

/**
 * Generates ~150 deterministic realistic sample transactions over ~90 days (DEV only).
 */
export function buildSampleTransactions(
  currency: CurrencyCode,
  today: LocalDate = todayLocalDate()
): NewTransaction[] {
  const txs: NewTransaction[] = [];
  const baseMs = Date.now() - 100_000;
  let seq = 1;

  // Monthly salaries & rent over the last 3 months (0, 30, 60 days back)
  for (const offset of [2, 32, 62]) {
    const day = addDays(today, -offset);
    txs.push({
      id: `sample_salary_${offset}`,
      type: 'income',
      amountMinor: scaleAmountMinor(55000, currency),
      currency,
      categoryId: 'salary',
      description: 'Monthly salary',
      occurredOn: day,
      occurredTime: '10:00',
      source: 'sample',
      createdAt: baseMs + seq++,
    });
    txs.push({
      id: `sample_rent_${offset}`,
      type: 'expense',
      amountMinor: scaleAmountMinor(14000, currency),
      currency,
      categoryId: 'housing_rent',
      description: 'House rent',
      occurredOn: addDays(day, 1),
      occurredTime: '11:30',
      source: 'sample',
      createdAt: baseMs + seq++,
    });
  }

  // Freelance income entries
  for (const offset of [12, 48, 76]) {
    txs.push({
      id: `sample_freelance_${offset}`,
      type: 'income',
      amountMinor: scaleAmountMinor(12000, currency),
      currency,
      categoryId: 'business',
      description: 'Freelance project',
      occurredOn: addDays(today, -offset),
      occurredTime: '16:15',
      source: 'sample',
      createdAt: baseMs + seq++,
    });
  }

  // Daily expenses across 88 days (~145 items -> ~154 total)
  for (let d = 0; d < 88; d++) {
    const date = addDays(today, -d);
    const countForDay = d % 3 === 0 ? 2 : d % 5 === 0 ? 3 : 1;

    for (let k = 0; k < countForDay; k++) {
      const tpl = EXPENSE_TEMPLATES[(d * 7 + k * 5) % EXPENSE_TEMPLATES.length];
      // Slight deterministic variation so charts and averages look natural
      const jitterPct = ((d + k * 3) % 5) * 10 - 20; // -20%..+20%
      const adjustedMajor = Math.max(25, Math.round((tpl.bdtAmount * (100 + jitterPct)) / 100));
      const hour = 9 + ((d + k * 4) % 12);
      const minute = ((d * 13 + k * 17) % 4) * 15;

      txs.push({
        id: `sample_exp_${d}_${k}`,
        type: 'expense',
        amountMinor: scaleAmountMinor(adjustedMajor, currency),
        currency,
        categoryId: tpl.categoryId,
        description: tpl.description,
        occurredOn: date,
        occurredTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        source: 'sample',
        createdAt: baseMs + seq++,
      });
    }
  }

  return txs;
}
