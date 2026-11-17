import { createHash } from 'crypto';
import { ATTEMPTS_KEY, CREDENTIAL_KEY, createAppLock, type KeyValueStore } from './appLock';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => {
      data.set(k, v);
    },
    remove: async (k) => {
      data.delete(k);
    },
  };
}

function make(store: KeyValueStore, clock: { now: number }) {
  return createAppLock({
    store,
    digest: async (s) => createHash('sha256').update(s).digest('hex'),
    randomHex: () => 'cd'.repeat(16),
    now: () => clock.now,
    iterations: 3,
  });
}

describe('appLock credential and attempts', () => {
  it('stores only salt, iterations and hash, never the PIN', async () => {
    const store = memoryStore();
    const lock = make(store, { now: 0 });
    await lock.setPin('135790');
    const raw = store.data.get(CREDENTIAL_KEY) ?? '';
    const rec = JSON.parse(raw);
    expect(Object.keys(rec).sort()).toEqual(['hashHex', 'iterations', 'saltHex', 'v']);
    expect(rec.iterations).toBe(3);
    expect(raw).not.toContain('135790');
    expect(await lock.hasCredential()).toBe(true);
  });

  it('accepts the right PIN and counts wrong ones with tries left', async () => {
    const lock = make(memoryStore(), { now: 0 });
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
    const lock = make(store, { now: 0 });
    await lock.setPin('1234');
    await lock.checkPin('0000');
    await lock.checkPin('1234');
    expect(store.data.has(ATTEMPTS_KEY)).toBe(false);
  });

  it('waits 30 seconds after the fifth wrong PIN, then 60, and refuses during the wait', async () => {
    const clock = { now: 1_000_000 };
    const lock = make(memoryStore(), clock);
    await lock.setPin('1234');
    for (let i = 0; i < 4; i += 1) await lock.checkPin('0000');
    const fifth = await lock.checkPin('0000');
    expect(fifth).toMatchObject({ status: 'wrong', failed: 5, lockedSec: 30 });

    // Even the right PIN is refused while waiting.
    clock.now += 10_000;
    expect(await lock.checkPin('1234')).toEqual({ status: 'locked', remainingSec: 20 });
    expect(await lock.getLockoutRemainingSec()).toBe(20);

    clock.now += 20_000;
    const sixth = await lock.checkPin('0000');
    expect(sixth).toMatchObject({ status: 'wrong', failed: 6, lockedSec: 60 });
  });

  it('keeps the counter and the wait across an app restart', async () => {
    const store = memoryStore();
    const clock = { now: 5_000 };
    const first = make(store, clock);
    await first.setPin('1234');
    for (let i = 0; i < 5; i += 1) await first.checkPin('0000');

    const afterRestart = make(store, clock); // new instance, same secure store
    expect(await afterRestart.getLockoutRemainingSec()).toBe(30);
    expect(await afterRestart.checkPin('1234')).toMatchObject({ status: 'locked' });
    clock.now += 30_000;
    expect(await afterRestart.checkPin('1234')).toEqual({ status: 'ok' });
  });

  it('clearAll removes the credential, the counter and the biometric choice', async () => {
    const store = memoryStore();
    const lock = make(store, { now: 0 });
    await lock.setPin('1234');
    await lock.setBiometricEnabled(true);
    await lock.checkPin('0000');
    await lock.clearAll();
    expect(store.data.size).toBe(0);
    expect(await lock.hasCredential()).toBe(false);
  });

  it('rejects malformed PINs without counting an attempt', async () => {
    const store = memoryStore();
    const lock = make(store, { now: 0 });
    await lock.setPin('1234');
    expect(await lock.checkPin('12')).toEqual({ status: 'invalid' });
    expect(store.data.has(ATTEMPTS_KEY)).toBe(false);
    await expect(lock.setPin('12')).rejects.toThrow();
  });
});
