/* eslint-disable @typescript-eslint/no-require-imports -- lazy require so a missing native module cannot crash startup */
import { Platform } from 'react-native';
import {
  DEFAULT_PIN_ITERATIONS,
  LOCKOUT_FREE_ATTEMPTS,
  hashPin,
  isValidPinFormat,
  lockoutRemainingMs,
  lockoutSecondsFor,
  monotonicMs,
  remainingLockoutSec,
  verifyPin,
  type DigestFn,
} from './pin';

/**
 * PIN credential and failed-attempt state. Everything lives in the platform secure store
 * (Android Keystore backed), never in SQLite, backups or exports.
 *
 * Reads distinguish "the read worked and found nothing" (null) from "the read failed" (throws).
 * Callers must never treat a failed read as "no lock".
 */

export interface StoreAuthOptions {
  /** Ask for a fingerprint or face before the value is read or written. */
  prompt: string;
}

export interface KeyValueStore {
  /** Resolves null only when the read worked and nothing is stored. Rejects when the read failed. */
  get(key: string, auth?: StoreAuthOptions): Promise<string | null>;
  set(key: string, value: string, auth?: StoreAuthOptions): Promise<void>;
  remove(key: string): Promise<void>;
}

export const CREDENTIAL_KEY = 'khoroch_lock_credential';
export const ATTEMPTS_KEY = 'khoroch_lock_attempts';
/** Plain flag: the user chose fingerprint or face unlock. The secret below is the real gate. */
export const BIOMETRIC_KEY = 'khoroch_lock_biometric';
/** Random secret stored with authentication required (strong biometric, key dies on new enrollment). */
export const BIOMETRIC_SECRET_KEY = 'khoroch_lock_biometric_secret';

interface CredentialRecord {
  v: 1;
  saltHex: string;
  iterations: number;
  hashHex: string;
}

export type CredentialState = 'present' | 'absent' | 'error';

export type CheckPinResult =
  | { status: 'ok' }
  | { status: 'invalid' }
  | { status: 'error' }
  | { status: 'locked'; remainingSec: number }
  | { status: 'wrong'; failed: number; attemptsLeft: number; lockedSec: number };

export type BiometricUnlockResult = 'ok' | 'cancelled' | 'invalidated' | 'off' | 'error';

export interface AppLockDeps {
  store: KeyValueStore;
  digest: DigestFn;
  randomHex: (bytes: number) => string;
  /** Wall clock. Only used across an app restart, and to detect a clock moved backwards. */
  now: () => number;
  /** Monotonic clock. Counts every wait inside a running session. */
  mono?: () => number;
  iterations?: number;
}

