import {
  feeMinorFromRate,
  formatFeeRateBp,
  MAX_FEE_RATE_BP,
  parseFeeRateInput,
} from './fees';
import { MAX_AMOUNT_MINOR } from './money';

describe('feeMinorFromRate', () => {
  it('10,000.00 at 1.85% is 185.00', () => {
    expect(feeMinorFromRate(1_000_000, 185)).toBe(18_500);
  });
  it('1,000.00 at 1.85% is 18.50', () => {
    expect(feeMinorFromRate(100_000, 185)).toBe(1_850);
  });
  it('500.00 at 1.85% is 9.25', () => {
    expect(feeMinorFromRate(50_000, 185)).toBe(925);
  });
  it('333.33 at 1.85% is 6.17 (33333 * 185 = 6,166,605; 616.6605 poisha rounds up to 617)', () => {
    expect(feeMinorFromRate(33_333, 185)).toBe(617);
  });
  it('rounds exactly half up and just below half down', () => {
    // 1 poisha at 50.00% = 0.5 poisha -> 1
    expect(feeMinorFromRate(1, 5_000)).toBe(1);
    // 1 poisha at 49.99% = 0.4999 -> 0
    expect(feeMinorFromRate(1, 4_999)).toBe(0);
    // 3 poisha at 1.50% = 0.045 -> 0 ; 100 poisha at 1.50% = 1.5 -> 2
    expect(feeMinorFromRate(3, 150)).toBe(0);
    expect(feeMinorFromRate(100, 150)).toBe(2);
  });
  it('null, undefined or zero rate gives 0', () => {
    expect(feeMinorFromRate(1_000_000, null)).toBe(0);
    expect(feeMinorFromRate(1_000_000, undefined)).toBe(0);
    expect(feeMinorFromRate(1_000_000, 0)).toBe(0);
  });
  it('non-positive or non-integer amounts and out-of-range rates give 0', () => {
    expect(feeMinorFromRate(0, 185)).toBe(0);
    expect(feeMinorFromRate(-5, 185)).toBe(0);
    expect(feeMinorFromRate(10.5, 185)).toBe(0);
    expect(feeMinorFromRate(1_000, MAX_FEE_RATE_BP + 1)).toBe(0);
  });
  it('largest amount at the largest rate stays exact and safe', () => {
    const scaled = MAX_AMOUNT_MINOR * MAX_FEE_RATE_BP + 5_000;
    expect(Number.isSafeInteger(scaled)).toBe(true);
    expect(feeMinorFromRate(MAX_AMOUNT_MINOR, MAX_FEE_RATE_BP)).toBe(MAX_AMOUNT_MINOR);
    // 99,999,999,999 * 185 = 18,499,999,999,815 ; + 5000 -> /10000 = 1,850,000,000 (floor)
    expect(feeMinorFromRate(MAX_AMOUNT_MINOR, 185)).toBe(1_850_000_000);
  });
});

describe('parseFeeRateInput', () => {
  it('parses Latin and Bangla digits to basis points', () => {
    expect(parseFeeRateInput('1.85')).toEqual({ ok: true, bp: 185 });
    expect(parseFeeRateInput('১.৮৫')).toEqual({ ok: true, bp: 185 });
    expect(parseFeeRateInput('1.5')).toEqual({ ok: true, bp: 150 });
    expect(parseFeeRateInput('2')).toEqual({ ok: true, bp: 200 });
    expect(parseFeeRateInput('.5')).toEqual({ ok: true, bp: 50 });
    expect(parseFeeRateInput('0')).toEqual({ ok: true, bp: 0 });
    expect(parseFeeRateInput('100')).toEqual({ ok: true, bp: 10_000 });
    expect(parseFeeRateInput('0.07')).toEqual({ ok: true, bp: 7 });
  });
  it('empty is null', () => {
    expect(parseFeeRateInput('  ')).toEqual({ ok: true, bp: null });
  });
  it('rejects bad text, third decimal, and over 100', () => {
    expect(parseFeeRateInput('abc')).toEqual({ ok: false, error: 'invalid' });
    expect(parseFeeRateInput('-1')).toEqual({ ok: false, error: 'invalid' });
    expect(parseFeeRateInput('1.855')).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(parseFeeRateInput('100.01')).toEqual({ ok: false, error: 'too_large' });
    expect(parseFeeRateInput('1000')).toEqual({ ok: false, error: 'too_large' });
  });
});

describe('formatFeeRateBp', () => {
  it('drops trailing zeros', () => {
    expect(formatFeeRateBp(185)).toBe('1.85');
    expect(formatFeeRateBp(150)).toBe('1.5');
    expect(formatFeeRateBp(100)).toBe('1');
    expect(formatFeeRateBp(7)).toBe('0.07');
    expect(formatFeeRateBp(10_000)).toBe('100');
    expect(formatFeeRateBp(0)).toBe('0');
  });
});
