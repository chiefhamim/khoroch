import { MAX_AMOUNT_MINOR } from './money';
import { todayLocalDate } from './dates';
import {
  addWageId,
  buildWageEntry,
  dailyWageProblem,
  defaultWageChoices,
  isValidWageAmount,
  isWageRecordedToday,
  pruneWageLast,
  removeWageId,
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

const LAST = { ids: ['w1'], day: '2026-11-17' };

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
    expect(isWageRecordedToday(LAST, [wageTx()], '2026-11-17')).toBe(true);
  });

  it('is false with no pointer or no entry', () => {
    expect(isWageRecordedToday(null, [wageTx()], '2026-11-17')).toBe(false);
    expect(isWageRecordedToday(LAST, [null], '2026-11-17')).toBe(false);
    expect(isWageRecordedToday(LAST, [], '2026-11-17')).toBe(false);
  });

  it('is false when the pointer names a different entry', () => {
    expect(isWageRecordedToday(LAST, [wageTx({ id: 'other' })], '2026-11-17')).toBe(false);
  });

  it('is false for a deleted entry', () => {
    expect(isWageRecordedToday(LAST, [wageTx({ deletedAt: 123 })], '2026-11-17')).toBe(false);
  });

  it('is false when the pointer is for another day', () => {
    expect(isWageRecordedToday({ ids: ['w1'], day: '2026-11-16' }, [wageTx()], '2026-11-17')).toBe(false);
  });

  it('is false when the entry was moved to another day, and true after other edits', () => {
    expect(isWageRecordedToday(LAST, [wageTx({ occurredOn: '2026-11-16' })], '2026-11-17')).toBe(false);
    const edited = wageTx({ amountMinor: 95_000, categoryId: 'freelance', accountId: 'bank', description: 'Extra shift', note: 'x' });
    expect(isWageRecordedToday(LAST, [edited], '2026-11-17')).toBe(true);
  });

  it('uses the local calendar day: 23:59 stays on its day, 00:00 starts the next', () => {
    const late = new Date(2026, 10, 17, 23, 59);
    const midnight = new Date(2026, 10, 18, 0, 0);
    const entry = wageTx({ occurredOn: todayLocalDate(late), occurredTime: '23:59' });
    const last = { ids: ['w1'], day: todayLocalDate(late) };
    expect(isWageRecordedToday(last, [entry], todayLocalDate(late))).toBe(true);
    expect(isWageRecordedToday(last, [entry], todayLocalDate(midnight))).toBe(false);
  });

  it('counts as recorded while ANY listed entry is live that day', () => {
    const two = { ids: ['w1', 'w2'], day: '2026-11-17' };
    const first = wageTx({ id: 'w1' });
    const second = wageTx({ id: 'w2' });
    expect(isWageRecordedToday(two, [first, second], '2026-11-17')).toBe(true);
    // The second is deleted or moved: the first keeps the day recorded.
    expect(isWageRecordedToday(two, [first, { ...second, deletedAt: 5 }], '2026-11-17')).toBe(true);
    expect(isWageRecordedToday(two, [first, { ...second, occurredOn: '2026-11-16' }], '2026-11-17')).toBe(true);
    // Both gone: the plain button comes back.
    expect(isWageRecordedToday(two, [{ ...first, deletedAt: 5 }, { ...second, deletedAt: 5 }], '2026-11-17')).toBe(false);
    expect(isWageRecordedToday(two, [null, null], '2026-11-17')).toBe(false);
  });
});

describe('pruneWageLast', () => {
  it('drops deleted, moved and missing ids and keeps the live ones in order', () => {
    const last = { ids: ['w1', 'w2', 'w3', 'w4'], day: '2026-11-17' };
    const found = [
      wageTx({ id: 'w1' }),
      wageTx({ id: 'w2', deletedAt: 9 }),
      wageTx({ id: 'w3', occurredOn: '2026-11-10' }),
      null,
    ];
    expect(pruneWageLast(last, found, '2026-11-17')).toEqual({ ids: ['w1'], day: '2026-11-17' });
  });

  it('is null for none left, no pointer, or another day', () => {
    expect(pruneWageLast(LAST, [null], '2026-11-17')).toBeNull();
    expect(pruneWageLast(null, [wageTx()], '2026-11-17')).toBeNull();
    expect(pruneWageLast(LAST, [wageTx()], '2026-11-18')).toBeNull();
  });
});

describe('addWageId and removeWageId', () => {
  it('appends a new entry and Undo removes exactly its own id', () => {
    const one = addWageId(null, 'w1', '2026-11-17');
    expect(one).toEqual({ ids: ['w1'], day: '2026-11-17' });
    const two = addWageId(one, 'w2', '2026-11-17');
    expect(two).toEqual({ ids: ['w1', 'w2'], day: '2026-11-17' });
    expect(removeWageId(two, 'w2')).toEqual({ ids: ['w1'], day: '2026-11-17' });
    expect(removeWageId(two, 'w1')).toEqual({ ids: ['w2'], day: '2026-11-17' });
    expect(removeWageId(one, 'w1')).toBeNull();
    expect(removeWageId(null, 'w1')).toBeNull();
    expect(removeWageId(one, 'unknown')).toEqual(one);
  });

  it('starts over when the pointer is for another day, and never lists an id twice', () => {
    expect(addWageId({ ids: ['old'], day: '2026-11-16' }, 'w1', '2026-11-17')).toEqual({
      ids: ['w1'],
      day: '2026-11-17',
    });
    expect(addWageId({ ids: ['w1'], day: '2026-11-17' }, 'w1', '2026-11-17').ids).toEqual(['w1']);
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
  it('accepts a day plus a list of ids and rejects everything else', () => {
    expect(normalizeDailyWageLast({ ids: ['a', 'b'], day: '2026-11-17' })).toEqual({ ids: ['a', 'b'], day: '2026-11-17' });
    expect(normalizeDailyWageLast(null)).toBeNull();
    expect(normalizeDailyWageLast('x')).toBeNull();
    expect(normalizeDailyWageLast({ ids: [], day: '2026-11-17' })).toBeNull();
    expect(normalizeDailyWageLast({ ids: ['', 5], day: '2026-11-17' })).toBeNull();
    expect(normalizeDailyWageLast({ ids: ['a'], day: '17-11-2026' })).toBeNull();
    expect(normalizeDailyWageLast({ ids: ['a'] })).toBeNull();
  });

  it('reads the old { id, day } shape as a one-element list', () => {
    expect(normalizeDailyWageLast({ id: 'a', day: '2026-11-17' })).toEqual({ ids: ['a'], day: '2026-11-17' });
    expect(normalizeDailyWageLast({ id: '', day: '2026-11-17' })).toBeNull();
    expect(normalizeDailyWageLast({ id: 'a' })).toBeNull();
  });

  it('drops blank and repeated ids from a list', () => {
    expect(normalizeDailyWageLast({ ids: ['a', ' ', 'a', 'b', 3], day: '2026-11-17' })).toEqual({
      ids: ['a', 'b'],
      day: '2026-11-17',
    });
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
