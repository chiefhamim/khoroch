import type { PendingDraft, Transaction } from '@/domain/types';

/** Draft fields the safety checks look at. */
export type DraftCheckInput = Pick<
  PendingDraft,
  'id' | 'type' | 'amountMinor' | 'accountId' | 'categoryId' | 'occurredOn' | 'trxId' | 'source'
>;

/** Saved-entry fields the duplicate check looks at. */
export type SavedEntryCheckInput = Pick<
  Transaction,
  'type' | 'amountMinor' | 'accountId' | 'occurredOn' | 'note' | 'deletedAt'
>;

/** A real transaction id (as opposed to a "Ref ..." or "Card **1234" display reference). */
const REAL_TRX_ID_RE = /^[A-Z0-9]{5,24}$/;

function savedNoteTrxId(note: string): string | null {
  const m = /\bTrxID:\s*([A-Za-z0-9]+)/.exec(note);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Ids of drafts that look like an entry the user already saved.
 * A saved (non-deleted) entry matches when its note carries the same `TrxID: X`, or when it has the
 * same type, amount and day, and the same wallet whenever the draft's wallet is known.
 * Pure: no clock, no storage.
 */
export function findLikelyDuplicateDraftIds(
  drafts: readonly DraftCheckInput[],
  saved: readonly SavedEntryCheckInput[]
): Set<string> {
  const out = new Set<string>();
  const live = saved.filter((s) => s.deletedAt == null);
  const savedTrxIds = new Set<string>();
  for (const s of live) {
    const id = savedNoteTrxId(s.note);
    if (id) savedTrxIds.add(id);
  }
  for (const d of drafts) {
    if (d.trxId && REAL_TRX_ID_RE.test(d.trxId) && savedTrxIds.has(d.trxId.toUpperCase())) {
      out.add(d.id);
      continue;
    }
    const hit = live.some(
      (s) =>
        s.type === d.type &&
        s.amountMinor === d.amountMinor &&
        s.occurredOn === d.occurredOn &&
        (d.accountId == null || s.accountId === d.accountId)
    );
    if (hit) out.add(d.id);
  }
  return out;
}

/** A draft can be saved only with a chosen wallet and a positive amount. No silent default wallet. */
export function canApproveDraft(draft: Pick<DraftCheckInput, 'accountId' | 'amountMinor'>): boolean {
  return draft.accountId != null && draft.amountMinor > 0;
}

/**
 * "Approve all" is limited to drafts that are high confidence (a real transaction id, not a scanned
 * receipt) with a matched wallet and category, and that are not flagged as a likely duplicate.
 */
export function isBulkApprovable(draft: DraftCheckInput, duplicateIds: ReadonlySet<string>): boolean {
  return (
    canApproveDraft(draft) &&
    draft.categoryId != null &&
    draft.source !== 'ocr_receipt' &&
    draft.trxId != null &&
    REAL_TRX_ID_RE.test(draft.trxId) &&
    !duplicateIds.has(draft.id)
  );
}
