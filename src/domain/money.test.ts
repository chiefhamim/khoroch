import { formatMinorToDraft, formatMoney, normalizeDigits, parseMoneyInput } from './money';

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
  });

  it('formats minor units cleanly for draft inputs without floats', () => {
    expect(formatMinorToDraft(125000)).toBe('1250');
    expect(formatMinorToDraft(1250)).toBe('12.5');
    expect(formatMinorToDraft(1205)).toBe('12.05');
    expect(formatMinorToDraft(0)).toBe('0');
  });
});
