import { MAX_AMOUNT_MINOR } from './money';
import { todayLocalDate } from './dates';
import {
  buildWageEntry,
  dailyWageProblem,
  defaultWageChoices,
  isValidWageAmount,
  isWageRecordedToday,
  stripInvisibleNoteMarks,
} from './dailyWage';
import {
  normalizeDailyWage,
  normalizeDailyWageLast,
  type Account,
  type Category,
  type Transaction,
} from './types';

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

const LAST = { id: 'w1', day: '2026-11-17' };

function wageTx(over: Partial<Transaction> = {}): Transaction {
  return tx({ id: 'w1', source: 'quick', note: '', ...over });
}

function cat(id: string, sortOrder: number, over: Partial<Category> = {}): Category {
  return { id, name: id, kind: 'income', sortOrder, archivedAt: null, ...over } as Category;
}

function acc(id: string, over: Partial<Account> = {}): Account {
  return { id, name: id, archivedAt: null, ...over } as Account;
}

describe('isWageRecordedToday', () => {
  it('is true when the pointer is for today and its entry is live and dated today', () => {
    expect(isWageRecordedToday(LAST, wageTx(), '2026-11-17')).toBe(true);
  });

  it('is false with no pointer or no entry', () => {
    expect(isWageRecordedToday(null, wageTx(), '2026-11-17')).toBe(false);
    expect(isWageRecordedToday(LAST, null, '2026-11-17')).toBe(false);
  });

  it('is false when the pointer names a different entry', () => {
    expect(isWageRecordedToday(LAST, wageTx({ id: 'other' }), '2026-11-17')).toBe(false);
  });

  it('is false for a deleted entry', () => {
    expect(isWageRecordedToday(LAST, wageTx({ deletedAt: 123 }), '2026-11-17')).toBe(false);
  });

  it('is false when the pointer is for another day', () => {
    expect(isWageRecordedToday({ id: 'w1', day: '2026-11-16' }, wageTx(), '2026-11-17')).toBe(false);
  });

  it('is false when the entry was moved to another day, and true after other edits', () => {
    expect(isWageRecordedToday(LAST, wageTx({ occurredOn: '2026-11-16' }), '2026-11-17')).toBe(false);
    const edited = wageTx({ amountMinor: 95_000, categoryId: 'freelance', accountId: 'bank', description: 'Extra shift', note: 'x' });
    expect(isWageRecordedToday(LAST, edited, '2026-11-17')).toBe(true);
  });

  it('uses the local calendar day: 23:59 stays on its day, 00:00 starts the next', () => {
    const late = new Date(2026, 10, 17, 23, 59);
    const midnight = new Date(2026, 10, 18, 0, 0);
    const entry = wageTx({ occurredOn: todayLocalDate(late), occurredTime: '23:59' });
    const last = { id: 'w1', day: todayLocalDate(late) };
    expect(isWageRecordedToday(last, entry, todayLocalDate(late))).toBe(true);
    expect(isWageRecordedToday(last, entry, todayLocalDate(midnight))).toBe(false);
  });
});

describe('stripInvisibleNoteMarks', () => {
  it('removes the old invisible separators and leaves real text alone', () => {
    const old = String.fromCharCode(0x2063, 0x2063);
    expect(stripInvisibleNoteMarks(old)).toBe('');
    expect(stripInvisibleNoteMarks(`${old}paid in cash`)).toBe('paid in cash');
    expect(stripInvisibleNoteMarks('plain note')).toBe('plain note');
    expect(stripInvisibleNoteMarks('')).toBe('');
  });
});

describe('normalizeDailyWageLast', () => {
  it('accepts an id plus a YYYY-MM-DD day and rejects everything else', () => {
    expect(normalizeDailyWageLast({ id: 'a', day: '2026-11-17' })).toEqual({ id: 'a', day: '2026-11-17' });
    expect(normalizeDailyWageLast(null)).toBeNull();
    expect(normalizeDailyWageLast('x')).toBeNull();
    expect(normalizeDailyWageLast({ id: '', day: '2026-11-17' })).toBeNull();
    expect(normalizeDailyWageLast({ id: 'a', day: '17-11-2026' })).toBeNull();
    expect(normalizeDailyWageLast({ id: 'a' })).toBeNull();
  });
});

describe('buildWageEntry', () => {
  it('files the wage as quick income today with an empty note and the category name', () => {
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
      note: '',
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
