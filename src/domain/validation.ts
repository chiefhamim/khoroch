import { isValidLocalDate } from './dates';
import { MAX_AMOUNT_MINOR } from './money';
import type { CategoryKind, CurrencyCode, NewTransaction, TransactionType } from './types';

export const MAX_DESCRIPTION_LENGTH = 120;
export const MAX_NOTE_LENGTH = 500;
export const MAX_QUICK_ENTRY_LENGTH = 300;
export const MAX_CATEGORY_NAME_LENGTH = 32;
export const MAX_PROFILE_NAME_LENGTH = 50;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_TYPES: ReadonlySet<string> = new Set<TransactionType>(['expense', 'income']);
const VALID_CURRENCIES: ReadonlySet<string> = new Set<CurrencyCode>(['BDT', 'USD', 'EUR']);

export function isValidTransactionType(value: unknown): value is TransactionType {
  return typeof value === 'string' && VALID_TYPES.has(value);
}

export function isValidCategoryKind(value: unknown): value is CategoryKind {
  return typeof value === 'string' && VALID_TYPES.has(value);
}

export function isValidCurrency(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && VALID_CURRENCIES.has(value);
}

export function isValidLocalTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function isValidMonthStartDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 28;
}

export function isValidQuickEntryText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_QUICK_ENTRY_LENGTH;
}

export function validateNewTransaction(tx: {
  id: string;
  type: unknown;
  amountMinor: unknown;
  currency: unknown;
  occurredOn: unknown;
  occurredTime?: unknown;
  categoryId?: unknown;
  description?: unknown;
  note?: unknown;
}): ValidationResult {
  const errors: string[] = [];

  if (!tx.id || typeof tx.id !== 'string' || tx.id.trim().length === 0) {
    errors.push('invalid_id');
  }
  if (!isValidTransactionType(tx.type)) {
    errors.push('invalid_type');
  }
  if (
    typeof tx.amountMinor !== 'number' ||
    !Number.isInteger(tx.amountMinor) ||
    tx.amountMinor <= 0 ||
    tx.amountMinor > MAX_AMOUNT_MINOR
  ) {
    errors.push('invalid_amount');
  }
  if (!isValidCurrency(tx.currency)) {
    errors.push('invalid_currency');
  }
  if (typeof tx.occurredOn !== 'string' || !isValidLocalDate(tx.occurredOn)) {
    errors.push('invalid_date');
  }
  if (
    tx.occurredTime !== undefined &&
    tx.occurredTime !== null &&
    (typeof tx.occurredTime !== 'string' || !isValidLocalTime(tx.occurredTime))
  ) {
    errors.push('invalid_time');
  }
  if (tx.description !== undefined && tx.description !== null) {
    if (typeof tx.description !== 'string' || tx.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push('description_too_long');
    }
  }
  if (tx.note !== undefined && tx.note !== null) {
    if (typeof tx.note !== 'string' || tx.note.length > MAX_NOTE_LENGTH) {
      errors.push('note_too_long');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidNewTransaction(tx: NewTransaction): void {
  const res = validateNewTransaction(tx);
  if (!res.valid) {
    throw new Error(`Invalid transaction: ${res.errors.join(', ')}`);
  }
}

export function validateCategoryInput(cat: {
  id: unknown;
  name: unknown;
  kind: unknown;
  icon?: unknown;
}): ValidationResult {
  const errors: string[] = [];
  if (typeof cat.id !== 'string' || cat.id.trim().length === 0) {
    errors.push('invalid_category_id');
  }
  if (typeof cat.name !== 'string' || cat.name.trim().length === 0) {
    errors.push('invalid_category_name');
  } else if (cat.name.length > MAX_CATEGORY_NAME_LENGTH) {
    errors.push('category_name_too_long');
  }
  if (!isValidCategoryKind(cat.kind)) {
    errors.push('invalid_category_kind');
  }
  if (cat.icon !== undefined && (typeof cat.icon !== 'string' || cat.icon.trim().length === 0)) {
    errors.push('invalid_category_icon');
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidCategoryInput(cat: {
  id: unknown;
  name: unknown;
  kind: unknown;
  icon?: unknown;
}): void {
  const res = validateCategoryInput(cat);
  if (!res.valid) {
    throw new Error(`Invalid category: ${res.errors.join(', ')}`);
  }
}

export function isValidBudgetAmount(amountMinor: unknown): amountMinor is number {
  return (
    typeof amountMinor === 'number' &&
    Number.isInteger(amountMinor) &&
    amountMinor >= 0 &&
    amountMinor <= MAX_AMOUNT_MINOR
  );
}
