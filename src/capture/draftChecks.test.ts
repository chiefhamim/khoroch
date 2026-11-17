import {
  canApproveDraft,
  draftBlockers,
  findLikelyDuplicateDraftIds,
  hasForeignEstimateMarker,
  isBulkApprovable,
  stripForeignEstimateMarker,
} from './draftChecks';

const draft = {
  id: 'd1',
  type: 'expense' as const,
  amountMinor: 35_000,
  accountId: 'acc_bkash' as string | null,
  categoryId: 'food_dining' as string | null,
  occurredOn: '2026-11-10',
  trxId: 'BK12AB34CD' as string | null,
  source: 'notification' as const,
  description: 'Lunch',
};

const saved = {
  type: 'expense' as const,
  amountMinor: 35_000,
  accountId: 'acc_bkash' as string | null,
  occurredOn: '2026-11-10',
  note: '',
  deletedAt: null as number | null,
};

const transfer = {
  fromAccountId: 'acc_bank',
  toAccountId: 'acc_bkash',
  amountMinor: 35_000,
  occurredOn: '2026-11-10',
  deletedAt: null as number | null,
};

const wallets = new Set(['acc_bkash', 'acc_cash']);
const cats = new Set(['food_dining', 'salary']);

describe('findLikelyDuplicateDraftIds', () => {
  it('flags same type, amount, day and wallet', () => {
    expect([...findLikelyDuplicateDraftIds([draft], [saved])]).toEqual(['d1']);
  });

  it('flags a TrxID match in the saved note even when the amount differs', () => {
    const s = { ...saved, amountMinor: 1, note: 'TrxID: bk12ab34cd' };
    expect(findLikelyDuplicateDraftIds([draft], [s]).has('d1')).toBe(true);
  });

  it('ignores deleted entries', () => {
    const s = { ...saved, deletedAt: 123 };
    expect(findLikelyDuplicateDraftIds([draft], [s]).size).toBe(0);
  });

  it('does not flag a different amount, wallet or type, or a day more than one away', () => {
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, amountMinor: 35_001 }]).size).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, occurredOn: '2026-11-13' }]).size).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, occurredOn: '2026-11-07' }]).size).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, accountId: 'acc_cash' }]).size).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, type: 'income' }]).size).toBe(0);
  });

  it('matches any wallet when the draft wallet is unknown', () => {
    const d = { ...draft, accountId: null };
    expect(findLikelyDuplicateDraftIds([d], [{ ...saved, accountId: 'acc_cash' }]).has('d1')).toBe(true);
  });

  it('flags an entry on the day before or after (midnight case)', () => {
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, occurredOn: '2026-11-09' }]).has('d1')).toBe(true);
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, occurredOn: '2026-11-11' }]).has('d1')).toBe(true);
    const monthEnd = { ...draft, occurredOn: '2026-12-01' };
    expect(findLikelyDuplicateDraftIds([monthEnd], [{ ...saved, occurredOn: '2026-11-30' }]).has('d1')).toBe(true);
  });

  it('flags a saved transfer with the same amount touching the draft wallet', () => {
    expect(findLikelyDuplicateDraftIds([draft], [], [transfer]).has('d1')).toBe(true);
    expect(findLikelyDuplicateDraftIds([draft], [], [{ ...transfer, occurredOn: '2026-11-11' }]).has('d1')).toBe(true);
    const fromSide = { ...draft, accountId: 'acc_bank' };
    expect(findLikelyDuplicateDraftIds([fromSide], [], [transfer]).has('d1')).toBe(true);
  });

  it('flags a transfer for any wallet when the draft wallet is unknown', () => {
    const d = { ...draft, accountId: null };
    expect(findLikelyDuplicateDraftIds([d], [], [transfer]).has('d1')).toBe(true);
  });

  it('ignores a transfer with another amount, another wallet, a far day, or a deleted one', () => {
    expect(findLikelyDuplicateDraftIds([draft], [], [{ ...transfer, amountMinor: 1 }]).size).toBe(0);
    expect(
      findLikelyDuplicateDraftIds([draft], [], [{ ...transfer, fromAccountId: 'acc_x', toAccountId: 'acc_y' }]).size
    ).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [], [{ ...transfer, occurredOn: '2026-11-14' }]).size).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [], [{ ...transfer, deletedAt: 5 }]).size).toBe(0);
  });
});

