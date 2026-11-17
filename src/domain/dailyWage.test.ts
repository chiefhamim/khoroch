import { MAX_AMOUNT_MINOR } from './money';
import { todayLocalDate } from './dates';
import {
  buildWageEntry,
  dailyWageProblem,
  defaultWageChoices,
  hasWageRecordedOn,
  isValidWageAmount,
  WAGE_NOTE_MARKER,
} from './dailyWage';
import { normalizeDailyWage, type Account, type Category, type Transaction } from './types';

let seq = 0;
function tx(over: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    type: 'income',
    amountMinor: 80_000,
    currency: 'BDT',
    categoryId: 'salary',
    accountId: 'cash',
    transferId: null,
    description: 'Salary',
    note: '',
    occurredOn: '2026-11-17',
    occurredTime: '09:00',
    source: 'manual',
    createdAt: seq,
    updatedAt: seq,
    deletedAt: null,
    ...over,
  };
}

function wageTx(over: Partial<Transaction> = {}): Transaction {
  return tx({ source: 'quick', note: WAGE_NOTE_MARKER, ...over });
}

function cat(id: string, sortOrder: number, over: Partial<Category> = {}): Category {
  return { id, name: id, kind: 'income', sortOrder, archivedAt: null, ...over } as Category;
}

function acc(id: string, over: Partial<Account> = {}): Account {
  return { id, name: id, archivedAt: null, ...over } as Account;
}

describe('hasWageRecordedOn', () => {
  it('is false with no entries and true with one wage entry that day', () => {
    expect(hasWageRecordedOn([], '2026-11-17')).toBe(false);
    expect(hasWageRecordedOn([wageTx()], '2026-11-17')).toBe(true);
  });

  it('ignores ordinary income, other quick entries and expenses', () => {
    const rows = [
      tx(),
      tx({ source: 'quick' }),
      tx({ source: 'quick', note: 'wage' }),
      wageTx({ type: 'expense' }),
    ];
    expect(hasWageRecordedOn(rows, '2026-11-17')).toBe(false);
  });

  it('ignores deleted entries', () => {
    expect(hasWageRecordedOn([wageTx({ deletedAt: 123 })], '2026-11-17')).toBe(false);
  });

  it('still counts a wage entry after the person edits amount, category, wallet or description', () => {
    const edited = wageTx({ amountMinor: 95_000, categoryId: 'freelance', accountId: 'bank', description: 'Extra shift' });
    expect(hasWageRecordedOn([edited], '2026-11-17')).toBe(true);
  });

  it('uses the local calendar day: 23:59 stays on its day, 00:00 starts the next', () => {
    const late = new Date(2026, 10, 17, 23, 59);
    const midnight = new Date(2026, 10, 18, 0, 0);
    const rows = [wageTx({ occurredOn: todayLocalDate(late), occurredTime: '23:59' })];
    expect(hasWageRecordedOn(rows, todayLocalDate(late))).toBe(true);
    expect(hasWageRecordedOn(rows, todayLocalDate(midnight))).toBe(false);
  });

  it('does not count a wage entry from another day', () => {
    expect(hasWageRecordedOn([wageTx({ occurredOn: '2026-11-16' })], '2026-11-17')).toBe(false);
  });
});

describe('buildWageEntry', () => {
  it('files the wage as quick income today with the marker and the category name', () => {
    const entry = buildWageEntry({
      id: 'w1',
      wage: { amountMinor: 80_000, categoryId: 'salary', accountId: 'cash' },
      categoryName: 'Salary',
      currency: 'BDT',
      day: '2026-11-17',
      time: '08:30',
    });
    expect(entry).toMatchObject({
      id: 'w1',
      type: 'income',
      amountMinor: 80_000,
      categoryId: 'salary',
      accountId: 'cash',
      description: 'Salary',
      occurredOn: '2026-11-17',
      occurredTime: '08:30',
      source: 'quick',
      note: WAGE_NOTE_MARKER,
    });
  });
});

