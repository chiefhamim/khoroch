import { createHash } from 'crypto';
import {
  DEFAULT_PIN_ITERATIONS,
  constantTimeEqual,
  hashPin,
  isValidPinFormat,
  lockoutSecondsFor,
  remainingLockoutSec,
  shouldLockAfterBackground,
  verifyPin,
  waitRemainingFromElapsed,
} from './pin';

// Stand-in for expo-crypto's SHA-256 so the pure logic runs in Node.
const digest = async (s: string) => createHash('sha256').update(s).digest('hex');

describe('PIN validation', () => {
  it.each(['1234', '12345', '123456', '0000'])('accepts %s', (p) => {
    expect(isValidPinFormat(p)).toBe(true);
  });
  it.each(['', '123', '1234567', '12a4', '12 34', '١٢٣٤', '12.4'])('rejects %p', (p) => {
    expect(isValidPinFormat(p)).toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it('compares equal and different strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });
});

describe('hashPin and verifyPin', () => {
  const salt = 'a1'.repeat(16);

  it('is deterministic for the same salt, pin and iterations', async () => {
    expect(await hashPin('1234', salt, 5, digest)).toBe(await hashPin('1234', salt, 5, digest));
  });

  it('changes with the salt, the pin and the iteration count', async () => {
    const base = await hashPin('1234', salt, 5, digest);
    expect(await hashPin('1234', 'b2'.repeat(16), 5, digest)).not.toBe(base);
    expect(await hashPin('1235', salt, 5, digest)).not.toBe(base);
    expect(await hashPin('1234', salt, 6, digest)).not.toBe(base);
  });

  it('runs exactly the requested number of digest rounds', async () => {
    const calls = jest.fn(digest);
    await hashPin('1234', salt, 7, calls);
    expect(calls).toHaveBeenCalledTimes(7);
  });

  it('never contains the PIN in the stored hash', async () => {
    const h = await hashPin('482913', salt, 3, digest);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('482913');
  });

  it('verifies the right PIN and refuses wrong or malformed ones', async () => {
    const rec = { saltHex: salt, iterations: 4, hashHex: await hashPin('2468', salt, 4, digest) };
    expect(await verifyPin('2468', rec, digest)).toBe(true);
    expect(await verifyPin('2469', rec, digest)).toBe(false);
    expect(await verifyPin('24', rec, digest)).toBe(false);
  });

  it('uses a small default round count (protection is the Keystore and the attempt limit)', () => {
    expect(DEFAULT_PIN_ITERATIONS).toBeGreaterThanOrEqual(50);
    expect(DEFAULT_PIN_ITERATIONS).toBeLessThanOrEqual(200);
  });

  it('still verifies an older 2000-round record', async () => {
    const rec = { saltHex: salt, iterations: 2000, hashHex: await hashPin('2468', salt, 2000, digest) };
    expect(await verifyPin('2468', rec, digest)).toBe(true);
  });
});

describe('lockout back-off schedule', () => {
  it('allows four failures and the fifth waits 30 seconds, then doubles', () => {
    expect([1, 2, 3, 4].map(lockoutSecondsFor)).toEqual([0, 0, 0, 0]);
    expect([5, 6, 7, 8, 9].map(lockoutSecondsFor)).toEqual([30, 60, 120, 240, 480]);
  });

  it('is capped', () => {
    expect(lockoutSecondsFor(40)).toBe(3600);
    expect(lockoutSecondsFor(1000)).toBe(3600);
  });

  it('reports whole seconds left, rounding up, never below zero', () => {
    expect(remainingLockoutSec(10_000, 0)).toBe(10);
    expect(remainingLockoutSec(10_001, 0)).toBe(11);
    expect(remainingLockoutSec(10_000, 10_000)).toBe(0);
    expect(remainingLockoutSec(10_000, 20_000)).toBe(0);
    expect(remainingLockoutSec(0, 5)).toBe(0);
  });

  it('clamps a deadline that is impossibly far away (clock moved back)', () => {
    expect(remainingLockoutSec(10 ** 12, 0)).toBe(3600);
  });
});

describe('shouldLockAfterBackground', () => {
  const T = 1_000_000;
  it('locks every time when the timeout is immediate', () => {
    expect(shouldLockAfterBackground(T, T, 0)).toBe(true);
    expect(shouldLockAfterBackground(T, T + 1, 0)).toBe(true);
  });
  it('locks only once the timeout has passed', () => {
    expect(shouldLockAfterBackground(T, T + 59_999, 60)).toBe(false);
    expect(shouldLockAfterBackground(T, T + 60_000, 60)).toBe(true);
    expect(shouldLockAfterBackground(T, T + 299_000, 300)).toBe(false);
    expect(shouldLockAfterBackground(T, T + 900_000, 900)).toBe(true);
  });
  it('fails closed when the clock went backwards or the time is unknown', () => {
    expect(shouldLockAfterBackground(T, T - 5_000, 300)).toBe(true);
    expect(shouldLockAfterBackground(null, T, 300)).toBe(true);
  });
});

describe('waitRemainingFromElapsed', () => {
  const ref = { lastElapsedMs: 100_000, bootMarkerMs: 900_000 };
  // wall = marker + elapsed
  it('counts the wait down on the since-boot clock', () => {
    expect(waitRemainingFromElapsed(ref, 30, 1_000_000, 100_000)).toBe(30_000);
    expect(waitRemainingFromElapsed(ref, 30, 1_010_000, 110_000)).toBe(20_000);
    expect(waitRemainingFromElapsed(ref, 30, 1_030_000, 130_000)).toBe(0);
    expect(waitRemainingFromElapsed(ref, 30, 1_900_000, 1_000_000)).toBe(0);
  });
  it('asks for a full restart after a reboot or a moved clock', () => {
    expect(waitRemainingFromElapsed(ref, 30, 1_010_000, 5_000)).toBeNull(); // since-boot went back
    expect(waitRemainingFromElapsed(ref, 30, 5_000_000, 110_000)).toBeNull(); // clock forward
    expect(waitRemainingFromElapsed(ref, 30, 100_000, 110_000)).toBeNull(); // clock back
    expect(waitRemainingFromElapsed(ref, 30, 3_000_000, 2_100_000)).toBe(0); // same marker, long sleep
  });
  it('asks for a full restart when no reference was stored', () => {
    expect(
      waitRemainingFromElapsed({ lastElapsedMs: null, bootMarkerMs: null }, 30, 1, 1),
    ).toBeNull();
  });
});
