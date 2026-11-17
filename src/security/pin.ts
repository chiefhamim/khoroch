/**
 * Pure PIN logic: validation, salted iterated SHA-256, constant-time compare,
 * failed-attempt back-off and the background-timeout decision.
 * No native imports here: the digest function is injected so tests can mock it.
 */

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

/**
 * Iterated SHA-256 rounds. Every round is one awaited native digest call, so the JS thread
 * yields between rounds and is never blocked. Stored next to the hash so it can be raised later.
 */
export const DEFAULT_PIN_ITERATIONS = 2000;

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
