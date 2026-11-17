import {
  MAX_PINNED_AMOUNTS,
  type PinnedAmounts,
  type Transaction,
  type TransactionType,
} from './types';

export const MAX_REPEAT_ENTRIES = 3;

export interface RepeatEntryOptions {
  limit?: number;
  /** Descriptions that mark an automatic balance adjustment (all languages). */
  adjustmentDescriptions?: readonly string[];
}

function newestFirst(a: Transaction, b: Transaction): number {
  if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? 1 : -1;
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * The most recent distinct entries a person may want to repeat. Distinct means a different
 * type, amount, category and wallet. Deleted rows, transfer legs and balance adjustments are skipped.
 */
export function recentDistinctEntries(
  transactions: readonly Transaction[],
  options: RepeatEntryOptions = {}
): Transaction[] {
  const limit = options.limit ?? MAX_REPEAT_ENTRIES;
  const adjustments = options.adjustmentDescriptions ?? [];
  const seen = new Set<string>();
  const out: Transaction[] = [];
  for (const tx of [...transactions].sort(newestFirst)) {
    if (out.length >= limit) break;
    if (tx.deletedAt != null || tx.transferId || !tx.categoryId || tx.amountMinor <= 0) continue;
    if (tx.occurredTime === null && adjustments.includes(tx.description)) continue;
    const key = `${tx.type}|${tx.amountMinor}|${tx.categoryId}|${tx.accountId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tx);
  }
  return out;
}

export function canPinAmount(
  pinned: PinnedAmounts,
  type: TransactionType,
  amountMinor: number | null
): boolean {
  return (
    amountMinor !== null &&
    Number.isSafeInteger(amountMinor) &&
    amountMinor > 0 &&
    pinned[type].length < MAX_PINNED_AMOUNTS &&
    !pinned[type].includes(amountMinor)
  );
}

export function pinAmount(
  pinned: PinnedAmounts,
  type: TransactionType,
  amountMinor: number
): PinnedAmounts {
  if (!canPinAmount(pinned, type, amountMinor)) return pinned;
  return { ...pinned, [type]: [...pinned[type], amountMinor] };
}

export function unpinAmount(
  pinned: PinnedAmounts,
  type: TransactionType,
  amountMinor: number
): PinnedAmounts {
  return { ...pinned, [type]: pinned[type].filter((a) => a !== amountMinor) };
}
