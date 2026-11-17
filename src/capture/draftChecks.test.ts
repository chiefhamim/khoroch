import { canApproveDraft, findLikelyDuplicateDraftIds, isBulkApprovable } from './draftChecks';

const draft = {
  id: 'd1',
  type: 'expense' as const,
  amountMinor: 35_000,
  accountId: 'acc_bkash' as string | null,
  categoryId: 'food_dining' as string | null,
  occurredOn: '2026-11-10',
  trxId: 'BK12AB34CD' as string | null,
  source: 'notification' as const,
};

const saved = {
  type: 'expense' as const,
  amountMinor: 35_000,
  accountId: 'acc_bkash' as string | null,
  occurredOn: '2026-11-10',
  note: '',
  deletedAt: null as number | null,
};

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

  it('does not flag a different amount, day, wallet or type', () => {
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, amountMinor: 35_001 }]).size).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, occurredOn: '2026-11-11' }]).size).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, accountId: 'acc_cash' }]).size).toBe(0);
    expect(findLikelyDuplicateDraftIds([draft], [{ ...saved, type: 'income' }]).size).toBe(0);
  });

  it('matches any wallet when the draft wallet is unknown', () => {
    const d = { ...draft, accountId: null };
    expect(findLikelyDuplicateDraftIds([d], [{ ...saved, accountId: 'acc_cash' }]).has('d1')).toBe(true);
  });
});

describe('canApproveDraft', () => {
  it('requires a chosen wallet and a positive amount', () => {
    expect(canApproveDraft(draft)).toBe(true);
    expect(canApproveDraft({ ...draft, accountId: null })).toBe(false);
    expect(canApproveDraft({ ...draft, amountMinor: 0 })).toBe(false);
  });
});

describe('isBulkApprovable', () => {
  const none = new Set<string>();
  it('accepts a confident draft with wallet and category', () => {
    expect(isBulkApprovable(draft, none)).toBe(true);
  });
  it('skips drafts without a wallet, category or real transaction id', () => {
    expect(isBulkApprovable({ ...draft, accountId: null }, none)).toBe(false);
    expect(isBulkApprovable({ ...draft, categoryId: null }, none)).toBe(false);
    expect(isBulkApprovable({ ...draft, trxId: null }, none)).toBe(false);
    expect(isBulkApprovable({ ...draft, trxId: 'Card **3829' }, none)).toBe(false);
  });
  it('skips receipts and likely duplicates', () => {
    expect(isBulkApprovable({ ...draft, source: 'ocr_receipt' }, none)).toBe(false);
    expect(isBulkApprovable(draft, new Set(['d1']))).toBe(false);
  });
});