describe('foreign-currency estimate marker', () => {
  it('detects and strips a trailing (USD n.nn) marker', () => {
    expect(hasForeignEstimateMarker('GitHub (USD 0.90)')).toBe(true);
    expect(hasForeignEstimateMarker('GitHub (USD 1,200.50) ')).toBe(true);
    expect(hasForeignEstimateMarker('GitHub')).toBe(false);
    expect(hasForeignEstimateMarker('USD shop')).toBe(false);
    expect(stripForeignEstimateMarker('GitHub (USD 0.90)')).toBe('GitHub');
  });
});

describe('canApproveDraft', () => {
  it('requires a live wallet, a live category and a positive amount', () => {
    expect(canApproveDraft(draft, wallets, cats)).toBe(true);
    expect(canApproveDraft({ ...draft, accountId: null }, wallets, cats)).toBe(false);
    expect(canApproveDraft({ ...draft, categoryId: null }, wallets, cats)).toBe(false);
    expect(canApproveDraft({ ...draft, amountMinor: 0 }, wallets, cats)).toBe(false);
  });

  it('treats an archived or deleted wallet and a missing category as none', () => {
    expect(canApproveDraft({ ...draft, accountId: 'acc_gone' }, wallets, cats)).toBe(false);
    expect(canApproveDraft({ ...draft, categoryId: 'cat_gone' }, wallets, cats)).toBe(false);
    expect(draftBlockers({ ...draft, accountId: 'acc_gone' }, wallets, cats)).toEqual({
      wallet: true,
      category: false,
      amount: false,
    });
  });

  it('refuses a draft whose amount was estimated from a foreign currency', () => {
    const est = { ...draft, description: 'GitHub (USD 0.90)' };
    expect(canApproveDraft(est, wallets, cats)).toBe(false);
    expect(draftBlockers(est, wallets, cats).amount).toBe(true);
  });
});

describe('isBulkApprovable', () => {
  const none = new Set<string>();
  it('accepts a confident draft with wallet and category', () => {
    expect(isBulkApprovable(draft, none, wallets, cats)).toBe(true);
  });
  it('skips drafts without a wallet, category or real transaction id', () => {
    expect(isBulkApprovable({ ...draft, accountId: null }, none, wallets, cats)).toBe(false);
    expect(isBulkApprovable({ ...draft, categoryId: null }, none, wallets, cats)).toBe(false);
    expect(isBulkApprovable({ ...draft, trxId: null }, none, wallets, cats)).toBe(false);
    expect(isBulkApprovable({ ...draft, trxId: 'Card **3829' }, none, wallets, cats)).toBe(false);
  });
  it('skips drafts whose wallet or category is no longer live', () => {
    expect(isBulkApprovable({ ...draft, accountId: 'acc_gone' }, none, wallets, cats)).toBe(false);
    expect(isBulkApprovable({ ...draft, categoryId: 'cat_gone' }, none, wallets, cats)).toBe(false);
  });
  it('skips receipts, likely duplicates and estimated foreign amounts', () => {
    expect(isBulkApprovable({ ...draft, source: 'ocr_receipt' }, none, wallets, cats)).toBe(false);
    expect(isBulkApprovable(draft, new Set(['d1']), wallets, cats)).toBe(false);
    expect(isBulkApprovable({ ...draft, description: 'X (USD 2.00)' }, none, wallets, cats)).toBe(false);
  });
});
