import React from 'react';
import { AppState, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DEFAULT_SETTINGS, type Repo } from '@/data/repo';
import type { Settings } from '@/domain/types';
import { appLock, isAppLockSupported } from '@/security/appLock';
import { isBiometricAvailable } from '@/security/biometrics';
import { setScreenCaptureBlocked } from '@/security/screenCapture';
import { AppContext } from '@/state/AppContext';
import { LockContext } from '@/state/LockContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { LockGate } from './LockGate';
import { Sheet } from './Sheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/security/appLock', () => ({
  isAppLockSupported: jest.fn(),
  appLock: {
    credentialState: jest.fn(),
    getBiometricEnabled: jest.fn(),
    clearAll: jest.fn(),
  },
}));
jest.mock('@/security/biometrics', () => ({ isBiometricAvailable: jest.fn() }));
jest.mock('@/security/screenCapture', () => ({
  setScreenCaptureBlocked: jest.fn(async () => {}),
}));
jest.mock('@/data/deleteAll', () => ({ runDeleteAllData: jest.fn(async () => {}) }));
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('./LockScreen', () => {
  const R = require('react');
  const { Pressable, Text: T, View } = require('react-native');
  return {
    LockScreen: ({ biometric, onUnlocked }: { biometric: boolean; onUnlocked: () => void }) =>
      R.createElement(
        View,
        { testID: 'lock-screen' },
        R.createElement(T, { testID: 'lock-bio' }, String(biometric)),
        R.createElement(Pressable, { testID: 'mock-unlock', onPress: onUnlocked }),
      ),
  };
});

const supportedMock = isAppLockSupported as jest.Mock;
const credentialState = appLock.credentialState as jest.Mock;
const getBiometricEnabled = appLock.getBiometricEnabled as jest.Mock;
const biometricAvailable = isBiometricAvailable as jest.Mock;
const blockCapture = setScreenCaptureBlocked as jest.Mock;

let appStateHandler: (state: string) => void = () => {};
const updateSetting = jest.fn(async () => {});
const refreshSettings = jest.fn(async () => {});

