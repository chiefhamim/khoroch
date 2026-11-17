import {
  getCompactNumberPart,
  groupThousands,
  roundMinorToWhole,
} from '@/domain/money';
import { typography } from '@/theme/tokens';

/**
 * Deterministic "does this amount fit" maths for the Money component. Pure layout estimation:
 * no measuring, no adjustsFontSizeToFit (which Android does not apply to the inline taka sign and
 * react-native-web ignores).
 *
 * Width model, as a fraction of the font size (tabular numerals):
 * - Latin digit 0.6 (Manrope tabular figures are about 0.6em, the negative letter spacing on the
 *   large variants cancels the rest).
 * - Bangla digit 0.68 (Hind Siliguri digits are wider and the font is mapped in for Bangla).
 * - Comma and period 0.3, minus sign 0.6, compact suffix letter (k, M) 0.6.
 * - Taka sign: the glyph is drawn at 0.6 of the number size (see getTakaSignMetrics) plus its
 *   0.06 left spacer, so about 0.45 including side bearings.
 */
export const LATIN_DIGIT_EM = 0.6;
export const BANGLA_DIGIT_EM = 0.68;
export const SEPARATOR_EM = 0.3;
export const SIGN_EM = 0.6;
export const SUFFIX_EM = 0.6;
export const SYMBOL_EM = 0.45;

/** Money never renders below the label size, whatever variants are offered. */
export const MIN_FIT_FONT_SIZE = typography.label.fontSize;

export interface FitVariant<K extends string = string> {
  key: K;
  fontSize: number;
}

export interface NumberPartOptions {
  compact: boolean;
  showDecimals: boolean;
  roundToWhole: boolean;
}

/** The digits-and-separators part of an amount (no sign, no symbol). Shared with Money. */
export function formatNumberPart(
  amountMinor: number,
  { compact, showDecimals, roundToWhole }: NumberPartOptions
): { numberPart: string; isNegative: boolean } {
  const normalized = roundToWhole ? roundMinorToWhole(amountMinor) : Math.trunc(amountMinor);
  const isNegative = normalized < 0;
  if (compact) {
    return { numberPart: getCompactNumberPart(normalized).numberPart, isNegative };
  }
  const abs = Math.abs(normalized);
  const frac = abs % 100;
  const whole = (abs - frac) / 100;
  const wholeStr = groupThousands(String(whole));
  const includeDecimals = frac !== 0 || showDecimals;
  return {
    numberPart: includeDecimals ? `${wholeStr}.${String(frac).padStart(2, '0')}` : wholeStr,
    isNegative,
  };
}

/** Estimated rendered width in dp of the full amount (sign, digits, symbol) at one font size. */
export function estimateMoneyWidth(
  numberPart: string,
  fontSize: number,
  opts: { bangla: boolean; negative: boolean; symbolChars?: number }
): number {
  const digitEm = opts.bangla ? BANGLA_DIGIT_EM : LATIN_DIGIT_EM;
  let em = 0;
  for (const ch of numberPart) {
    if (ch >= '0' && ch <= '9') em += digitEm;
    else if (ch === ',' || ch === '.') em += SEPARATOR_EM;
    else em += SUFFIX_EM;
  }
  if (opts.negative) em += SIGN_EM;
  em += SYMBOL_EM * (opts.symbolChars ?? 1);
  return em * fontSize;
}

export interface FitMoneyInput<K extends string = string> extends NumberPartOptions {
  amountMinor: number;
  /** Available width in dp. Zero, negative, NaN or undefined means "unknown". */
  availableWidth: number | null | undefined;
  /** Ordered from preferred (largest) to smallest. */
  variants: readonly FitVariant<K>[];
  bangla: boolean;
  /** True when a visible sign (minus or custom prefix) will be drawn. Defaults to the amount sign. */
  hasSign?: boolean;
  symbolChars?: number;
}

export interface FitMoneyResult<K extends string = string> {
  variant: K;
  fontSize: number;
  compact: boolean;
}

/**
 * Picks the first variant whose estimated width fits. If none fits, returns the smallest
 * allowed variant with compact formatting. Unknown width returns the first variant unchanged.
 */
export function fitMoney<K extends string>(input: FitMoneyInput<K>): FitMoneyResult<K> {
  const { variants, availableWidth, amountMinor, bangla } = input;
  const first = variants[0];
  if (!first) throw new Error('fitMoney needs at least one variant');
  const preferCompact = input.compact;
  const unchanged: FitMoneyResult<K> = {
    variant: first.key,
    fontSize: first.fontSize,
    compact: preferCompact,
  };
  if (typeof availableWidth !== 'number' || !Number.isFinite(availableWidth) || availableWidth <= 0) {
    return unchanged;
  }

  const allowed = variants.filter((v) => v.fontSize >= MIN_FIT_FONT_SIZE);
  if (allowed.length === 0) return unchanged;

  const full = formatNumberPart(amountMinor, input);
  const negative = input.hasSign ?? full.isNegative;
  const measure = (numberPart: string, fontSize: number) =>
    estimateMoneyWidth(numberPart, fontSize, { bangla, negative, symbolChars: input.symbolChars });

  for (const v of allowed) {
    if (measure(full.numberPart, v.fontSize) <= availableWidth) {
      return { variant: v.key, fontSize: v.fontSize, compact: preferCompact };
    }
  }

  const smallest = allowed.reduce((a, b) => (b.fontSize < a.fontSize ? b : a));
  return { variant: smallest.key, fontSize: smallest.fontSize, compact: true };
}
