import { MAX_AMOUNT_MINOR } from './money';
import type {
  Account,
  Category,
  CurrencyCode,
  DailyWage,
  DailyWageLast,
  LocalDate,
  NewTransaction,
  Transaction,
} from './types';

/** Old builds hid two invisible separator characters (U+2063) in a wage entry's note. */
const LEGACY_INVISIBLE_SEPARATOR = /⁣/g;

/**
 * Removes the invisible separator characters an old build wrote into wage entry notes. Apply it
 * wherever a note is read into an editor or copied, so existing entries clean themselves up the
 * next time they are saved. No migration is needed.
 */
export function stripInvisibleNoteMarks(note: string): string {
  return note.replace(LEGACY_INVISIBLE_SEPARATOR, '');
}

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

/**
 * The pointer cut down to what is still true: only for `today`, and only the ids whose entry (from
 * `found`, the entries looked up for those ids) exists, is not deleted and is still dated today.
 * Null when nothing is left.
 */
export function pruneWageLast(
  last: DailyWageLast | null,
  found: readonly (Transaction | null)[],
  today: LocalDate
): DailyWageLast | null {
  if (last === null || last.day !== today) return null;
  const live = new Set(
    found
      .filter((tx): tx is Transaction => tx !== null && tx.deletedAt == null && tx.occurredOn === today)
      .map((tx) => tx.id)
  );
  const ids = last.ids.filter((id) => live.has(id));
  return ids.length === 0 ? null : { day: today, ids };
}

/**
 * True when today's wage is recorded: ANY id in the pointer is a live entry still dated today.
 * Deleting or moving some of them does not matter while one is left.
 */
export function isWageRecordedToday(
  last: DailyWageLast | null,
  found: readonly (Transaction | null)[],
  today: LocalDate
): boolean {
  return pruneWageLast(last, found, today) !== null;
}

/** The pointer with a new entry appended. A pointer for another day starts over for `day`. */
export function addWageId(last: DailyWageLast | null, id: string, day: LocalDate): DailyWageLast {
  const ids = last !== null && last.day === day ? last.ids.filter((x) => x !== id) : [];
  return { day, ids: [...ids, id] };
}

/** The pointer without exactly this id, or null when none is left. */
export function removeWageId(last: DailyWageLast | null, id: string): DailyWageLast | null {
  if (last === null) return null;
  const ids = last.ids.filter((x) => x !== id);
  return ids.length === 0 ? null : { day: last.day, ids };
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
    note: '',
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
