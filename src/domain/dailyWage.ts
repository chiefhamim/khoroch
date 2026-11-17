import { MAX_AMOUNT_MINOR } from './money';
import type {
  Account,
  Category,
  CurrencyCode,
  DailyWage,
  LocalDate,
  NewTransaction,
  Transaction,
} from './types';

/**
 * Marks an entry made by the "Worked today" button. The source column only allows a fixed list, so
 * the entry uses the allowed source 'quick' and this marker at the start of its note. Two invisible
 * separator characters (U+2063): they carry no words, so they need no translation, they do not show
 * in the note box, and String.trim keeps them. Editing the amount, category, wallet or description
 * leaves the marker alone; only clearing the note removes it.
 */
export const WAGE_NOTE_MARKER = '⁣⁣';

export type DailyWageProblem = 'amount' | 'category';

export function isValidWageAmount(amountMinor: number | null): amountMinor is number {
  return (
    amountMinor !== null &&
    Number.isSafeInteger(amountMinor) &&
    amountMinor > 0 &&
    amountMinor <= MAX_AMOUNT_MINOR
  );
}

/** Why a daily wage cannot be saved, or null when it is fine. */
export function dailyWageProblem(wage: {
  amountMinor: number | null;
  categoryId: string | null;
}): DailyWageProblem | null {
  if (!isValidWageAmount(wage.amountMinor)) return 'amount';
  if (!wage.categoryId || wage.categoryId.trim().length === 0) return 'category';
  return null;
}

export function isWageEntry(tx: Transaction): boolean {
  return (
    tx.deletedAt == null &&
    tx.type === 'income' &&
    !tx.transferId &&
    tx.source === 'quick' &&
    tx.note.startsWith(WAGE_NOTE_MARKER)
  );
}

/**
 * True when a live wage entry exists on the given local calendar day. Days are compared as local
 * dates, so an entry at 23:59 belongs to its own day and not the next. Deleted entries are ignored;
 * an entry the person edited still counts while its marker is intact.
 */
export function hasWageRecordedOn(
  transactions: readonly Transaction[],
  day: LocalDate
): boolean {
  return transactions.some((tx) => tx.occurredOn === day && isWageEntry(tx));
}

export function buildWageEntry(input: {
  id: string;
  wage: DailyWage;
  categoryName: string;
  currency: CurrencyCode;
  day: LocalDate;
  time: string;
}): NewTransaction {
  return {
    id: input.id,
    type: 'income',
    amountMinor: input.wage.amountMinor,
    currency: input.currency,
    categoryId: input.wage.categoryId,
    accountId: input.wage.accountId,
    description: input.categoryName,
    note: WAGE_NOTE_MARKER,
    occurredOn: input.day,
    occurredTime: input.time,
    source: 'quick',
  };
}

function mostUsed(ids: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  // Ids arrive newest first, so on a tie the more recent one wins (Map keeps insertion order).
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Starting choices for a new daily wage: the most used income category and wallet in the history
 * given (newest first). Falls back to the first active income category and the first active wallet.
 */
export function defaultWageChoices(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  accounts: readonly Account[]
): { categoryId: string | null; accountId: string | null } {
  const activeCategories = categories
    .filter((c) => c.kind === 'income' && c.archivedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const activeAccounts = accounts.filter((a) => a.archivedAt == null);
  const categoryIds = new Set(activeCategories.map((c) => c.id));
  const accountIds = new Set(activeAccounts.map((a) => a.id));
  const income = transactions.filter(
    (tx) => tx.deletedAt == null && tx.type === 'income' && !tx.transferId
  );
  const categoryId =
    mostUsed(
      income.map((tx) => tx.categoryId).filter((id): id is string => !!id && categoryIds.has(id))
    ) ??
    activeCategories[0]?.id ??
    null;
  const accountId =
    mostUsed(
      income.map((tx) => tx.accountId).filter((id): id is string => !!id && accountIds.has(id))
    ) ??
    activeAccounts[0]?.id ??
    null;
  return { categoryId, accountId };
}
