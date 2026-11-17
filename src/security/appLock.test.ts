import { createHash } from 'crypto';
import {
  ATTEMPTS_KEY,
  BIOMETRIC_KEY,
  BIOMETRIC_SECRET_KEY,
  CREDENTIAL_KEY,
  createAppLock,
  type KeyValueStore,
  type StoreAuthOptions,
} from './appLock';
import { hashPin } from './pin';

const digest = async (s: string) => createHash('sha256').update(s).digest('hex');

type TestStore = KeyValueStore & {
  data: Map<string, string>;
  failGet: Set<string>;
  failSet: Set<string>;
  authReads: number;
};

function memoryStore(): TestStore {
  const data = new Map<string, string>();
  const store: TestStore = {
    data,
    failGet: new Set(),
    failSet: new Set(),
    authReads: 0,
    get: async (k: string, auth?: StoreAuthOptions) => {
      if (auth) store.authReads += 1;
      if (store.failGet.has(k)) throw new Error('keystore read failed');
      return data.get(k) ?? null;
    },
    set: async (k, v) => {
      if (store.failSet.has(k)) throw new Error('keystore write failed');
      data.set(k, v);
    },
    remove: async (k) => {
      data.delete(k);
    },
  };
  return store;
}

/** Wall clock and monotonic clock are separate so a test can move one without the other. */
function clocks(wall = 1_000_000) {
  const c = { now: wall, mono: 50_000 };
  return {
    c,
    advance(ms: number) {
      c.now += ms;
      c.mono += ms;
    },
  };
}

function make(store: KeyValueStore, c: { now: number; mono: number }, iterations = 3) {
  return createAppLock({
    store,
    digest,
    randomHex: () => 'cd'.repeat(16),
    now: () => c.now,
    mono: () => c.mono,
    iterations,
  });
}

describe('appLock credential and attempts', () => {
  it('stores only salt, iterations and hash, never the PIN', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.setPin('135790');
    const raw = store.data.get(CREDENTIAL_KEY) ?? '';
    const rec = JSON.parse(raw);
    expect(Object.keys(rec).sort()).toEqual(['hashHex', 'iterations', 'saltHex', 'v']);
    expect(rec.iterations).toBe(3);
    expect(raw).not.toContain('135790');
    expect(await lock.hasCredential()).toBe(true);
    expect(await lock.credentialState()).toBe('present');
  });

  it('accepts the right PIN and counts wrong ones with tries left', async () => {
    const lock = make(memoryStore(), clocks().c);
    await lock.setPin('1234');
    expect(await lock.checkPin('1234')).toEqual({ status: 'ok' });
    expect(await lock.checkPin('0000')).toEqual({
      status: 'wrong',
      failed: 1,
      attemptsLeft: 4,
      lockedSec: 0,
    });
  });

  it('resets the counter after a success', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.setPin('1234');
    await lock.checkPin('0000');
    await lock.checkPin('1234');
    expect(store.data.has(ATTEMPTS_KEY)).toBe(false);
  });

  it('waits 30 seconds after the fifth wrong PIN, then 60, and refuses during the wait', async () => {
    const { c, advance } = clocks();
    const lock = make(memoryStore(), c);
    await lock.setPin('1234');
    for (let i = 0; i < 4; i += 1) await lock.checkPin('0000');
    const fifth = await lock.checkPin('0000');
    expect(fifth).toMatchObject({ status: 'wrong', failed: 5, lockedSec: 30 });

    // Even the right PIN is refused while waiting.
    advance(10_000);
    expect(await lock.checkPin('1234')).toEqual({ status: 'locked', remainingSec: 20 });
    expect(await lock.getLockoutRemainingSec()).toBe(20);

    advance(20_000);
    const sixth = await lock.checkPin('0000');
    expect(sixth).toMatchObject({ status: 'wrong', failed: 6, lockedSec: 60 });
  });

  it('clearAll removes the credential, the counter and the biometric choice and secret', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.setPin('1234');
    expect(await lock.enableBiometric('prompt')).toBe(true);
    await lock.checkPin('0000');
    await lock.clearAll();
    expect(store.data.size).toBe(0);
    expect(await lock.credentialState()).toBe('absent');
  });

  it('rejects malformed PINs without counting an attempt', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.setPin('1234');
    expect(await lock.checkPin('12')).toEqual({ status: 'invalid' });
    expect(store.data.has(ATTEMPTS_KEY)).toBe(false);
    await expect(lock.setPin('12')).rejects.toThrow();
  });
});

