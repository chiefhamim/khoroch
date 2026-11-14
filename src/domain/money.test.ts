import {
  compact,
  formatBalanceWithDue,
  formatMinorToDraft,
  formatMissingMetric,
  formatMoney,
  formatWholeMoney,
  HIDDEN_AMOUNT_TEXT,
  MISSING_METRIC_DASH,
  normalizeDigits,
  parseMoneyInput,
  parseNonNegativeMoneyInput,
  roundMinorToWhole,
} from './money';

describe('money parsing (TEST-CASES §1)', () => {
  it('parses valid integer and decimal inputs into minor units', () => {
    expect(parseMoneyInput('1250')).toEqual({ ok: true, minor: 125000 });
    expect(parseMoneyInput('1,250.5')).toEqual({ ok: true, minor: 125050 });
    expect(parseMoneyInput('0.29')).toEqual({ ok: true, minor: 29 });
    expect(parseMoneyInput('1.10')).toEqual({ ok: true, minor: 110 });
    expect(parseMoneyInput('999999999.99')).toEqual({ ok: true, minor: 99999999999 });
  });

  it('normalizes Bangla digits', () => {
    expect(normalizeDigits('২৫০')).toBe('250');
    expect(parseMoneyInput('২৫০')).toEqual({ ok: true, minor: 25000 });
  });

  it('returns null minor for empty/whitespace strings', () => {
    expect(parseMoneyInput('')).toEqual({ ok: true, minor: null });
    expect(parseMoneyInput('   ')).toEqual({ ok: true, minor: null });
  });

  it('rejects out-of-range, non-positive, >2 decimals, and invalid strings', () => {
    expect(parseMoneyInput('1000000000')).toEqual({ ok: false, error: 'too_large' });
    expect(parseMoneyInput('0')).toEqual({ ok: false, error: 'must_be_positive' });
    expect(parseMoneyInput('0.00')).toEqual({ ok: false, error: 'must_be_positive' });
    expect(parseMoneyInput('-5')).toEqual({ ok: false, error: 'invalid' });
    expect(parseMoneyInput('0.005')).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(parseMoneyInput('abc')).toEqual({ ok: false, error: 'invalid' });
    expect(parseMoneyInput('1.2.3')).toEqual({ ok: false, error: 'invalid' });
  });

  it('allows zero when using parseNonNegativeMoneyInput (e.g. optional fees)', () => {
    expect(parseNonNegativeMoneyInput('0')).toEqual({ ok: true, minor: 0 });
    expect(parseNonNegativeMoneyInput('0.00')).toEqual({ ok: true, minor: 0 });
    expect(parseNonNegativeMoneyInput('০')).toEqual({ ok: true, minor: 0 });
    expect(parseNonNegativeMoneyInput('15.5')).toEqual({ ok: true, minor: 1550 });
    expect(parseNonNegativeMoneyInput('')).toEqual({ ok: true, minor: null });
    expect(parseNonNegativeMoneyInput('-1')).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('money formatting (TEST-CASES §1)', () => {
  it('formats BDT, USD, and EUR exactly as specified', () => {
    expect(formatMoney(125000, 'BDT')).toBe('৳ 1,250');
    expect(formatMoney(125050, 'BDT')).toBe('৳ 1,250.50');
    expect(formatMoney(29, 'BDT')).toBe('৳ 0.29');
    expect(formatMoney(0, 'BDT')).toBe('৳ 0');
    expect(formatMoney(-20000000, 'BDT')).toBe('-৳ 200,000');
    expect(formatMoney(123456789, 'USD')).toBe('$1,234,567.89');
    expect(formatMoney(500000, 'EUR')).toBe('€5,000');
    expect(formatMoney(125000, 'BDT', { showPoisha: true })).toBe('৳ 1,250.00');
    expect(formatMoney(125000, 'BDT', { hidden: true })).toBe('Hidden');
    expect(formatMoney(4_835_000, 'BDT', { compact: true })).toBe('৳48.4k');
  });

  it('formats minor units cleanly for draft inputs without floats', () => {
    expect(formatMinorToDraft(125000)).toBe('1250');
    expect(formatMinorToDraft(1250)).toBe('12.5');
    expect(formatMinorToDraft(1205)).toBe('12.05');
    expect(formatMinorToDraft(0)).toBe('0');
  });
});

describe('v1.2 number formatting (TEST-CASES-v1.2 §E)', () => {
  it('rounds averages to whole taka', () => {
    expect(roundMinorToWhole(248769)).toBe(248800);
    expect(roundMinorToWhole(248749)).toBe(248700);
    expect(formatWholeMoney(248769, 'BDT')).toBe('৳2,488');
  });

  it('formats compact k and M amounts cleanly', () => {
    expect(compact(4_835_000)).toBe('৳48.4k');
    expect(compact(1_250_000_000)).toBe('৳12.5M');
    expect(compact(500_000)).toBe('৳5k');
    expect(compact(45_000)).toBe('৳450');
    expect(compact(-4_835_000, 'BDT')).toBe('-৳48.4k');
  });

  it('formats due card balances and missing metric placeholders without ellipsis dots', () => {
    expect(formatBalanceWithDue(-560_000, 'BDT')).toBe('৳5,600 due');
    expect(formatBalanceWithDue(1_113_150, 'BDT')).toBe('৳11,131.50');
    expect(formatMissingMetric('Set a monthly budget')).toEqual({
      value: MISSING_METRIC_DASH,
      reason: 'Set a monthly budget',
    });
    expect(HIDDEN_AMOUNT_TEXT).toBe('Hidden');
  });
});