describe('daily wage validation', () => {
  it('accepts an amount above zero up to the app maximum', () => {
    expect(isValidWageAmount(1)).toBe(true);
    expect(isValidWageAmount(MAX_AMOUNT_MINOR)).toBe(true);
  });

  it('rejects zero, negative, fractional, too large and empty amounts', () => {
    expect(isValidWageAmount(0)).toBe(false);
    expect(isValidWageAmount(-5)).toBe(false);
    expect(isValidWageAmount(10.5)).toBe(false);
    expect(isValidWageAmount(MAX_AMOUNT_MINOR + 1)).toBe(false);
    expect(isValidWageAmount(null)).toBe(false);
  });

  it('reports the first problem: amount, then category', () => {
    expect(dailyWageProblem({ amountMinor: 0, categoryId: 'salary' })).toBe('amount');
    expect(dailyWageProblem({ amountMinor: 100, categoryId: null })).toBe('category');
    expect(dailyWageProblem({ amountMinor: 100, categoryId: '  ' })).toBe('category');
    expect(dailyWageProblem({ amountMinor: 100, categoryId: 'salary' })).toBeNull();
  });

  it('reads stored or imported values, with anything invalid reading as unset', () => {
    expect(normalizeDailyWage({ amountMinor: 80_000, categoryId: 'salary', accountId: 'cash' })).toEqual({
      amountMinor: 80_000,
      categoryId: 'salary',
      accountId: 'cash',
    });
    expect(normalizeDailyWage({ amountMinor: 80_000, categoryId: 'salary' })?.accountId).toBeNull();
    expect(normalizeDailyWage(undefined)).toBeNull();
    expect(normalizeDailyWage(null)).toBeNull();
    expect(normalizeDailyWage('800')).toBeNull();
    expect(normalizeDailyWage({ amountMinor: 0, categoryId: 'salary' })).toBeNull();
    expect(normalizeDailyWage({ amountMinor: 1.5, categoryId: 'salary' })).toBeNull();
    expect(normalizeDailyWage({ amountMinor: MAX_AMOUNT_MINOR + 1, categoryId: 'salary' })).toBeNull();
    expect(normalizeDailyWage({ amountMinor: 100, categoryId: '' })).toBeNull();
  });
});

describe('defaultWageChoices', () => {
  const categories = [cat('salary', 1), cat('freelance', 2), cat('old', 3, { archivedAt: 5 }), cat('food', 4, { kind: 'expense' })];
  const accounts = [acc('cash'), acc('bank'), acc('gone', { archivedAt: 9 })];

  it('picks the most used income category and wallet', () => {
    const history = [
      tx({ categoryId: 'freelance', accountId: 'bank' }),
      tx({ categoryId: 'freelance', accountId: 'bank' }),
      tx({ categoryId: 'salary', accountId: 'cash' }),
    ];
    expect(defaultWageChoices(history, categories, accounts)).toEqual({
      categoryId: 'freelance',
      accountId: 'bank',
    });
  });

  it('skips deleted, expense, archived and transfer rows', () => {
    const history = [
      tx({ categoryId: 'old', accountId: 'gone' }),
      tx({ categoryId: 'salary', accountId: 'cash', deletedAt: 1 }),
      tx({ type: 'expense', categoryId: 'food', accountId: 'bank' }),
      tx({ categoryId: 'salary', accountId: 'cash', transferId: 'tr' }),
      tx({ categoryId: 'salary', accountId: 'cash' }),
    ];
    expect(defaultWageChoices(history, categories, accounts)).toEqual({
      categoryId: 'salary',
      accountId: 'cash',
    });
  });

  it('falls back to the first active income category and wallet with no history', () => {
    expect(defaultWageChoices([], categories, accounts)).toEqual({
      categoryId: 'salary',
      accountId: 'cash',
    });
    expect(defaultWageChoices([], [], [])).toEqual({ categoryId: null, accountId: null });
  });
});