describe('lockout and the device clock', () => {
  async function lockedOut() {
    const store = memoryStore();
    const k = clocks();
    const lock = make(store, k.c);
    await lock.setPin('1234');
    for (let i = 0; i < 5; i += 1) await lock.checkPin('0000');
    return { store, ...k, lock };
  }

  it('moving the clock forward inside a session does not shorten the wait', async () => {
    const { c, lock, advance } = await lockedOut();
    advance(10_000);
    c.now += 60 * 60 * 1000; // user sets the clock one hour ahead; monotonic time is unmoved
    expect(await lock.getLockoutRemainingSec()).toBe(20);
    expect(await lock.checkPin('1234')).toEqual({ status: 'locked', remainingSec: 20 });
    advance(20_000);
    expect(await lock.checkPin('1234')).toEqual({ status: 'ok' });
  });

  it('moving the clock backward inside a session does not lengthen the wait', async () => {
    const { c, lock, advance } = await lockedOut();
    c.now -= 60 * 60 * 1000;
    advance(30_000);
    expect(await lock.getLockoutRemainingSec()).toBe(0);
  });

  it('stores the time of the last attempt and the wait length', async () => {
    const { store } = await lockedOut();
    expect(JSON.parse(store.data.get(ATTEMPTS_KEY) ?? '{}')).toEqual({
      failed: 5,
      lastAttemptAtMs: 1_000_000,
      waitSec: 30,
    });
  });

  it('after a restart the wait is rebuilt from wall time and keeps running', async () => {
    const { store, c, advance } = await lockedOut();
    advance(5_000);
    const restarted = make(store, { now: c.now, mono: 7 }); // new process: new monotonic origin
    expect(await restarted.getLockoutRemainingSec()).toBe(25);
    expect(await restarted.checkPin('1234')).toMatchObject({ status: 'locked' });
  });

  it('after a restart, wall time earlier than the last attempt restarts the full wait', async () => {
    const { store } = await lockedOut();
    const mono = { now: 500_000, mono: 7 }; // clock moved back before the restart
    const restarted = make(store, mono);
    expect(await restarted.getLockoutRemainingSec()).toBe(30);
    // The new start is stored, so a later restart counts from it.
    expect(JSON.parse(store.data.get(ATTEMPTS_KEY) ?? '{}').lastAttemptAtMs).toBe(500_000);
    mono.mono += 10_000;
    mono.now += 10_000;
    expect(await restarted.getLockoutRemainingSec()).toBe(20);
  });

  it('known limit: a clock moved forward before an app restart still shortens the wait', async () => {
    const { store, c } = await lockedOut();
    const restarted = make(store, { now: c.now + 3600_000, mono: 7 });
    expect(await restarted.getLockoutRemainingSec()).toBe(0);
  });

  it('reads the older deadline format without ending the wait', async () => {
    const store = memoryStore();
    const k = clocks();
    const lock = make(store, k.c);
    await lock.setPin('1234');
    store.data.set(ATTEMPTS_KEY, JSON.stringify({ failed: 5, lockedUntilMs: k.c.now + 30_000 }));
    expect(await lock.getLockoutRemainingSec()).toBe(30);
  });
});

describe('storage read errors fail closed', () => {
  it('tells "no credential" apart from "read failed"', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    expect(await lock.credentialState()).toBe('absent');
    expect(await lock.hasCredential()).toBe(false);

    await lock.setPin('1234');
    store.failGet.add(CREDENTIAL_KEY);
    expect(await lock.credentialState()).toBe('error');
    await expect(lock.hasCredential()).rejects.toThrow();
  });

  it('treats a corrupt credential as an error, not as no lock', async () => {
    const store = memoryStore();
    store.data.set(CREDENTIAL_KEY, '{not json');
    expect(await make(store, clocks().c).credentialState()).toBe('error');
  });

  it('checkPin returns error and leaves the counter alone when the credential read fails', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.setPin('1234');
    await lock.checkPin('0000');
    const before = store.data.get(ATTEMPTS_KEY);
    store.failGet.add(CREDENTIAL_KEY);
    expect(await lock.checkPin('1234')).toEqual({ status: 'error' });
    expect(store.data.get(ATTEMPTS_KEY)).toBe(before);
  });

  it('checkPin returns error (never ok, never a reset) when the attempt counter cannot be read', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.setPin('1234');
    await lock.checkPin('0000');
    const before = store.data.get(ATTEMPTS_KEY);
    store.failGet.add(ATTEMPTS_KEY);
    expect(await lock.checkPin('1234')).toEqual({ status: 'error' });
    expect(store.data.get(ATTEMPTS_KEY)).toBe(before);
  });

  it('does not check the PIN when the attempt cannot be counted', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.setPin('1234');
    store.failSet.add(ATTEMPTS_KEY);
    expect(await lock.checkPin('1234')).toEqual({ status: 'error' });
  });
});

