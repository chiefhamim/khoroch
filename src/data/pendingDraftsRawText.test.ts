import { MemoryRepo } from './memoryRepo';

const base = {
  source: 'share_text' as const,
  draftKind: 'transaction' as const,
  type: 'expense' as const,
  amountMinor: 10_000,
  feeMinor: 0,
  categoryId: null,
  accountId: null,
  description: 'Test',
  rawText: 'original message text',
  trxId: null,
  occurredOn: '2026-11-10',
  occurredTime: null,
};

describe('pending draft raw text', () => {
  it('is blanked once a draft is approved or dismissed, and the row stays', async () => {
    const repo = new MemoryRepo();
    await repo.upsertPendingDrafts([
      { ...base, id: 'a', fingerprint: 'fp:a' },
      { ...base, id: 'b', fingerprint: 'fp:b' },
    ]);
    await repo.updatePendingDraftStatus('a', 'approved');
    await repo.updatePendingDraftStatus('b', 'dismissed');
    const all = await repo.listPendingDrafts();
    expect(all).toHaveLength(2);
    expect(all.every((d) => d.rawText === '')).toBe(true);
    // The same message cannot come back as a new draft.
    expect(await repo.upsertPendingDrafts([{ ...base, id: 'c', fingerprint: 'fp:a' }])).toBe(0);
  });
});

describe('updatePendingDraft', () => {
  it('changes only the fields in the patch and ignores a non-positive amount', async () => {
    const repo = new MemoryRepo();
    await repo.upsertPendingDrafts([{ ...base, id: 'a', fingerprint: 'fp:a', description: 'Old (USD 1.00)' }]);
    await repo.updatePendingDraft('a', { accountId: 'acc_cash' });
    await repo.updatePendingDraft('a', { categoryId: 'food_dining' });
    await repo.updatePendingDraft('a', { amountMinor: 0 });
    let [d] = await repo.listPendingDrafts();
    expect([d.accountId, d.categoryId, d.amountMinor, d.description]).toEqual([
      'acc_cash',
      'food_dining',
      10_000,
      'Old (USD 1.00)',
    ]);
    await repo.updatePendingDraft('a', { amountMinor: 12_300, description: 'Old' });
    [d] = await repo.listPendingDrafts();
    expect([d.amountMinor, d.description, d.accountId]).toEqual([12_300, 'Old', 'acc_cash']);
  });
});
