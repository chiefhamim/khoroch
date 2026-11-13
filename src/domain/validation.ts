import { isValidLocalDate } from './dates';
import { MAX_AMOUNT_MINOR } from './money';
import {
  ACCOUNT_KINDS,
  type AccountKind,
  type CategoryKind,
  type CurrencyCode,
  type NewTransaction,
  type TransactionType,
} from './types';

export const MAX_DESCRIPTION_LENGTH = 120;
export const MAX_NOTE_LENGTH = 500;
export const MAX_QUICK_ENTRY_LENGTH = 300;
export const MAX_CATEGORY_NAME_LENGTH = 32;
export const MAX_PROFILE_NAME_LENGTH = 50;
export const MAX_ACCOUNT_NAME_LENGTH = 40;
export const MAX_ACCOUNT_COLOR_KEY_LENGTH = 32;
export const MAX_MONOGRAM_LENGTH = 4;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_TYPES: ReadonlySet<string> = new Set<TransactionType>(['expense', 'income']);
const VALID_CURRENCIES: ReadonlySet<string> = new Set<CurrencyCode>(['BDT', 'USD', 'EUR']);
const VALID_ACCOUNT_KINDS: ReadonlySet<string> = new Set<AccountKind>(ACCOUNT_KINDS);

export function isValidAccountKind(value: unknown): value is AccountKind {
  return typeof value === 'string' && VALID_ACCOUNT_KINDS.has(value);
}

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

export function validateAccountInput(acc: {
  id: unknown;
  name: unknown;
  kind: unknown;
  provider?: unknown;
  colorKey: unknown;
  monogram?: unknown;
  last4?: unknown;
  openingBalanceMinor?: unknown;
  openingDate: unknown;
}): ValidationResult {
  const errors: string[] = [];

  if (typeof acc.id !== 'string' || acc.id.trim().length === 0) {
    errors.push('invalid_account_id');
  }
  if (typeof acc.name !== 'string' || acc.name.trim().length === 0) {
    errors.push('invalid_account_name');
  } else if (acc.name.trim().length > MAX_ACCOUNT_NAME_LENGTH) {
    errors.push('account_name_too_long');
  }
  if (!isValidAccountKind(acc.kind)) {
    errors.push('invalid_account_kind');
  }
  if (
    acc.provider !== undefined &&
    acc.provider !== null &&
    (typeof acc.provider !== 'string' || acc.provider.trim().length === 0)
  ) {
    errors.push('invalid_account_provider');
  }
  if (
    typeof acc.colorKey !== 'string' ||
    acc.colorKey.trim().length === 0 ||
    acc.colorKey.trim().length > MAX_ACCOUNT_COLOR_KEY_LENGTH
  ) {
    errors.push('invalid_account_color');
  }
  if (
    acc.monogram !== undefined &&
    acc.monogram !== null &&
    (typeof acc.monogram !== 'string' || acc.monogram.trim().length > MAX_MONOGRAM_LENGTH)
  ) {
    errors.push('invalid_monogram');
  }
  if (
    acc.last4 !== undefined &&
    acc.last4 !== null &&
    (typeof acc.last4 !== 'string' || !/^\d{4}$/.test(acc.last4))
  ) {
    errors.push('invalid_last4');
  }
  const openingBal = acc.openingBalanceMinor ?? 0;
  if (
    typeof openingBal !== 'number' ||
    !Number.isInteger(openingBal) ||
    openingBal < -MAX_AMOUNT_MINOR ||
    openingBal > MAX_AMOUNT_MINOR
  ) {
    errors.push('invalid_opening_balance');
  }
  if (typeof acc.openingDate !== 'string' || !isValidLocalDate(acc.openingDate)) {
    errors.push('invalid_opening_date');
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidAccountInput(acc: Parameters<typeof validateAccountInput>[0]): void {
  const res = validateAccountInput(acc);
  if (!res.valid) {
    throw new Error(`Invalid account: ${res.errors.join(', ')}`);
  }
}

export function validateNewTransfer(tr: {
  id: unknown;
  fromAccountId: unknown;
  toAccountId: unknown;
  amountMinor: unknown;
  feeMinor?: unknown;
  occurredOn: unknown;
  occurredTime?: unknown;
  note?: unknown;
}): ValidationResult {
  const errors: string[] = [];

  if (typeof tr.id !== 'string' || tr.id.trim().length === 0) {
    errors.push('invalid_transfer_id');
  }
  const hasFrom = typeof tr.fromAccountId === 'string' && tr.fromAccountId.trim().length > 0;
  const hasTo = typeof tr.toAccountId === 'string' && tr.toAccountId.trim().length > 0;
  if (!hasFrom) {
    errors.push('invalid_from_account');
  }
  if (!hasTo) {
    errors.push('invalid_to_account');
  }
  if (hasFrom && hasTo && tr.fromAccountId === tr.toAccountId) {
    errors.push('same_account');
  }
  if (
    typeof tr.amountMinor !== 'number' ||
    !Number.isInteger(tr.amountMinor) ||
    tr.amountMinor <= 0 ||
    tr.amountMinor > MAX_AMOUNT_MINOR
  ) {
    errors.push('invalid_amount');
  }
  const feeMinor = tr.feeMinor ?? 0;
  if (
    typeof feeMinor !== 'number' ||
    !Number.isInteger(feeMinor) ||
    feeMinor < 0 ||
    feeMinor > MAX_AMOUNT_MINOR
  ) {
    errors.push('invalid_fee');
  }
  if (typeof tr.occurredOn !== 'string' || !isValidLocalDate(tr.occurredOn)) {
    errors.push('invalid_date');
  }
  if (
    tr.occurredTime !== undefined &&
    tr.occurredTime !== null &&
    (typeof tr.occurredTime !== 'string' || !isValidLocalTime(tr.occurredTime))
  ) {
    errors.push('invalid_time');
  }
  if (tr.note !== undefined && tr.note !== null) {
    if (typeof tr.note !== 'string' || tr.note.length > MAX_NOTE_LENGTH) {
      errors.push('note_too_long');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidNewTransfer(tr: Parameters<typeof validateNewTransfer>[0]): void {
  const res = validateNewTransfer(tr);
  if (!res.valid) {
    throw new Error(`Invalid transfer: ${res.errors.join(', ')}`);
  }
}