describe('re-hash on unlock', () => {
  it('moves an old 2000-round hash to the current round count after a successful unlock', async () => {
    const store = memoryStore();
    const saltHex = 'ab'.repeat(16);
    store.data.set(
      CREDENTIAL_KEY,
      JSON.stringify({ v: 1, saltHex, iterations: 2000, hashHex: await hashPin('2468', saltHex, 2000, digest) }),
    );
    const lock = make(store, clocks().c, 3);
    expect(await lock.checkPin('2468')).toEqual({ status: 'ok' });
    const rec = JSON.parse(store.data.get(CREDENTIAL_KEY) ?? '{}');
    expect(rec.iterations).toBe(3);
    expect(rec.saltHex).not.toBe(saltHex);
    expect(Object.keys(rec).sort()).toEqual(['hashHex', 'iterations', 'saltHex', 'v']);
    // The new record verifies, the old PIN still works, a wrong one does not.
    expect(await lock.checkPin('2468')).toEqual({ status: 'ok' });
    expect(await lock.checkPin('1111')).toMatchObject({ status: 'wrong' });
  });

  it('does not re-hash after a wrong PIN or when the count already matches', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c, 3);
    await lock.setPin('1234');
    const before = store.data.get(CREDENTIAL_KEY);
    await lock.checkPin('1234');
    expect(store.data.get(CREDENTIAL_KEY)).toBe(before);

    const saltHex = 'ab'.repeat(16);
    const old = JSON.stringify({ v: 1, saltHex, iterations: 7, hashHex: await hashPin('2468', saltHex, 7, digest) });
    store.data.set(CREDENTIAL_KEY, old);
    await lock.checkPin('0000');
    expect(store.data.get(CREDENTIAL_KEY)).toBe(old);
  });

  it('still unlocks when storing the new hash fails', async () => {
    const store = memoryStore();
    const saltHex = 'ab'.repeat(16);
    store.data.set(
      CREDENTIAL_KEY,
      JSON.stringify({ v: 1, saltHex, iterations: 9, hashHex: await hashPin('2468', saltHex, 9, digest) }),
    );
    store.failSet.add(CREDENTIAL_KEY);
    expect(await make(store, clocks().c, 3).checkPin('2468')).toEqual({ status: 'ok' });
  });
});

describe('biometric unlock through a protected secret', () => {
  it('stores a random secret behind authentication and the preference flag', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    expect(await lock.enableBiometric('Unlock')).toBe(true);
    expect(store.data.get(BIOMETRIC_KEY)).toBe('1');
    expect(store.data.get(BIOMETRIC_SECRET_KEY)).toMatch(/^[0-9a-f]{32,}$/); // 64 hex chars with the real random source
    expect(await lock.getBiometricEnabled()).toBe(true);
  });

  it('unlocks only by reading the secret, and resets the attempt counter', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.setPin('1234');
    await lock.checkPin('0000');
    await lock.enableBiometric('Unlock');
    store.authReads = 0;
    expect(await lock.biometricUnlock('Unlock')).toBe('ok');
    expect(store.authReads).toBe(1);
    expect(store.data.has(ATTEMPTS_KEY)).toBe(false);
  });

  it('stops without prompting when the stored preference is off', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.enableBiometric('Unlock');
    await lock.disableBiometric();
    store.authReads = 0;
    expect(await lock.biometricUnlock('Unlock')).toBe('off');
    expect(store.authReads).toBe(0);
  });

  it('turns biometric off when the key was invalidated (new fingerprint or face enrolled)', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.enableBiometric('Unlock');
    store.data.delete(BIOMETRIC_SECRET_KEY); // the module returns null for an invalidated key
    expect(await lock.biometricUnlock('Unlock')).toBe('invalidated');
    expect(await lock.getBiometricEnabled()).toBe(false);
    expect(await lock.biometricUnlock('Unlock')).toBe('off');
  });

  it('keeps the preference when the user cancels the prompt', async () => {
    const store = memoryStore();
    const lock = make(store, clocks().c);
    await lock.enableBiometric('Unlock');
    store.failGet.add(BIOMETRIC_SECRET_KEY);
    expect(await lock.biometricUnlock('Unlock')).toBe('cancelled');
    expect(await lock.getBiometricEnabled()).toBe(true);
  });

  it('stays off when enabling is cancelled', async () => {
    const store = memoryStore();
    store.failSet.add(BIOMETRIC_SECRET_KEY);
    const lock = make(store, clocks().c);
    expect(await lock.enableBiometric('Unlock')).toBe(false);
    expect(store.data.has(BIOMETRIC_KEY)).toBe(false);
  });
});
