import type { CurrencyCode } from './types';

export const MAX_AMOUNT_MINOR = 99_999_999_999; // 999,999,999.99

export type MoneyParseError =
  | 'invalid'
  | 'must_be_positive'
  | 'too_many_decimals'
  | 'too_large';

export type MoneyParseResult =
  | { ok: true; minor: number | null }
  | { ok: false; error: MoneyParseError };

const BANGLA_DIGIT_BASE = 0x09e6; // '০'
const BANGLA_DIGIT_END = 0x09ef; // '৯'

/** Converts Bangla numerals (০–৯) to ASCII digits (0–9). */
export function normalizeDigits(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= BANGLA_DIGIT_BASE && code <= BANGLA_DIGIT_END) {
      out += String(code - BANGLA_DIGIT_BASE);
    } else {
      out += input[i];
    }
  }
  return out;
}

/**
 * Parses a decimal money string into integer minor units (1/100th).
 * Never uses floating-point arithmetic.
 */
export function parseMoneyInput(raw: string): MoneyParseResult {
  const normalized = normalizeDigits(raw).trim();
  if (normalized.length === 0) {
    return { ok: true, minor: null };
  }

  // Reject malformed commas like leading/trailing/repeated commas or adjacent to decimal point.
  if (
    normalized.startsWith(',') ||
    normalized.endsWith(',') ||
    normalized.includes(',,') ||
    normalized.includes(',.') ||
    normalized.includes('.,')
  ) {
    return { ok: false, error: 'invalid' };
  }

  const cleaned = normalized.replace(/,/g, '');
  if (!/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(cleaned)) {
    return { ok: false, error: 'invalid' };
  }

  const dotIdx = cleaned.indexOf('.');
  const wholeRaw = dotIdx === -1 ? cleaned : cleaned.slice(0, dotIdx);
  const fracRaw = dotIdx === -1 ? '' : cleaned.slice(dotIdx + 1);

  if (fracRaw.length > 2) {
    return { ok: false, error: 'too_many_decimals' };
  }

  const wholeTrimmed = wholeRaw.replace(/^0+/, '') || '0';
  if (wholeTrimmed.length > 9) {
    return { ok: false, error: 'too_large' };
  }

  const wholeNum = Number.parseInt(wholeTrimmed, 10);
  const fracPadded = fracRaw.padEnd(2, '0');
  const fracNum = Number.parseInt(fracPadded, 10);
  const minor = wholeNum * 100 + fracNum;

  if (minor === 0) {
    return { ok: false, error: 'must_be_positive' };
  }
  if (minor > MAX_AMOUNT_MINOR) {
    return { ok: false, error: 'too_large' };
  }

  return { ok: true, minor };
}

/**
 * Parses a decimal money string into non-negative integer minor units (allowing explicit 0),
 * used for optional fees or zero-allowed inputs while preserving strict decimal validation.
 */
export function parseNonNegativeMoneyInput(raw: string): MoneyParseResult {
  const parsed = parseMoneyInput(raw);
  if (!parsed.ok && parsed.error === 'must_be_positive') {
    return { ok: true, minor: 0 };
  }
  return parsed;
}

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  spaceAfterSymbol: boolean;
  name: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  BDT: { code: 'BDT', symbol: '৳', spaceAfterSymbol: true, name: 'Bangladeshi Taka' },
  USD: { code: 'USD', symbol: '$', spaceAfterSymbol: false, name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', spaceAfterSymbol: false, name: 'Euro' },
};

/**
 * Isolated thousands grouping helper (Western 3-digit grouping in v1).
 * Kept in one place so lakh-style grouping can be switched later.
 */
export function groupThousands(digits: string): string {
  if (digits.length <= 3) return digits;
  let result = '';
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      result = ',' + result;
    }
    result = digits[i] + result;
    count++;
  }
  return result;
}

export const MISSING_METRIC_DASH = '—';
export const HIDDEN_AMOUNT_TEXT = 'Hidden';

export interface FormatMoneyOptions {
  showPoisha?: boolean;
  hidden?: boolean;
  compact?: boolean;
}

/**
 * Formats integer minor units for display without float division.
 * Whole units omit decimals unless `options.showPoisha` is true; fractional units show 2 decimal places.
 */
export function formatMoney(
  amountMinor: number,
  currency: CurrencyCode,
  options?: FormatMoneyOptions
): string {
  if (options?.hidden) {
    return HIDDEN_AMOUNT_TEXT;
  }
  if (options?.compact) {
    return compactMoney(amountMinor, currency);
  }
  const safeMinor = Math.trunc(amountMinor);
  const isNegative = safeMinor < 0;
  const absMinor = Math.abs(safeMinor);

  const frac = absMinor % 100;
  const whole = (absMinor - frac) / 100;

  const wholeFormatted = groupThousands(String(whole));
  const includeDecimals = frac !== 0 || Boolean(options?.showPoisha);
  const numberPart = includeDecimals
    ? `${wholeFormatted}.${String(frac).padStart(2, '0')}`
    : wholeFormatted;

  const meta = CURRENCIES[currency] ?? CURRENCIES.BDT;
  const prefix = meta.spaceAfterSymbol ? `${meta.symbol} ` : meta.symbol;
  return `${isNegative ? '-' : ''}${prefix}${numberPart}`;
}

