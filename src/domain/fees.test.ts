import {
  canHaveDefaultFee,
  feeMinorFromRate,
  feeStateFromText,
  formatFeeRateBp,
  isCashOutTransfer,
  isFeeLargerThanAmount,
  MAX_FEE_RATE_BP,
  parseFeeRateInput,
  resolveTransferFee,
  UNTOUCHED_FEE,
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
  it('ignores trailing zeros in the decimal part but still rejects a real third decimal', () => {
    expect(parseFeeRateInput('1.850')).toEqual({ ok: true, bp: 185 });
    expect(parseFeeRateInput('1.8500')).toEqual({ ok: true, bp: 185 });
    expect(parseFeeRateInput('2.000')).toEqual({ ok: true, bp: 200 });
    expect(parseFeeRateInput('1.851')).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(parseFeeRateInput('1.8501')).toEqual({ ok: false, error: 'too_many_decimals' });
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

describe('isCashOutTransfer and canHaveDefaultFee', () => {
  it('is only mobile wallet to cash', () => {
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, { kind: 'cash' })).toBe(true);
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, { kind: 'bank' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, { kind: 'credit_card' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, { kind: 'mobile_wallet' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'bank' }, { kind: 'cash' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'cash' }, { kind: 'cash' })).toBe(false);
    expect(isCashOutTransfer(null, { kind: 'cash' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, undefined)).toBe(false);
  });
  it('only mobile wallets can carry a rate', () => {
    expect(canHaveDefaultFee('mobile_wallet')).toBe(true);
    expect(canHaveDefaultFee('cash')).toBe(false);
    expect(canHaveDefaultFee('bank')).toBe(false);
    expect(canHaveDefaultFee('credit_card')).toBe(false);
  });
});

describe('resolveTransferFee', () => {
  const bkash = { kind: 'mobile_wallet' as const, defaultFeeBp: 185 };
  const cash = { kind: 'cash' as const };
  const bank = { kind: 'bank' as const };

  it('untouched cash-out shows the default and marks it as default', () => {
    expect(resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE })).toEqual({
      feeMinor: 1_850,
      fromDefault: true,
      text: '18.5',
      valid: true,
      defaultBp: 185,
    });
  });
  it('untouched follows the amount', () => {
    const r = resolveTransferFee({ from: bkash, to: cash, amountMinor: 1_000_000, state: UNTOUCHED_FEE });
    expect(r.feeMinor).toBe(18_500);
    expect(r.text).toBe('185');
  });
  it('no default for a bank, card, another mobile wallet, a zero or missing rate', () => {
    for (const to of [bank, { kind: 'credit_card' as const }, { kind: 'mobile_wallet' as const }]) {
      const r = resolveTransferFee({ from: bkash, to, amountMinor: 100_000, state: UNTOUCHED_FEE });
      expect(r).toMatchObject({ feeMinor: 0, fromDefault: false, text: '', defaultBp: null });
    }
    expect(
      resolveTransferFee({ from: { kind: 'mobile_wallet', defaultFeeBp: 0 }, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE })
    ).toMatchObject({ feeMinor: 0, defaultBp: null });
    expect(
      resolveTransferFee({ from: { kind: 'mobile_wallet' }, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE })
    ).toMatchObject({ feeMinor: 0, defaultBp: null });
    expect(
      resolveTransferFee({ from: { kind: 'bank', defaultFeeBp: 185 }, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE })
    ).toMatchObject({ feeMinor: 0, defaultBp: null });
  });
  it('typed text wins and is never overwritten by a changed amount', () => {
    const a = resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state: feeStateFromText('20') });
    const b = resolveTransferFee({ from: bkash, to: cash, amountMinor: 9_999_900, state: feeStateFromText('20') });
    expect(a).toMatchObject({ feeMinor: 2_000, fromDefault: false, text: '20', valid: true, defaultBp: 185 });
    expect(b.feeMinor).toBe(2_000);
  });
  it('cleared stays empty and means no fee even when a default applies', () => {
    const state = feeStateFromText('  ');
    expect(state).toEqual({ mode: 'cleared' });
    expect(resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state })).toEqual({
      feeMinor: 0,
      fromDefault: false,
      text: '',
      valid: true,
      defaultBp: 185,
    });
  });
  it('invalid typed text is flagged and saves no fee', () => {
    expect(resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state: feeStateFromText('12..5') })).toMatchObject({
      feeMinor: 0,
      valid: false,
    });
  });
  it('allowDefault false never applies the default and hides the rate', () => {
    expect(
      resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE, allowDefault: false })
    ).toMatchObject({ feeMinor: 0, fromDefault: false, text: '', defaultBp: null });
  });
});

