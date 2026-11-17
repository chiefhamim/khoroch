/**
 * Tags an error raised after the data was already wiped (reminders or secure-store cleanup failed),
 * so the screen can say that the data is gone and the lock needs another try.
 */
export function markErasedThenFailed(e: unknown): Error {
  const err = e instanceof Error ? e : new Error('erase cleanup failed');
  (err as Error & { dataErased?: boolean }).dataErased = true;
  return err;
}

/** True when an error from the erase flow happened after the data had already been wiped. */
export function isErasedThenFailed(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { dataErased?: unknown }).dataErased === true;
}
