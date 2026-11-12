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

/**
 * Formats integer minor units for display without float division.
 * Whole units omit decimals; fractional units always show 2 decimal places.
 */
export function formatMoney(amountMinor: number, currency: CurrencyCode): string {
  const safeMinor = Math.trunc(amountMinor);
  const isNegative = safeMinor < 0;
  const absMinor = Math.abs(safeMinor);

  const frac = absMinor % 100;
  const whole = (absMinor - frac) / 100;

  const wholeFormatted = groupThousands(String(whole));
  const numberPart =
    frac === 0 ? wholeFormatted : `${wholeFormatted}.${String(frac).padStart(2, '0')}`;

  const meta = CURRENCIES[currency] ?? CURRENCIES.BDT;
  const prefix = meta.spaceAfterSymbol ? `${meta.symbol} ` : meta.symbol;
  return `${isNegative ? '-' : ''}${prefix}${numberPart}`;
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  return (CURRENCIES[currency] ?? CURRENCIES.BDT).symbol;
}
