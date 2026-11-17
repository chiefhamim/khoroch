import { normalizeDigits } from './money';

/** A fee rate is stored as basis points of a percent with two exact decimals: 1.85% = 185. */
export const MAX_FEE_RATE_BP = 10_000; // 100.00%
const BP_PER_WHOLE_PERCENT = 100;
const BP_DENOMINATOR = 10_000; // amount * rateBp / 10000 = amount * (rate % / 100)

export type FeeRateParseResult =
  | { ok: true; bp: number | null }
  | { ok: false; error: 'invalid' | 'too_many_decimals' | 'too_large' };

export function isValidFeeRateBp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_FEE_RATE_BP
  );
}

/**
 * Parses typed percent text (Latin or Bangla digits, up to two decimals) into integer basis
 * points. Empty text gives bp null. Digit string arithmetic only, no floats.
 */
export function parseFeeRateInput(raw: string): FeeRateParseResult {
  const text = normalizeDigits(raw).trim();
  if (text.length === 0) return { ok: true, bp: null };
  if (!/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(text)) return { ok: false, error: 'invalid' };

  const dot = text.indexOf('.');
  const wholeRaw = dot === -1 ? text : text.slice(0, dot);
  const fracRaw = dot === -1 ? '' : text.slice(dot + 1);
  if (fracRaw.length > 2) return { ok: false, error: 'too_many_decimals' };

  const whole = wholeRaw.replace(/^0+/, '') || '0';
  if (whole.length > 3) return { ok: false, error: 'too_large' };

  const bp =
    Number.parseInt(whole, 10) * BP_PER_WHOLE_PERCENT + Number.parseInt(fracRaw.padEnd(2, '0'), 10);
  if (bp > MAX_FEE_RATE_BP) return { ok: false, error: 'too_large' };
  return { ok: true, bp };
}

/** Basis points to plain percent text without trailing zeros: 185 -> "1.85", 150 -> "1.5", 100 -> "1". */
export function formatFeeRateBp(bp: number): string {
  const frac = bp % BP_PER_WHOLE_PERCENT;
  const whole = (bp - frac) / BP_PER_WHOLE_PERCENT;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

/**
 * Fee in minor units for an amount in minor units.
 * fee = round_half_up(amountMinor * rateBp / 10000), done as integer multiply, add half the
 * denominator, then an exact integer quotient (remainder subtracted, so no float division).
 * Largest input: 99,999,999,999 * 10,000 + 5,000 is about 1e15, under Number.MAX_SAFE_INTEGER.
 * Null or zero rate, or a non-positive amount, gives 0.
 */
export function feeMinorFromRate(amountMinor: number, rateBp: number | null | undefined): number {
  if (rateBp === null || rateBp === undefined || rateBp <= 0) return 0;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return 0;
  if (!isValidFeeRateBp(rateBp)) return 0;
  const scaled = amountMinor * rateBp + BP_DENOMINATOR / 2;
  return (scaled - (scaled % BP_DENOMINATOR)) / BP_DENOMINATOR;
}
