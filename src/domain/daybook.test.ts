import { computeAccountsOverview } from './accounts';
import { buildDayBook, type DayBookDue } from './daybook';
import type { Account, Transaction, Transfer } from './types';

const DAY = '2026-11-14';

function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    kind: 'cash',
    provider: null,
    colorKey: 'green',
    monogram: null,
    last4: null,
    openingBalanceMinor: 0,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

let seq = 0;
function tx(
  type: 'income' | 'expense',
  amountMinor: number,
  description: string,
  occurredTime: string | null,
  overrides: Partial<Transaction> = {}
): Transaction {
  seq += 1;
  return {
    id: `tx${seq}`,
    type,
    amountMinor,
    currency: 'BDT',
    categoryId: null,
    accountId: 'cash',
    transferId: null,
    description,
    note: '',
    occurredOn: DAY,
    occurredTime,
    source: 'manual',
    createdAt: seq,
    updatedAt: seq,
    deletedAt: null,
    ...overrides,
  };
}

describe('buildDayBook', () => {
  it('reads an office day like a log: ৳130 from home, two bus fares, snacks, bananas', () => {
    const accounts = [account('cash', { openingBalanceMinor: 5_000 })];
    const transactions = [
      tx('expense', 4_000, 'Bananas', '19:20'),
      tx('income', 13_000, 'From wife for office', '08:30'),
      tx('expense', 1_000, 'Bus', '08:45'),
      tx('expense', 4_000, 'Evening snacks', '17:30'),
      tx('expense', 1_000, 'Bus home', '18:50'),
      tx('expense', 9_999, 'Yesterday', '10:00', { occurredOn: '2026-11-13' }),
    ];

    const book = buildDayBook({ date: DAY, accounts, transactions, transfers: [], dues: [], currency: 'BDT' });

    expect(book.openingMinor).toBe(5_000 - 9_999);
    expect(book.entries.map((e) => e.transaction?.description)).toEqual([
      'From wife for office',
      'Bus',
      'Evening snacks',
      'Bus home',
      'Bananas',
    ]);
    expect(book.entries.map((e) => e.runningMinor)).toEqual([
      -4_999 + 13_000,
      -4_999 + 12_000,
      -4_999 + 8_000,
      -4_999 + 7_000,
      -4_999 + 3_000,
    ]);
    expect(book.inMinor).toBe(13_000);
    expect(book.outMinor).toBe(10_000);
    expect(book.closingMinor).toBe(book.openingMinor + 3_000);
  });

  it('closing always equals opening plus every wallet delta and matches the overview', () => {
    const accounts = [
      account('cash', { openingBalanceMinor: 100_000 }),
      account('bkash', { kind: 'mobile_wallet', openingBalanceMinor: 50_000 }),
      account('savings', { includeInTotal: false, openingBalanceMinor: 900_000 }),
      account('new', { openingDate: DAY, openingBalanceMinor: 7_000 }),
    ];
    const transactions = [
      tx('expense', 1_850, 'Cash out fee', '10:01', { accountId: 'bkash' }),
      tx('expense', 2_500, 'Tea, no wallet', '11:00', { accountId: null }),
      tx('income', 500, 'Deleted', '12:00', { deletedAt: 5 }),
    ];
    const transfers: Transfer[] = [
      { id: 'tr1', fromAccountId: 'bkash', toAccountId: 'cash', amountMinor: 100_000, feeMinor: 1_850, occurredOn: DAY, occurredTime: '10:00', note: '', createdAt: 1, updatedAt: 1, deletedAt: null },
      { id: 'tr2', fromAccountId: 'cash', toAccountId: 'savings', amountMinor: 20_000, feeMinor: 0, occurredOn: DAY, occurredTime: '15:00', note: '', createdAt: 2, updatedAt: 2, deletedAt: null },
    ];
    const dues: DayBookDue[] = [
      { id: 'd1', personId: 'p1', kind: 'lent', amountMinor: 30_000, accountId: 'cash', occurredOn: DAY, occurredTime: '13:00', note: '', createdAt: 3, deletedAt: null },
    ];

    const book = buildDayBook({ date: DAY, accounts, transactions, transfers, dues, currency: 'BDT' });
    const sum = book.entries.reduce((acc, e) => acc + e.walletDeltaMinor, 0);
    expect(book.closingMinor).toBe(book.openingMinor + sum);
    expect(book.closingMinor).toBe(
      computeAccountsOverview({ accounts, transactions, transfers, dues, asOfDate: DAY, currency: 'BDT' }).totalMinor
    );

    const byId = new Map(book.entries.map((e) => [e.id, e]));
    expect(byId.get('tr1')?.direction).toBe('move');
    expect(byId.get('tr1')?.walletDeltaMinor).toBe(0);
    expect(byId.get('tr2')?.direction).toBe('out');
    expect(byId.get('tr2')?.walletDeltaMinor).toBe(-20_000);
    expect(byId.get('d1')?.walletDeltaMinor).toBe(-30_000);
    expect(book.entries.find((e) => e.transaction?.description === 'Tea, no wallet')?.runningMinor).toBeNull();
    expect(book.untrackedOutMinor).toBe(2_500);
    expect(book.entries.some((e) => e.transaction?.description === 'Deleted')).toBe(false);
  });

  it('orders untimed entries by when they were written', () => {
    const accounts = [account('cash')];
    const createdAt = new Date(2026, 10, 14, 9, 30).getTime();
    const transactions = [
      tx('expense', 100, 'Late', '22:00'),
      tx('expense', 100, 'Untimed', null, { createdAt }),
      tx('expense', 100, 'Early', '07:00'),
    ];
    const book = buildDayBook({ date: DAY, accounts, transactions, transfers: [], dues: [], currency: 'BDT' });
    expect(book.entries.map((e) => e.transaction?.description)).toEqual(['Early', 'Untimed', 'Late']);
  });
});