interface AttemptState {
  failed: number;
  lastAttemptAtMs: number;
  waitSec: number;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function createAppLock(deps: AppLockDeps) {
  const { store, digest, randomHex, now } = deps;
  const mono = deps.mono ?? monotonicMs;
  const iterations = deps.iterations ?? DEFAULT_PIN_ITERATIONS;

  /**
   * Monotonic reference for the wait in this session. While it matches the stored attempt, the
   * wait is counted from it and the device clock is ignored (so moving the clock forward does
   * nothing). Across an app restart there is no monotonic reference, only wall time: a clock
   * moved forward before a restart can still shorten a wait. That gap cannot be closed in JS.
   */
  let anchor: {
    lastAttemptAtMs: number;
    waitSec: number;
    monoAtMs: number;
    remainingMs: number;
  } | null = null;

  async function readCredential(): Promise<
    { kind: 'present'; rec: CredentialRecord } | { kind: 'absent' } | { kind: 'corrupt' }
  > {
    const raw = await store.get(CREDENTIAL_KEY); // throws on a failed read
    if (raw === null || raw === '') return { kind: 'absent' };
    const rec = parseJson<CredentialRecord>(raw);
    if (
      !rec ||
      typeof rec.saltHex !== 'string' ||
      typeof rec.hashHex !== 'string' ||
      !Number.isInteger(rec.iterations) ||
      rec.iterations < 1
    ) {
      return { kind: 'corrupt' };
    }
    return { kind: 'present', rec };
  }

  /** Throws on a failed read. A missing value is a clean slate (no failed attempts). */
  async function readAttempts(): Promise<AttemptState> {
    const raw = parseJson<{
      failed?: unknown;
      lastAttemptAtMs?: unknown;
      waitSec?: unknown;
      lockedUntilMs?: unknown;
    }>(await store.get(ATTEMPTS_KEY));
    const failed =
      raw && typeof raw.failed === 'number' && Number.isInteger(raw.failed) && raw.failed > 0
        ? raw.failed
        : 0;
    if (raw && isFiniteNumber(raw.lastAttemptAtMs) && isFiniteNumber(raw.waitSec)) {
      return { failed, lastAttemptAtMs: raw.lastAttemptAtMs, waitSec: Math.max(0, raw.waitSec) };
    }
    if (raw && isFiniteNumber(raw.lockedUntilMs) && raw.lockedUntilMs > 0) {
      // Older format (a wall-clock deadline): treat what is left as a wait starting now.
      const at = now();
      return { failed, lastAttemptAtMs: at, waitSec: remainingLockoutSec(raw.lockedUntilMs, at) };
    }
    return { failed, lastAttemptAtMs: 0, waitSec: 0 };
  }

  async function writeAttempts(state: AttemptState): Promise<void> {
    await store.set(ATTEMPTS_KEY, JSON.stringify(state));
  }

  /** Remaining wait in ms, counted monotonically inside the session. */
  async function remainingWaitMs(state: AttemptState): Promise<number> {
    if (state.waitSec <= 0) {
      anchor = null;
      return 0;
    }
    const monoNow = mono();
    if (
      anchor &&
      anchor.lastAttemptAtMs === state.lastAttemptAtMs &&
      anchor.waitSec === state.waitSec
    ) {
      return Math.max(0, anchor.remainingMs - (monoNow - anchor.monoAtMs));
    }
    // First look at this wait in this session: only wall time exists.
    const wall = lockoutRemainingMs(state, now());
    let last = state.lastAttemptAtMs;
    if (wall.restarted) {
      last = now();
      try {
        await writeAttempts({ ...state, lastAttemptAtMs: last });
      } catch {
        // the in-memory reference below still enforces the restarted wait
      }
    }
    anchor = {
      lastAttemptAtMs: last,
      waitSec: state.waitSec,
      monoAtMs: monoNow,
      remainingMs: wall.remainingMs,
    };
    return wall.remainingMs;
  }

  async function removeQuietly(key: string): Promise<void> {
    try {
      await store.remove(key);
    } catch {
      // best effort
    }
  }

  return {
    /** Never throws. 'error' means the read failed and the lock must stay closed. */
    async credentialState(): Promise<CredentialState> {
      try {
        const res = await readCredential();
        if (res.kind === 'present') return 'present';
        return res.kind === 'absent' ? 'absent' : 'error';
      } catch {
        return 'error';
      }
    },

    /** True when a credential exists. Throws when the read failed; use credentialState to avoid that. */
    async hasCredential(): Promise<boolean> {
      return (await readCredential()).kind === 'present';
    },

    /** Stores a new salted hash with a fresh random salt and clears the attempt counter. */
    async setPin(pin: string): Promise<void> {
      if (!isValidPinFormat(pin)) throw new Error('Invalid PIN format.');
      const saltHex = randomHex(16);
      const hashHex = await hashPin(pin, saltHex, iterations, digest);
      const rec: CredentialRecord = { v: 1, saltHex, iterations, hashHex };
      await store.set(CREDENTIAL_KEY, JSON.stringify(rec));
      anchor = null;
      await store.remove(ATTEMPTS_KEY);
    },

    /** Removes everything. Rejects if the credential could not be removed, so callers can tell. */
    async clearAll(): Promise<void> {
      anchor = null;
      await store.remove(CREDENTIAL_KEY);
      await store.remove(ATTEMPTS_KEY);
      await store.remove(BIOMETRIC_KEY);
      await store.remove(BIOMETRIC_SECRET_KEY);
    },

    /** Seconds left on the wrong-PIN wait. 0 when none, or when the state cannot be read. */
    async getLockoutRemainingSec(): Promise<number> {
      try {
        const ms = await remainingWaitMs(await readAttempts());
        return ms > 0 ? Math.ceil(ms / 1000) : 0;
      } catch {
        return 0;
      }
    },

    /**
     * Counts the attempt before verifying, so killing the app mid-check cannot dodge it.
     * A failed storage read or write never counts as success and never resets the counter.
     */
    async checkPin(pin: string): Promise<CheckPinResult> {
      let attempts: AttemptState;
      try {
        attempts = await readAttempts();
      } catch {
        return { status: 'error' };
      }
      const waitMs = await remainingWaitMs(attempts);
      if (waitMs > 0) return { status: 'locked', remainingSec: Math.ceil(waitMs / 1000) };
      if (!isValidPinFormat(pin)) return { status: 'invalid' };

      let cred: Awaited<ReturnType<typeof readCredential>>;
      try {
        cred = await readCredential();
      } catch {
        return { status: 'error' };
      }
      if (cred.kind === 'corrupt') return { status: 'error' };
      if (cred.kind === 'absent') return { status: 'invalid' };
      const rec = cred.rec;

      const failedNow = attempts.failed + 1;
      const lockSec = lockoutSecondsFor(failedNow);
      const at = now();
      try {
        await writeAttempts({ failed: failedNow, lastAttemptAtMs: at, waitSec: lockSec });
      } catch {
        return { status: 'error' }; // cannot count the attempt, so do not check the PIN
      }

      const ok = await verifyPin(pin, rec, digest);
      if (ok) {
        anchor = null;
        await removeQuietly(ATTEMPTS_KEY);
        if (rec.iterations !== iterations) {
          // Move old hashes to the current round count. Best effort: a failure here must not
          // block the unlock, and the old record stays valid.
          try {
            const saltHex = randomHex(16);
            const hashHex = await hashPin(pin, saltHex, iterations, digest);
            const next: CredentialRecord = { v: 1, saltHex, iterations, hashHex };
            await store.set(CREDENTIAL_KEY, JSON.stringify(next));
          } catch {
            // keep the old record
          }
        }
        return { status: 'ok' };
      }
      if (lockSec > 0) {
        anchor = {
          lastAttemptAtMs: at,
          waitSec: lockSec,
          monoAtMs: mono(),
          remainingMs: lockSec * 1000,
        };
      }
      return {
        status: 'wrong',
        failed: failedNow,
        attemptsLeft: Math.max(0, LOCKOUT_FREE_ATTEMPTS - failedNow),
        lockedSec: lockSec,
      };
    },

    /** Called after a successful biometric unlock. */
    async resetAttempts(): Promise<void> {
      anchor = null;
      await removeQuietly(ATTEMPTS_KEY);
    },

    /** The stored preference. A failed read counts as off (the PIN always works). */
    async getBiometricEnabled(): Promise<boolean> {
      try {
        return (await store.get(BIOMETRIC_KEY)) === '1';
      } catch {
        return false;
      }
    },

    /**
     * Turns fingerprint or face unlock on: stores a random secret that can only be read after a
     * strong biometric match, and that the system destroys when a new fingerprint or face is
     * enrolled. Returns false (and stays off) when the prompt is cancelled or fails.
     */
    async enableBiometric(prompt: string): Promise<boolean> {
      try {
        await store.set(BIOMETRIC_SECRET_KEY, randomHex(32), { prompt });
        await store.set(BIOMETRIC_KEY, '1');
        return true;
      } catch {
        await removeQuietly(BIOMETRIC_KEY);
        await removeQuietly(BIOMETRIC_SECRET_KEY);
        return false;
      }
    },

    async disableBiometric(): Promise<void> {
      await store.remove(BIOMETRIC_KEY);
      await store.remove(BIOMETRIC_SECRET_KEY);
    },

    /**
     * Unlock by reading the biometric-protected secret. Re-checks the stored preference first and
     * stops when it is off. 'invalidated' means the phone's fingerprints or face changed (or the
     * secret is gone): biometric unlock has been turned off and the PIN is required.
     */
    async biometricUnlock(prompt: string): Promise<BiometricUnlockResult> {
      let pref: string | null;
      try {
        pref = await store.get(BIOMETRIC_KEY);
      } catch {
        return 'error';
      }
      if (pref !== '1') return 'off';

      const invalidate = async (): Promise<BiometricUnlockResult> => {
        await removeQuietly(BIOMETRIC_KEY);
        await removeQuietly(BIOMETRIC_SECRET_KEY);
        return 'invalidated';
      };

      let secret: string | null;
      try {
        secret = await store.get(BIOMETRIC_SECRET_KEY, { prompt });
      } catch (e) {
        // Cancel, lockout, timeout: the user can retry or type the PIN. Nothing enrolled any more
        // means the earlier fingerprints are gone.
        const message = e instanceof Error ? e.message : '';
        return /enrolled/i.test(message) ? invalidate() : 'cancelled';
      }
      if (typeof secret !== 'string' || secret.length < 32) return invalidate();
      await removeQuietly(ATTEMPTS_KEY);
      anchor = null;
      return 'ok';
    },
  };
}

// Native wiring (lazy and guarded: a missing native module means "not supported").

type SecureStoreModule = typeof import('expo-secure-store');

function loadSecureStore(): SecureStoreModule | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    return require('expo-secure-store') as SecureStoreModule;
  } catch {
    return null;
  }
}

