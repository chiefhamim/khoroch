import { MAX_AMOUNT_MINOR } from './money';
import {
  canPinAmount,
  pinAmount,
  pinBlockReason,
  recentDistinctEntries,
  unpinAmount,
} from './captureShortcuts';
import { normalizePinnedAmounts, type PinnedAmounts, type Transaction } from './types';

let seq = 0;
function tx(over: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    type: 'expense',
    amountMinor: 35_000,
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: 'cash',
    transferId: null,
    description: 'Lunch',
    note: '',
    occurredOn: '2026-11-10',
    occurredTime: '12:00',
    source: 'manual',
    createdAt: seq,
    updatedAt: seq,
    deletedAt: null,
    ...over,
  };
}

describe('recentDistinctEntries', () => {
  it('returns an empty list for no transactions', () => {
    expect(recentDistinctEntries([])).toEqual([]);
  });

  it('collapses duplicates by type, amount and category, ignoring the wallet', () => {
    const a = tx({ occurredOn: '2026-11-12' });
    const dupe = tx({ occurredOn: '2026-11-11' });
    const otherWallet = tx({ accountId: 'bkash', occurredOn: '2026-11-10' });
    const otherAmount = tx({ amountMinor: 40_000, occurredOn: '2026-11-09' });
    const otherCategory = tx({ categoryId: 'transport', occurredOn: '2026-11-08' });
    const out = recentDistinctEntries([dupe, otherAmount, a, otherWallet, otherCategory]);
    expect(out.map((x) => x.id)).toEqual([a.id, otherAmount.id, otherCategory.id]);
    expect(out[0].accountId).toBe('cash');
  });

  it('uses the wallet of the most recent matching entry', () => {
    const older = tx({ accountId: 'cash', occurredOn: '2026-11-01' });
    const newer = tx({ accountId: 'bkash', occurredOn: '2026-11-09' });
    const out = recentDistinctEntries([older, newer]);
    expect(out).toHaveLength(1);
    expect(out[0].accountId).toBe('bkash');
  });

  it('skips transfers, deleted rows, uncategorised rows and balance adjustments', () => {
    const real = tx({ amountMinor: 10_000, occurredOn: '2026-11-01' });
    const rows = [
      tx({ transferId: 'tr1', occurredOn: '2026-11-12' }),
      tx({ deletedAt: 5, occurredOn: '2026-11-12' }),
      tx({ categoryId: null, occurredOn: '2026-11-12' }),
      tx({ description: 'Balance adjustment', occurredTime: null, occurredOn: '2026-11-12' }),
      real,
    ];
    const out = recentDistinctEntries(rows, { adjustmentDescriptions: ['Balance adjustment'] });
    expect(out.map((x) => x.id)).toEqual([real.id]);
  });

  it('orders most recent first whatever the input order', () => {
    const old = tx({ amountMinor: 1_000, occurredOn: '2026-11-01' });
    const mid = tx({ amountMinor: 2_000, occurredOn: '2026-11-05' });
    const sameDayLater = tx({ amountMinor: 3_000, occurredOn: '2026-11-05' });
    expect(recentDistinctEntries([old, mid, sameDayLater]).map((x) => x.id)).toEqual([
      sameDayLater.id,
      mid.id,
      old.id,
    ]);
  });

  it('caps at three', () => {
    const rows = [1, 2, 3, 4, 5].map((n) => tx({ amountMinor: n * 1_000 }));
    expect(recentDistinctEntries(rows)).toHaveLength(3);
    expect(recentDistinctEntries(rows, { limit: 2 })).toHaveLength(2);
  });
});

describe('pinned amounts', () => {
  const empty: PinnedAmounts = { expense: [], income: [] };

  it('pins, refuses duplicates, zero and a fifth amount, and unpins', () => {
    let p = pinAmount(empty, 'expense', 50_000);
    expect(p).toEqual({ expense: [50_000], income: [] });
    expect(canPinAmount(p, 'expense', 50_000)).toBe(false);
    expect(canPinAmount(p, 'expense', 0)).toBe(false);
    expect(canPinAmount(p, 'expense', null)).toBe(false);
    expect(canPinAmount(p, 'income', 50_000)).toBe(true);
    p = pinAmount(p, 'expense', 10_000);
    p = pinAmount(p, 'expense', 20_000);
    p = pinAmount(p, 'expense', 30_000);
    expect(canPinAmount(p, 'expense', 40_000)).toBe(false);
    expect(pinAmount(p, 'expense', 40_000)).toBe(p);
    expect(unpinAmount(p, 'expense', 10_000).expense).toEqual([50_000, 20_000, 30_000]);
  });

  it('rejects amounts above MAX_AMOUNT_MINOR when pinning and when normalizing', () => {
    expect(canPinAmount(empty, 'expense', MAX_AMOUNT_MINOR)).toBe(true);
    expect(canPinAmount(empty, 'expense', MAX_AMOUNT_MINOR + 1)).toBe(false);
    expect(pinAmount(empty, 'expense', MAX_AMOUNT_MINOR + 1)).toBe(empty);
    expect(normalizePinnedAmounts({ expense: [MAX_AMOUNT_MINOR + 1, MAX_AMOUNT_MINOR, 5], income: [] })).toEqual({
      expense: [MAX_AMOUNT_MINOR, 5],
      income: [],
    });
  });

  it('explains why an amount cannot be pinned', () => {
    const full: PinnedAmounts = { expense: [1, 2, 3, 4], income: [] };
    expect(pinBlockReason(empty, 'expense', null)).toBe('none');
    expect(pinBlockReason(empty, 'expense', 0)).toBe('none');
    expect(pinBlockReason({ expense: [5], income: [] }, 'expense', 5)).toBe('duplicate');
    expect(pinBlockReason(full, 'expense', 9)).toBe('full');
    expect(pinBlockReason(full, 'income', 9)).toBeNull();
  });

  it('normalizes junk to integer positive unique values, max four', () => {
    expect(
      normalizePinnedAmounts({ expense: [100, 100, -5, 1.5, 'x', 200, 300, 400, 500], income: 'no' })
    ).toEqual({ expense: [100, 200, 300, 400], income: [] });
    expect(normalizePinnedAmounts(null)).toEqual(empty);
  });
});