describe('isCashOutTransfer and canHaveDefaultFee', () => {
  it('is only mobile wallet to cash', () => {
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, { kind: 'cash' })).toBe(true);
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, { kind: 'bank' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, { kind: 'credit_card' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, { kind: 'mobile_wallet' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'bank' }, { kind: 'cash' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'cash' }, { kind: 'cash' })).toBe(false);
    expect(isCashOutTransfer(null, { kind: 'cash' })).toBe(false);
    expect(isCashOutTransfer({ kind: 'mobile_wallet' }, undefined)).toBe(false);
  });
  it('only mobile wallets can carry a rate', () => {
    expect(canHaveDefaultFee('mobile_wallet')).toBe(true);
    expect(canHaveDefaultFee('cash')).toBe(false);
    expect(canHaveDefaultFee('bank')).toBe(false);
    expect(canHaveDefaultFee('credit_card')).toBe(false);
  });
});

describe('resolveTransferFee', () => {
  const bkash = { kind: 'mobile_wallet' as const, defaultFeeBp: 185 };
  const cash = { kind: 'cash' as const };
  const bank = { kind: 'bank' as const };

  it('untouched cash-out shows the default and marks it as default', () => {
    expect(resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE })).toEqual({
      feeMinor: 1_850,
      fromDefault: true,
      text: '18.5',
      valid: true,
      defaultBp: 185,
    });
  });
  it('untouched follows the amount', () => {
    const r = resolveTransferFee({ from: bkash, to: cash, amountMinor: 1_000_000, state: UNTOUCHED_FEE });
    expect(r.feeMinor).toBe(18_500);
    expect(r.text).toBe('185');
  });
  it('no default for a bank, card, another mobile wallet, a zero or missing rate', () => {
    for (const to of [bank, { kind: 'credit_card' as const }, { kind: 'mobile_wallet' as const }]) {
      const r = resolveTransferFee({ from: bkash, to, amountMinor: 100_000, state: UNTOUCHED_FEE });
      expect(r).toMatchObject({ feeMinor: 0, fromDefault: false, text: '', defaultBp: null });
    }
    expect(
      resolveTransferFee({ from: { kind: 'mobile_wallet', defaultFeeBp: 0 }, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE })
    ).toMatchObject({ feeMinor: 0, defaultBp: null });
    expect(
      resolveTransferFee({ from: { kind: 'mobile_wallet' }, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE })
    ).toMatchObject({ feeMinor: 0, defaultBp: null });
    expect(
      resolveTransferFee({ from: { kind: 'bank', defaultFeeBp: 185 }, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE })
    ).toMatchObject({ feeMinor: 0, defaultBp: null });
  });
  it('typed text wins and is never overwritten by a changed amount', () => {
    const a = resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state: feeStateFromText('20') });
    const b = resolveTransferFee({ from: bkash, to: cash, amountMinor: 9_999_900, state: feeStateFromText('20') });
    expect(a).toMatchObject({ feeMinor: 2_000, fromDefault: false, text: '20', valid: true, defaultBp: 185 });
    expect(b.feeMinor).toBe(2_000);
  });
  it('cleared stays empty and means no fee even when a default applies', () => {
    const state = feeStateFromText('  ');
    expect(state).toEqual({ mode: 'cleared' });
    expect(resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state })).toEqual({
      feeMinor: 0,
      fromDefault: false,
      text: '',
      valid: true,
      defaultBp: 185,
    });
  });
  it('invalid typed text is flagged and saves no fee', () => {
    expect(resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state: feeStateFromText('12..5') })).toMatchObject({
      feeMinor: 0,
      valid: false,
    });
  });
  it('allowDefault false never applies the default and hides the rate', () => {
    expect(
      resolveTransferFee({ from: bkash, to: cash, amountMinor: 100_000, state: UNTOUCHED_FEE, allowDefault: false })
    ).toMatchObject({ feeMinor: 0, fromDefault: false, text: '', defaultBp: null });
  });
});

describe('isFeeLargerThanAmount', () => {
  it('flags a fee strictly above the amount', () => {
    expect(isFeeLargerThanAmount(10_001, 10_000)).toBe(true);
    expect(isFeeLargerThanAmount(500, 100)).toBe(true);
  });
  it('does not flag an equal, smaller or zero fee', () => {
    expect(isFeeLargerThanAmount(10_000, 10_000)).toBe(false);
    expect(isFeeLargerThanAmount(9_999, 10_000)).toBe(false);
    expect(isFeeLargerThanAmount(0, 10_000)).toBe(false);
  });
  it('does not flag before an amount is entered or for non-integers', () => {
    expect(isFeeLargerThanAmount(500, 0)).toBe(false);
    expect(isFeeLargerThanAmount(500, -1)).toBe(false);
    expect(isFeeLargerThanAmount(1.5, 1)).toBe(false);
  });
});
