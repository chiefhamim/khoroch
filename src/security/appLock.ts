/* eslint-disable @typescript-eslint/no-require-imports -- lazy require so a missing native module cannot crash startup */
import { Platform } from 'react-native';
import {
  DEFAULT_PIN_ITERATIONS,
  LOCKOUT_FREE_ATTEMPTS,
  hashPin,
  isValidPinFormat,
  lockoutSecondsFor,
  remainingLockoutSec,
  verifyPin,
  type DigestFn,
} from './pin';

/**
 * PIN credential and failed-attempt state. Everything lives in the platform secure store
 * (Android Keystore backed), never in SQLite, backups or exports.
 */

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const CREDENTIAL_KEY = 'khoroch_lock_credential';
export const ATTEMPTS_KEY = 'khoroch_lock_attempts';
export const BIOMETRIC_KEY = 'khoroch_lock_biometric';

interface CredentialRecord {
  v: 1;
  saltHex: string;
  iterations: number;
  hashHex: string;
}

export type CheckPinResult =
  | { status: 'ok' }
  | { status: 'invalid' }
  | { status: 'locked'; remainingSec: number }
  | { status: 'wrong'; failed: number; attemptsLeft: number; lockedSec: number };

export interface AppLockDeps {
  store: KeyValueStore;
  digest: DigestFn;
  randomHex: (bytes: number) => string;
  now: () => number;
  iterations?: number;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function createAppLock(deps: AppLockDeps) {
  const { store, digest, randomHex, now } = deps;
  const iterations = deps.iterations ?? DEFAULT_PIN_ITERATIONS;

  async function readCredential(): Promise<CredentialRecord | null> {
    const rec = parseJson<CredentialRecord>(await store.get(CREDENTIAL_KEY));
    if (
      !rec ||
      typeof rec.saltHex !== 'string' ||
      typeof rec.hashHex !== 'string' ||
      !Number.isInteger(rec.iterations) ||
      rec.iterations < 1
    ) {
      return null;
    }
    return rec;
  }

  async function readAttempts(): Promise<{ failed: number; lockedUntilMs: number }> {
    const raw = parseJson<{ failed?: unknown; lockedUntilMs?: unknown }>(
      await store.get(ATTEMPTS_KEY),
    );
    const failed =
      raw && typeof raw.failed === 'number' && Number.isInteger(raw.failed) && raw.failed > 0
        ? raw.failed
        : 0;
    const lockedUntilMs =
      raw && typeof raw.lockedUntilMs === 'number' && Number.isFinite(raw.lockedUntilMs)
        ? raw.lockedUntilMs
        : 0;
    return { failed, lockedUntilMs };
  }

  async function writeAttempts(failed: number, lockedUntilMs: number): Promise<void> {
    await store.set(ATTEMPTS_KEY, JSON.stringify({ failed, lockedUntilMs }));
  }

  return {
    async hasCredential(): Promise<boolean> {
      return (await readCredential()) !== null;
    },

    /** Stores a new salted hash with a fresh random salt and clears the attempt counter. */
    async setPin(pin: string): Promise<void> {
      if (!isValidPinFormat(pin)) throw new Error('Invalid PIN format.');
      const saltHex = randomHex(16);
      const hashHex = await hashPin(pin, saltHex, iterations, digest);
      const rec: CredentialRecord = { v: 1, saltHex, iterations, hashHex };
      await store.set(CREDENTIAL_KEY, JSON.stringify(rec));
      await store.remove(ATTEMPTS_KEY);
    },

    async clearAll(): Promise<void> {
      await store.remove(CREDENTIAL_KEY);
      await store.remove(ATTEMPTS_KEY);
      await store.remove(BIOMETRIC_KEY);
    },

    async getLockoutRemainingSec(): Promise<number> {
      const { lockedUntilMs } = await readAttempts();
      return remainingLockoutSec(lockedUntilMs, now());
    },

    /** Counts the attempt before verifying, so killing the app mid-check cannot dodge it. */
    async checkPin(pin: string): Promise<CheckPinResult> {
      const attempts = await readAttempts();
      const waitSec = remainingLockoutSec(attempts.lockedUntilMs, now());
      if (waitSec > 0) return { status: 'locked', remainingSec: waitSec };
      if (!isValidPinFormat(pin)) return { status: 'invalid' };
      const rec = await readCredential();
      if (!rec) return { status: 'invalid' };

      const failedNow = attempts.failed + 1;
      const lockSec = lockoutSecondsFor(failedNow);
      await writeAttempts(failedNow, lockSec > 0 ? now() + lockSec * 1000 : 0);

      const ok = await verifyPin(pin, rec, digest);
      if (ok) {
        await store.remove(ATTEMPTS_KEY);
        return { status: 'ok' };
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
      await store.remove(ATTEMPTS_KEY);
    },

    async getBiometricEnabled(): Promise<boolean> {
      return (await store.get(BIOMETRIC_KEY)) === '1';
    },

    async setBiometricEnabled(on: boolean): Promise<void> {
      if (on) await store.set(BIOMETRIC_KEY, '1');
      else await store.remove(BIOMETRIC_KEY);
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

/** True only when the platform secure store really works. Never throws. */
export async function isAppLockSupported(): Promise<boolean> {
  if (supportedCache !== null) return supportedCache;
  const mod = loadSecureStore();
  if (!mod) {
    supportedCache = false;
    return false;
  }
  try {
    supportedCache = Boolean(await mod.isAvailableAsync());
  } catch {
    supportedCache = false;
  }
  return supportedCache;
}

const nativeStore: KeyValueStore = {
  async get(key) {
    const mod = loadSecureStore();
    if (!mod) return null;
    try {
      return await mod.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    const mod = loadSecureStore();
    if (!mod) throw new Error('Secure storage unavailable.');
    await mod.setItemAsync(key, value);
  },
  async remove(key) {
    const mod = loadSecureStore();
    if (!mod) return;
    try {
      await mod.deleteItemAsync(key);
    } catch {
      // nothing stored
    }
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
});