/**
 * Rounds integer minor units to nearest whole major currency unit (e.g. `248769` -> `248800`).
 */
export function roundMinorToWhole(amountMinor: number): number {
  const safe = Math.trunc(amountMinor);
  if (safe === 0) return 0;
  const absRoundedWhole = Math.round(Math.abs(safe) / 100);
  const res = absRoundedWhole * 100;
  return safe < 0 ? -res : res;
}

/**
 * Formats a value rounded to the nearest whole major currency unit (TEST-CASES-v1.2 §E).
 */
export function formatWholeMoney(amountMinor: number, currency: CurrencyCode = 'BDT'): string {
  const rounded = roundMinorToWhole(amountMinor);
  const isNegative = rounded < 0;
  const absWhole = Math.abs(rounded) / 100;
  const meta = CURRENCIES[currency] ?? CURRENCIES.BDT;
  return `${isNegative ? '-' : ''}${meta.symbol}${groupThousands(String(absWhole))}`;
}

function formatTenthsUnit(tenths: number, suffix: 'k' | 'M'): string {
  const whole = Math.floor(tenths / 10);
  const dec = tenths % 10;
  const wholeStr = groupThousands(String(whole));
  return dec === 0 ? `${wholeStr}${suffix}` : `${wholeStr}.${dec}${suffix}`;
}

/**
 * Splits minor units into compact display parts (`৳` symbol separated from `48.4k` / `12.5M`)
 * for cards and summary strips (never used in Ledger rows).
 */
export function getCompactNumberPart(amountMinor: number): {
  isNegative: boolean;
  numberPart: string;
} {
  const safeMinor = Math.trunc(amountMinor);
  const isNegative = safeMinor < 0;
  const absMinor = Math.abs(safeMinor);
  const roundedWhole = Math.round(absMinor / 100);

  if (roundedWhole < 1000) {
    const frac = absMinor % 100;
    const whole = (absMinor - frac) / 100;
    const numberPart = frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
    return { isNegative, numberPart };
  }

  const tenthsK = Math.floor((roundedWhole * 10 + 500) / 1000);
  if (tenthsK < 10_000) {
    return { isNegative, numberPart: formatTenthsUnit(tenthsK, 'k') };
  }

  const tenthsM = Math.floor((roundedWhole * 10 + 500_000) / 1_000_000);
  return { isNegative, numberPart: formatTenthsUnit(tenthsM, 'M') };
}

/**
 * Formats an amount into compact `k` / `M` form per TEST-CASES-v1.2 §E (`4835000` -> `৳48.4k`).
 */
export function compactMoney(amountMinor: number, currency: CurrencyCode = 'BDT'): string {
  const { isNegative, numberPart } = getCompactNumberPart(amountMinor);
  const meta = CURRENCIES[currency] ?? CURRENCIES.BDT;
  return `${isNegative ? '-' : ''}${meta.symbol}${numberPart}`;
}

export const compact = compactMoney;

/**
 * Formats a credit card or wallet balance where negative balances display as `"৳5,600 due"`
 * and positive balances preserve exact minor decimals without rounding.
 */
export function formatBalanceWithDue(amountMinor: number, currency: CurrencyCode = 'BDT'): string {
  const safeMinor = Math.trunc(amountMinor);
  const absMinor = Math.abs(safeMinor);
  const frac = absMinor % 100;
  const whole = (absMinor - frac) / 100;
  const wholeStr = groupThousands(String(whole));
  const numberPart = frac === 0 ? wholeStr : `${wholeStr}.${String(frac).padStart(2, '0')}`;
  const meta = CURRENCIES[currency] ?? CURRENCIES.BDT;
  if (safeMinor < 0) {
    return `${meta.symbol}${numberPart} due`;
  }
  return `${meta.symbol}${numberPart}`;
}

/**
 * Formats an optional average metric as whole currency units or `"—"` with an explicit reason.
 */
export function formatMissingMetric(reason: string): { value: string; reason: string } {
  return {
    value: MISSING_METRIC_DASH,
    reason,
  };
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  return (CURRENCIES[currency] ?? CURRENCIES.BDT).symbol;
}

/**
 * Formats non-negative minor units into a plain decimal input string (e.g. `1250` -> `"12.5"`).
 */
export function formatMinorToDraft(amountMinor: number): string {
  const safeMinor = Math.max(0, Math.trunc(amountMinor));
  const frac = safeMinor % 100;
  const whole = (safeMinor - frac) / 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}
