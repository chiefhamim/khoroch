import {
  MAX_CATEGORY_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_QUICK_ENTRY_LENGTH,
  isValidCategoryKind,
  isValidQuickEntryText,
  validateCategoryInput,
  validateNewTransaction,
} from './validation';

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

  test('enforces S7 bounded length limits for description, note, quick entry, and category names', () => {
    expect(
      validateNewTransaction({
        id: 'tx-max',
        type: 'expense',
        amountMinor: 1000,
        currency: 'BDT',
        occurredOn: '2026-11-13',
        description: 'a'.repeat(MAX_DESCRIPTION_LENGTH),
        note: 'b'.repeat(MAX_NOTE_LENGTH),
      }).valid
    ).toBe(true);

    expect(
      validateNewTransaction({
        id: 'tx-too-long',
        type: 'expense',
        amountMinor: 1000,
        currency: 'BDT',
        occurredOn: '2026-11-13',
        description: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1),
        note: 'b'.repeat(MAX_NOTE_LENGTH + 1),
      }).errors
    ).toEqual(expect.arrayContaining(['description_too_long', 'note_too_long']));

    expect(isValidQuickEntryText('x'.repeat(MAX_QUICK_ENTRY_LENGTH))).toBe(true);
    expect(isValidQuickEntryText('x'.repeat(MAX_QUICK_ENTRY_LENGTH + 1))).toBe(false);

    expect(
      validateCategoryInput({
        id: 'cat-ok',
        name: 'c'.repeat(MAX_CATEGORY_NAME_LENGTH),
        kind: 'expense',
        icon: 'utensils',
      }).valid
    ).toBe(true);

    expect(
      validateCategoryInput({
        id: 'cat-long',
        name: 'c'.repeat(MAX_CATEGORY_NAME_LENGTH + 1),
        kind: 'expense',
        icon: 'utensils',
      }).errors
    ).toContain('category_name_too_long');

    expect(isValidCategoryKind('expense')).toBe(true);
    expect(isValidCategoryKind('income')).toBe(true);
    expect(isValidCategoryKind('transfer')).toBe(false);
  });
});
