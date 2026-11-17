import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { appLock } from '@/security/appLock';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { LockScreen } from './LockScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Real lock logic over an in-memory secure store and Node's SHA-256 (3 rounds for speed).
jest.mock('@/security/appLock', () => {
  const actual = jest.requireActual('@/security/appLock');
  const { createHash } = jest.requireActual('crypto');
  const data = new Map<string, string>();
  const lock = actual.createAppLock({
    store: {
      get: async (k: string) => data.get(k) ?? null,
      set: async (k: string, v: string) => {
        data.set(k, v);
      },
      remove: async (k: string) => {
        data.delete(k);
      },
    },
    digest: async (s: string) => createHash('sha256').update(s).digest('hex'),
    randomHex: () => 'ef'.repeat(16),
    now: () => Date.now(),
    iterations: 3,
  });
  return { ...actual, appLock: lock, isAppLockSupported: async () => true };
});

async function typePin(pin: string) {
  for (const d of pin) {
    await fireEvent.press(screen.getByTestId(`pin-entry-pad-key-${d}`));
  }
}

async function submit() {
  await fireEvent.press(screen.getByTestId('pin-entry-submit'));
}

describe('LockScreen', () => {
  const onUnlocked = jest.fn();

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    onUnlocked.mockClear();
    await appLock.clearAll();
    await appLock.setPin('1234');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderLock() {
    await render(
      <ThemeProvider preference="light">
        <LockScreen biometric={false} onUnlocked={onUnlocked} onEraseAll={async () => {}} />
      </ThemeProvider>,
    );
    await act(async () => {});
  }

  it('shows a text message for a wrong PIN and does not unlock', async () => {
    await renderLock();
    await typePin('9999');
    await submit();
    await act(async () => {});
    expect(screen.getByText('Wrong PIN. Tries left before a wait: 4.')).toBeTruthy();
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it('unlocks with the correct PIN', async () => {
    await renderLock();
    await typePin('1234');
    await submit();
    await act(async () => {});
    expect(onUnlocked).toHaveBeenCalledTimes(1);
  });

  it('never shows the digits that were typed', async () => {
    await renderLock();
    await typePin('42');
    expect(screen.getByLabelText('PIN, 2 of 6 digits entered')).toBeTruthy();
    expect(screen.queryByText('42')).toBeNull();
  });

  it('after five wrong PINs shows a countdown in whole seconds that ticks down', async () => {
    await renderLock();
    for (let i = 0; i < 5; i += 1) {
      await typePin('9999');
      await submit();
      await act(async () => {});
    }
    expect(
      screen.getByText('Too many wrong PINs. Try again in 30 seconds.'),
    ).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText('Too many wrong PINs. Try again in 29 seconds.'),
    ).toBeTruthy();
    // The right PIN is refused while waiting.
    expect(screen.getByTestId('pin-entry-submit').props.accessibilityState?.disabled).toBe(true);
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it('offers the forgotten-PIN path and only enables erase after typing DELETE', async () => {
    await renderLock();
    await fireEvent.press(screen.getByTestId('pin-entry-forgot'));
    await act(async () => {});
    expect(screen.getByText(/cannot be recovered/)).toBeTruthy();
    const confirm = screen.getByTestId('lock-forgot-confirm');
    expect(confirm.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('lock-forgot-input'), 'DELETE');
    expect(screen.getByTestId('lock-forgot-confirm').props.accessibilityState?.disabled).toBeFalsy();
  });
});
