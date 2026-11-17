/**
 * Pure PIN logic: validation, salted iterated SHA-256, constant-time compare,
 * failed-attempt back-off and the background-timeout decision.
 * No native imports here: the digest function is injected so tests can mock it.
 */

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

/**
 * Iterated SHA-256 rounds for new hashes. Every round is one awaited native digest call, so the
 * JS thread yields between rounds and is never blocked.
 *
 * Protection does NOT rest on this cost. A 4 to 6 digit PIN has at most 1,000,000 values, so no
 * hash cost could stop an offline search anyway. The real protection is (1) the hash lives in
 * Keystore-encrypted storage that other apps and a copied backup cannot read, and (2) the attempt
 * limit with growing waits. 100 rounds is about 10 to 50 ms on a slow phone, well under 100 ms.
 * The round count is stored next to each hash, so older 2,000-round hashes still verify and are
 * re-hashed with this count after a successful unlock.
 */
export const DEFAULT_PIN_ITERATIONS = 100;

export const LOCKOUT_FREE_ATTEMPTS = 5;
export const LOCKOUT_BASE_SEC = 30;
export const LOCKOUT_MAX_SEC = 3600;

export const TIMEOUT_CHOICES_SEC = [0, 60, 300, 900] as const;

export type DigestFn = (input: string) => Promise<string>;

export function isValidPinFormat(pin: string): boolean {
  return /^[0-9]+$/.test(pin) && pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH;
}

/** Constant-time string equality (length is not secret: hashes are fixed length). */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function hashPin(
  pin: string,
  saltHex: string,
  iterations: number,
  digest: DigestFn,
): Promise<string> {
  let h = await digest(`${saltHex}:${pin}`);
  for (let i = 1; i < iterations; i += 1) {
    h = await digest(`${h}:${saltHex}:${pin}`);
  }
  return h;
}

export async function verifyPin(
  pin: string,
  record: { saltHex: string; iterations: number; hashHex: string },
  digest: DigestFn,
): Promise<boolean> {
  if (!isValidPinFormat(pin)) return false;
  const candidate = await hashPin(pin, record.saltHex, record.iterations, digest);
  return constantTimeEqual(candidate, record.hashHex);
}

/** Seconds to wait after `failedCount` consecutive wrong PINs: 0 below 5, then 30, 60, 120, doubling. */
export function lockoutSecondsFor(failedCount: number): number {
  if (failedCount < LOCKOUT_FREE_ATTEMPTS) return 0;
  const doublings = failedCount - LOCKOUT_FREE_ATTEMPTS;
  if (doublings >= 12) return LOCKOUT_MAX_SEC;
  return Math.min(LOCKOUT_BASE_SEC * 2 ** doublings, LOCKOUT_MAX_SEC);
}

export function attemptsLeftBeforeLockout(failedCount: number): number {
  return Math.max(0, LOCKOUT_FREE_ATTEMPTS - failedCount);
}

/**
 * Whole seconds left on a lockout. A deadline further away than the maximum back-off can only
 * come from the clock being moved backwards, so it is clamped.
 */
export function remainingLockoutSec(lockedUntilMs: number, nowMs: number): number {
  if (!lockedUntilMs) return 0;
  const left = Math.ceil((lockedUntilMs - nowMs) / 1000);
  if (left <= 0) return 0;
  return Math.min(left, LOCKOUT_MAX_SEC);
}

/** Monotonic milliseconds (never moved by the device clock). Falls back to wall time without it. */
export function monotonicMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}

export interface LockoutWallState {
  /** Wall-clock time (ms) of the last wrong attempt that set the wait. */
  lastAttemptAtMs: number;
  /** Length of the wait in seconds (0 means no wait). */
  waitSec: number;
}

/**
 * Remaining wait in ms from wall time. Only for the first look at a wait after an app restart,
 * when no monotonic reference exists. Inside a running session the caller counts with a
 * monotonic timer instead and never calls this again.
 * Wall time earlier than the last attempt means the clock was moved back: the full wait restarts
 * from now (`restarted` true, so the caller can store the new start).
 */
export function lockoutRemainingMs(
  state: LockoutWallState,
  wallNowMs: number,
): { remainingMs: number; restarted: boolean } {
  const fullMs = Math.min(Math.max(state.waitSec, 0), LOCKOUT_MAX_SEC) * 1000;
  if (fullMs <= 0) return { remainingMs: 0, restarted: false };
  if (wallNowMs < state.lastAttemptAtMs) return { remainingMs: fullMs, restarted: true };
  const left = fullMs - (wallNowMs - state.lastAttemptAtMs);
  return { remainingMs: Math.min(Math.max(left, 0), fullMs), restarted: false };
}

/** True when returning to the app must show the lock. */
export function shouldLockAfterBackground(
  backgroundedAtMs: number | null,
  nowMs: number,
  timeoutSec: number,
): boolean {
  if (backgroundedAtMs === null) return true;
  if (timeoutSec <= 0) return true;
  const away = nowMs - backgroundedAtMs;
  if (away < 0) return true; // clock moved backwards: fail closed
  return away >= timeoutSec * 1000;
}