function app(settings: Partial<Settings> = {}, withSheet = false) {
  const merged = { ...DEFAULT_SETTINGS, appLockEnabled: true, appLockTimeoutSec: 60, ...settings };
  return (
    <AppContext.Provider
      value={{
        repo: {} as Repo,
        backend: 'memory',
        settings: merged,
        updateSetting,
        refreshSettings,
      }}
    >
      <ThemeProvider preference="light">
        <LockGate>
          <Text testID="app-child">app</Text>
          {withSheet ? (
            <Sheet visible onClose={() => {}} title="Inside" testID="child-sheet">
              <Text>sheet body</Text>
            </Sheet>
          ) : null}
        </LockGate>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

async function renderApp(settings: Partial<Settings> = {}, withSheet = false) {
  await render(app(settings, withSheet));
  await act(async () => {});
}

async function unlock() {
  await fireEvent.press(screen.getByTestId('mock-unlock'));
  await act(async () => {});
}

async function setState(state: string) {
  await act(async () => {
    appStateHandler(state);
  });
}

describe('LockGate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    jest.clearAllMocks();
    supportedMock.mockResolvedValue(true);
    credentialState.mockResolvedValue('present');
    getBiometricEnabled.mockResolvedValue(false);
    biometricAvailable.mockResolvedValue(true);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      appStateHandler = cb as (state: string) => void;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('renders nothing of the app before the lock check has finished', async () => {
    let resolveSupported: (v: boolean) => void = () => {};
    supportedMock.mockReturnValue(new Promise<boolean>((r) => (resolveSupported = r)));
    credentialState.mockResolvedValue('absent');
    await renderApp({ appLockEnabled: false });
    expect(screen.queryByTestId('app-child')).toBeNull();
    expect(screen.queryByTestId('lock-screen')).toBeNull();
    expect(screen.getByTestId('lock-checking')).toBeTruthy();

    await act(async () => {
      resolveSupported(true);
    });
    expect(screen.getByTestId('app-child')).toBeTruthy();
    expect(screen.queryByTestId('lock-checking')).toBeNull();
  });

  it('does not mount the app on a cold start while locked, and mounts it after unlock', async () => {
    await renderApp();
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    expect(screen.queryByTestId('app-child')).toBeNull();
    await unlock();
    expect(screen.getByTestId('app-child')).toBeTruthy();
    expect(screen.queryByTestId('lock-screen')).toBeNull();
  });

  it('locks again after the timeout and not before', async () => {
    await renderApp();
    await unlock();

    await setState('background');
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    await setState('active');
    expect(screen.queryByTestId('lock-screen')).toBeNull();

    await setState('background');
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    await setState('active');
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    // The app stays mounted underneath: one navigator, never torn down and rebuilt.
    expect(screen.getByTestId('app-child')).toBeTruthy();
  });

  it('shows a plain cover as soon as the app goes to the background', async () => {
    await renderApp();
    await unlock();
    await setState('background');
    expect(screen.getByTestId('lock-cover')).toBeTruthy();
    await setState('active');
    expect(screen.queryByTestId('lock-cover')).toBeNull();
  });

  it('stays locked with a Retry button when secure storage cannot be read', async () => {
    credentialState.mockResolvedValue('error');
    await renderApp();
    expect(screen.getByTestId('lock-error')).toBeTruthy();
    expect(screen.getByText(/did not respond/)).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.queryByTestId('app-child')).toBeNull();
    expect(updateSetting).not.toHaveBeenCalled();

    credentialState.mockResolvedValue('present');
    await fireEvent.press(screen.getByTestId('lock-retry'));
    await act(async () => {});
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    expect(screen.queryByTestId('app-child')).toBeNull();
  });

  it('turns the setting off only when the read worked and found no credential', async () => {
    credentialState.mockResolvedValue('absent');
    await renderApp({ appLockEnabled: true });
    expect(updateSetting).toHaveBeenCalledWith('appLockEnabled', false);
    expect(screen.getByTestId('app-child')).toBeTruthy();
  });

  it('never turns the setting off after a failed read', async () => {
    credentialState.mockResolvedValue('error');
    await renderApp({ appLockEnabled: true });
    expect(updateSetting).not.toHaveBeenCalled();
    expect(screen.queryByTestId('app-child')).toBeNull();
  });

  it('treats an existing credential as lock on even when the setting says off', async () => {
    await renderApp({ appLockEnabled: false });
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    expect(updateSetting).toHaveBeenCalledWith('appLockEnabled', true);
  });

  it('re-reads the biometric preference every time the app locks', async () => {
    getBiometricEnabled.mockResolvedValueOnce(false).mockResolvedValue(true);
    await renderApp();
    expect(getBiometricEnabled).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('lock-bio').props.children).toBe('false');
    await unlock();

    await setState('background');
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    await setState('active');
    expect(getBiometricEnabled).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('lock-bio').props.children).toBe('true');
  });

  it('blocks screen capture while the lock is on and allows it when there is none', async () => {
    await renderApp();
    expect(blockCapture).toHaveBeenLastCalledWith(true);
    jest.clearAllMocks();
    credentialState.mockResolvedValue('absent');
    // A second mount with no credential ends unblocked.
    await renderApp({ appLockEnabled: false });
    expect(blockCapture).toHaveBeenLastCalledWith(false);
  });

  it('hides sheets of the app while locked and restores them after unlock', async () => {
    await renderApp({}, true);
    await unlock();
    expect(screen.getByTestId('child-sheet')).toBeTruthy();

    await setState('background');
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    await setState('active');
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    expect(screen.queryByTestId('child-sheet')).toBeNull();

    await unlock();
    expect(screen.getByTestId('child-sheet')).toBeTruthy();
  });
});

describe('Sheet and the lock', () => {
  it('renders nothing while locked and its content when unlocked', async () => {
    const sheet = (
      <Sheet visible onClose={() => {}} title="Inside" testID="solo-sheet">
        <Text>sheet body</Text>
      </Sheet>
    );
    const lockedCtx = { locked: true, enabled: true, refresh: async () => {} };
    const { rerender } = await render(
      <ThemeProvider preference="light">
        <LockContext.Provider value={lockedCtx}>{sheet}</LockContext.Provider>
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('solo-sheet')).toBeNull();
    expect(screen.queryByText('sheet body')).toBeNull();

    await rerender(
      <ThemeProvider preference="light">
        <LockContext.Provider value={{ ...lockedCtx, locked: false }}>{sheet}</LockContext.Provider>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('solo-sheet')).toBeTruthy();
    expect(screen.getByText('sheet body')).toBeTruthy();
  });
});
