import { addDays } from '@/domain/dates';
import type { PendingDraft, Transaction, Transfer } from '@/domain/types';

/** Draft fields the safety checks look at. */
export type DraftCheckInput = Pick<
  PendingDraft,
  'id' | 'type' | 'amountMinor' | 'accountId' | 'categoryId' | 'occurredOn' | 'trxId' | 'source'
> &
  Partial<Pick<PendingDraft, 'description'>>;

/** Saved-entry fields the duplicate check looks at. */
export type SavedEntryCheckInput = Pick<
  Transaction,
  'type' | 'amountMinor' | 'accountId' | 'occurredOn' | 'note' | 'deletedAt'
>;

/** Saved-transfer fields the duplicate check looks at. */
export type SavedTransferCheckInput = Pick<
  Transfer,
  'fromAccountId' | 'toAccountId' | 'amountMinor' | 'occurredOn' | 'deletedAt'
>;

/** A real transaction id (as opposed to a "Ref ..." or "Card **1234" display reference). */
const REAL_TRX_ID_RE = /^[A-Z0-9]{5,24}$/;

/** Older drafts carried an invented BDT amount and a trailing "(USD n.nn)" marker in the description. */
const FOREIGN_ESTIMATE_MARKER_RE = /\s*\(USD\s*\d[\d,]*(?:\.\d+)?\)\s*$/i;

/** True when the description ends with the "(USD n.nn)" marker: the BDT amount was made up. */
export function hasForeignEstimateMarker(description: string | null | undefined): boolean {
  return description != null && FOREIGN_ESTIMATE_MARKER_RE.test(description);
}

/** The description without the "(USD n.nn)" marker. */
export function stripForeignEstimateMarker(description: string): string {
  return description.replace(FOREIGN_ESTIMATE_MARKER_RE, '').trim();
}

function savedNoteTrxId(note: string): string | null {
  const m = /\bTrxID:\s*([A-Za-z0-9]+)/.exec(note);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Ids of drafts that look like an entry the user already saved.
 * A saved (non-deleted) entry matches when its note carries the same `TrxID: X`, or when it has the
 * same type, amount and wallet (wallet only when the draft's wallet is known) on the draft's day or the
 * day before or after. A saved transfer matches on amount and day, with either of its wallets equal to
 * the draft's wallet when that is known.
 * Pure: no clock, no storage. Built from a keyed map once, not a scan per draft.
 */
export function findLikelyDuplicateDraftIds(
  drafts: readonly DraftCheckInput[],
  saved: readonly SavedEntryCheckInput[],
  transfers: readonly SavedTransferCheckInput[] = []
): Set<string> {
  const out = new Set<string>();
  const savedTrxIds = new Set<string>();
  const entryIndex = new Map<string, (string | null)[]>();
  for (const s of saved) {
    if (s.deletedAt != null) continue;
    const id = savedNoteTrxId(s.note);
    if (id) savedTrxIds.add(id);
    const key = `${s.type}|${s.amountMinor}|${s.occurredOn}`;
    const list = entryIndex.get(key);
    if (list) list.push(s.accountId);
    else entryIndex.set(key, [s.accountId]);
  }
  const transferIndex = new Map<string, { from: string; to: string }[]>();
  for (const tr of transfers) {
    if (tr.deletedAt != null) continue;
    const key = `${tr.amountMinor}|${tr.occurredOn}`;
    const entry = { from: tr.fromAccountId, to: tr.toAccountId };
    const list = transferIndex.get(key);
    if (list) list.push(entry);
    else transferIndex.set(key, [entry]);
  }

  for (const d of drafts) {
    if (d.trxId && REAL_TRX_ID_RE.test(d.trxId) && savedTrxIds.has(d.trxId.toUpperCase())) {
      out.add(d.id);
      continue;
    }
    const days = [addDays(d.occurredOn, -1), d.occurredOn, addDays(d.occurredOn, 1)];
    let hit = false;
    for (const day of days) {
      const wallets = entryIndex.get(`${d.type}|${d.amountMinor}|${day}`);
      if (wallets && (d.accountId == null || wallets.includes(d.accountId))) {
        hit = true;
        break;
      }
      const moves = transferIndex.get(`${d.amountMinor}|${day}`);
      if (moves && (d.accountId == null || moves.some((m) => m.from === d.accountId || m.to === d.accountId))) {
        hit = true;
        break;
      }
    }
    if (hit) out.add(d.id);
  }
  return out;
}

/** What still stops a draft from being saved. A wallet or category that no longer exists counts as none. */
export interface DraftBlockers {
  wallet: boolean;
  category: boolean;
  /** The amount was estimated from a foreign currency and has not been confirmed. */
  amount: boolean;
}

export function draftBlockers(
  draft: Pick<DraftCheckInput, 'accountId' | 'categoryId' | 'description'>,
  liveWalletIds: ReadonlySet<string>,
  liveCategoryIds: ReadonlySet<string>
): DraftBlockers {
  return {
    wallet: draft.accountId == null || !liveWalletIds.has(draft.accountId),
    category: draft.categoryId == null || !liveCategoryIds.has(draft.categoryId),
    amount: hasForeignEstimateMarker(draft.description),
  };
}

/**
 * A draft can be saved only with a live wallet, a live category, a confirmed amount and a positive amount.
 * No silent default wallet or category.
 */
export function canApproveDraft(
  draft: Pick<DraftCheckInput, 'accountId' | 'categoryId' | 'amountMinor' | 'description'>,
  liveWalletIds: ReadonlySet<string>,
  liveCategoryIds: ReadonlySet<string>
): boolean {
  const b = draftBlockers(draft, liveWalletIds, liveCategoryIds);
  return !b.wallet && !b.category && !b.amount && draft.amountMinor > 0;
}

/**
 * "Approve all" is limited to drafts that are high confidence (a real transaction id, not a scanned
 * receipt) with a live wallet and category, and that are not flagged as a likely duplicate.
 * A draft whose amount needs checking is never included (canApproveDraft refuses it).
 */
export function isBulkApprovable(
  draft: DraftCheckInput,
  duplicateIds: ReadonlySet<string>,
  liveWalletIds: ReadonlySet<string>,
  liveCategoryIds: ReadonlySet<string>
): boolean {
  return (
    canApproveDraft(draft, liveWalletIds, liveCategoryIds) &&
    draft.source !== 'ocr_receipt' &&
    draft.trxId != null &&
    REAL_TRX_ID_RE.test(draft.trxId) &&
    !duplicateIds.has(draft.id)
  );
}
