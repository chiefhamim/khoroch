import { formatMinorToDraft, normalizeDigits, parseNonNegativeMoneyInput } from './money';
import type { AccountKind } from './types';

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
  // Trailing zeros carry no value: "1.850" is 1.85, but "1.851" has a third real decimal.
  const fracRaw = dot === -1 ? '' : text.slice(dot + 1).replace(/0+$/, '');
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

/** Minimal wallet shape the fee rules need. */
export interface FeeWallet {
  kind: AccountKind;
  defaultFeeBp?: number | null;
}

/** Wallet kinds that can carry a default fee rate: only mobile wallets charge a cash-out fee. */
export function canHaveDefaultFee(kind: AccountKind): boolean {
  return kind === 'mobile_wallet';
}

/**
 * The one definition of a cash-out: money leaves a mobile wallet and lands in a cash wallet.
 * Drives the "Cash-out fee?" badge, the "Cash out" wording and the default fee pre-fill.
 */
export function isCashOutTransfer(
  from: Pick<FeeWallet, 'kind'> | null | undefined,
  to: Pick<FeeWallet, 'kind'> | null | undefined
): boolean {
  return from != null && to != null && canHaveDefaultFee(from.kind) && to.kind === 'cash';
}

/**
 * What the user has done to the fee field of a transfer:
 * untouched shows the wallet default when one applies, typed keeps their text, cleared means no fee.
 */
export type FeeEntryState =
  | { mode: 'untouched' }
  | { mode: 'typed'; text: string }
  | { mode: 'cleared' };

export const UNTOUCHED_FEE: FeeEntryState = { mode: 'untouched' };

/** Typing text is "typed"; erasing it to nothing is "cleared" (a deliberate no-fee). */
export function feeStateFromText(text: string): FeeEntryState {
  return text.trim().length === 0 ? { mode: 'cleared' } : { mode: 'typed', text };
}

export interface TransferFeeInput {
  from: FeeWallet | null | undefined;
  to: Pick<FeeWallet, 'kind'> | null | undefined;
  amountMinor: number;
  state: FeeEntryState;
  /** False when editing a saved transfer: the stored fee is the only truth, the default never applies. */
  allowDefault?: boolean;
}

export interface TransferFeeResult {
  /** Fee in minor units to save (0 when empty or the typed text is not a valid amount). */
  feeMinor: number;
  /** True when feeMinor came from the wallet default rather than from the user. */
  fromDefault: boolean;
  /** The text the fee field should show. */
  text: string;
  /** False when typed text is not a valid non-negative amount. */
  valid: boolean;
  /** Default rate in basis points that applies to this pair of wallets, else null. */
  defaultBp: number | null;
}

/** The single decision for a transfer fee. Every screen that creates or edits a transfer calls it. */
export function resolveTransferFee(input: TransferFeeInput): TransferFeeResult {
  const { from, to, amountMinor, state, allowDefault = true } = input;
  const rate = from?.defaultFeeBp;
  const defaultBp =
    allowDefault && isCashOutTransfer(from, to) && rate != null && rate > 0 && isValidFeeRateBp(rate)
      ? rate
      : null;

  if (state.mode === 'untouched') {
    const feeMinor = feeMinorFromRate(amountMinor, defaultBp);
    return {
      feeMinor,
      fromDefault: feeMinor > 0,
      text: feeMinor > 0 ? formatMinorToDraft(feeMinor) : '',
      valid: true,
      defaultBp,
    };
  }
  if (state.mode === 'cleared') {
    return { feeMinor: 0, fromDefault: false, text: '', valid: true, defaultBp };
  }
  const trimmed = state.text.trim();
  if (trimmed.length === 0) {
    return { feeMinor: 0, fromDefault: false, text: state.text, valid: true, defaultBp };
  }
  const parsed = parseNonNegativeMoneyInput(trimmed);
  if (!parsed.ok || parsed.minor === null || parsed.minor < 0) {
    return { feeMinor: 0, fromDefault: false, text: state.text, valid: false, defaultBp };
  }
  return { feeMinor: parsed.minor, fromDefault: false, text: state.text, valid: true, defaultBp };
}
