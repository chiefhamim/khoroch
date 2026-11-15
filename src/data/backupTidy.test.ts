import { dropUnusedDuplicateWallets } from './backup';
import type { Account } from '@/domain/types';

function wallet(id: string, name: string, kind: Account['kind'] = 'cash'): Account {
  return {
    id,
    name,
    kind,
    provider: null,
    colorKey: '#123227',
    monogram: null,
    last4: null,
    openingBalanceMinor: 0,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('dropUnusedDuplicateWallets', () => {
  it('keeps the wallet with history and drops the unused twin', () => {
    const out = dropUnusedDuplicateWallets(
      [wallet('a', 'Cash'), wallet('b', 'Cash'), wallet('c', 'Bank', 'bank')],
      [{ accountId: 'a' }],
      [],
      []
    );
    expect(out.map((w) => w.id)).toEqual(['a', 'c']);
  });

  it('keeps both twins when both are used', () => {
    const out = dropUnusedDuplicateWallets(
      [wallet('a', 'Cash'), wallet('b', 'cash ')],
      [{ accountId: 'a' }],
      [{ fromAccountId: 'a', toAccountId: 'b' }],
      []
    );
    expect(out).toHaveLength(2);
  });

  it('keeps the first when no twin is used', () => {
    const out = dropUnusedDuplicateWallets([wallet('a', 'Cash'), wallet('b', 'Cash')], [], [], []);
    expect(out.map((w) => w.id)).toEqual(['a']);
  });
});
