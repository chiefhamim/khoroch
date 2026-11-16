import type { Repo } from '@/data/repo';
import { formatLocalDate, todayLocalDate } from '@/domain/dates';
import type { NewPendingDraft } from '@/domain/types';
import { bumpDataVersion } from '@/state/dataVersion';
import {
  consumePendingShare,
  drainCapturedNotifications,
  recognizeImageText,
} from './nativeCapture';
import { parseCaptureDocument, parseSingleCaptureMessage } from './parser';

export interface CaptureSyncResult {
  addedCount: number;
  sharedKind: 'text' | 'image' | null;
}

/**
 * Drains captured Android notifications and any pending Android Share intent (`text` or receipt `image`),
 * parses them into deduplicated pending drafts, inserts them into the repo, and bumps dataVersion.
 */
export async function syncDeviceCaptures(repo: Repo): Promise<CaptureSyncResult> {
  const [notifications, shared, accounts] = await Promise.all([
    drainCapturedNotifications(),
    consumePendingShare(),
    repo.listAccounts(),
  ]);

  const toInsert: NewPendingDraft[] = [];

  for (let i = 0; i < notifications.length; i += 1) {
    const n = notifications[i];
    const body = n.text.trim() || [n.title, n.text].filter(Boolean).join(' · ');
    const senderHint = [n.appName, n.title].filter(Boolean).join(' ');
    const d = new Date(n.postedAt || Date.now());
    const postedDate = formatLocalDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const draft = parseSingleCaptureMessage(
      body,
      'notification',
      { accounts, defaultDate: postedDate, senderHint },
      `cap_noti_${n.postedAt}_${i}`
    );
    if (draft) {
      toInsert.push(draft);
    }
  }

  let sharedKind: 'text' | 'image' | null = null;
  if (shared) {
    sharedKind = shared.kind;
    if (shared.kind === 'text') {
      const drafts = parseCaptureDocument(shared.value, 'share_text', {
        accounts,
        defaultDate: todayLocalDate(),
      });
      toInsert.push(...drafts);
    } else if (shared.kind === 'image') {
      try {
        const ocrText = await recognizeImageText(shared.value);
        if (ocrText.trim()) {
          const drafts = parseCaptureDocument(ocrText, 'ocr_receipt', {
            accounts,
            defaultDate: todayLocalDate(),
          });
          toInsert.push(...drafts);
        }
      } catch {
        // Leave cleanly without throwing if OCR fails on unreadable shared media.
      }
    }
  }

  if (toInsert.length === 0) {
    return { addedCount: 0, sharedKind };
  }

  const addedCount = await repo.upsertPendingDrafts(toInsert);
  if (addedCount > 0) {
    bumpDataVersion();
  }
  return { addedCount, sharedKind };
}
