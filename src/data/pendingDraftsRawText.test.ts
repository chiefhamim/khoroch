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