let supportedCache: boolean | null = null;

/**
 * True when the platform secure store should work here. Never throws. A missing module (web, or a
 * build without it) is "not supported". A module that exists but errors is treated as supported,
 * so the failed read keeps the app locked instead of silently opening it.
 */
export async function isAppLockSupported(): Promise<boolean> {
  if (supportedCache !== null) return supportedCache;
  const mod = loadSecureStore();
  if (!mod) {
    supportedCache = false;
    return false;
  }
  try {
    supportedCache = Boolean(await mod.isAvailableAsync());
    return supportedCache;
  } catch {
    return true;
  }
}

function authOptions(auth?: StoreAuthOptions) {
  return auth
    ? {
        requireAuthentication: true,
        authenticationPrompt: auth.prompt,
        requireConfirmation: false,
      }
    : undefined;
}

const nativeStore: KeyValueStore = {
  async get(key, auth) {
    const mod = loadSecureStore();
    if (!mod) throw new Error('Secure storage unavailable.');
    return mod.getItemAsync(key, authOptions(auth));
  },
  async set(key, value, auth) {
    const mod = loadSecureStore();
    if (!mod) throw new Error('Secure storage unavailable.');
    await mod.setItemAsync(key, value, authOptions(auth));
  },
  async remove(key) {
    const mod = loadSecureStore();
    if (!mod) throw new Error('Secure storage unavailable.');
    await mod.deleteItemAsync(key);
  },
};

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

export const appLock = createAppLock({
  store: nativeStore,
  digest: async (input) => {
    const Crypto = require('expo-crypto') as typeof import('expo-crypto');
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  },
  randomHex: (bytes) => {
    const Crypto = require('expo-crypto') as typeof import('expo-crypto');
    return toHex(Crypto.getRandomBytes(bytes));
  },
  now: () => Date.now(),
  mono: monotonicMs,
});
