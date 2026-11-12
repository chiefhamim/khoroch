import { validateNewTransaction } from './validation';

describe('validation', () => {
  it('accepts valid expense and income transactions', () => {
    expect(
      validateNewTransaction({
        id: 'tx-1',
        type: 'expense',
        amountMinor: 35000,
        currency: 'BDT',
        occurredOn: '2026-11-13',
        occurredTime: '14:30',
      }).valid
    ).toBe(true);

    expect(
      validateNewTransaction({
        id: 'tx-2',
        type: 'income',
        amountMinor: 5000000,
        currency: 'USD',
        occurredOn: '2026-11-01',
      }).valid
    ).toBe(true);
  });

  it('rejects v2 transaction types like transfer or refund (TEST-CASES §3)', () => {
    const transferRes = validateNewTransaction({
      id: 'tx-3',
      type: 'transfer',
      amountMinor: 10000,
      currency: 'BDT',
      occurredOn: '2026-11-13',
    });
    expect(transferRes.valid).toBe(false);
    expect(transferRes.errors).toContain('invalid_type');

    const refundRes = validateNewTransaction({
      id: 'tx-4',
      type: 'refund',
      amountMinor: 10000,
      currency: 'BDT',
      occurredOn: '2026-11-13',
    });
    expect(refundRes.valid).toBe(false);
    expect(refundRes.errors).toContain('invalid_type');
  });

  it('rejects non-positive, non-integer, or oversized amounts and invalid dates', () => {
    expect(
      validateNewTransaction({
        id: 'tx-5',
        type: 'expense',
        amountMinor: 0,
        currency: 'BDT',
        occurredOn: '2026-11-13',
      }).errors
    ).toContain('invalid_amount');

    expect(
      validateNewTransaction({
        id: 'tx-6',
        type: 'expense',
        amountMinor: 100.5,
        currency: 'BDT',
        occurredOn: '2026-11-13',
      }).errors
    ).toContain('invalid_amount');

    expect(
      validateNewTransaction({
        id: 'tx-7',
        type: 'expense',
        amountMinor: 10000,
        currency: 'BDT',
        occurredOn: '2026-02-30',
      }).errors
    ).toContain('invalid_date');
  });
});
