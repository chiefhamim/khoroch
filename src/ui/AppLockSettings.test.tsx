import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DEFAULT_SETTINGS, type Repo } from '@/data/repo';
import type { Settings } from '@/domain/types';
import { appLock } from '@/security/appLock';
import { isBiometricAvailable } from '@/security/biometrics';
import { AppContext } from '@/state/AppContext';
import { LockContext } from '@/state/LockContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AppLockSettings } from './AppLockSettings';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/security/appLock', () => ({
  isAppLockSupported: jest.fn(async () => true),
  appLock: {
    credentialState: jest.fn(),
    setPin: jest.fn(),
    clearAll: jest.fn(),
    enableBiometric: jest.fn(),
    disableBiometric: jest.fn(),
    getBiometricEnabled: jest.fn(),
    checkPin: jest.fn(),
    getLockoutRemainingSec: jest.fn(),
    biometricUnlock: jest.fn(),
  },
}));
jest.mock('@/security/biometrics', () => ({ isBiometricAvailable: jest.fn() }));

const lock = appLock as unknown as Record<string, jest.Mock>;
const biometricAvailable = isBiometricAvailable as jest.Mock;
const updateSetting = jest.fn();
const refresh = jest.fn(async () => {});

async function renderSettings(opts: { enabled?: boolean; settings?: Partial<Settings> } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  await render(
    <AppContext.Provider
      value={{
        repo: {} as Repo,
        backend: 'memory',
        settings,
        updateSetting,
        refreshSettings: async () => {},
      }}
    >
      <LockContext.Provider value={{ locked: false, enabled: opts.enabled ?? false, refresh }}>
        <ThemeProvider preference="light">
          <AppLockSettings />
        </ThemeProvider>
      </LockContext.Provider>
    </AppContext.Provider>,
  );
  await act(async () => {});
}

async function press(testID: string) {
  await fireEvent.press(screen.getByTestId(testID));
  await act(async () => {});
}

async function typeOnPad(padId: string, pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`${padId}-key-${d}`));
}

describe('AppLockSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lock.credentialState.mockResolvedValue('absent');
    lock.setPin.mockResolvedValue(undefined);
    lock.clearAll.mockResolvedValue(undefined);
    lock.enableBiometric.mockResolvedValue(true);
    lock.disableBiometric.mockResolvedValue(undefined);
    lock.getBiometricEnabled.mockResolvedValue(false);
    lock.checkPin.mockResolvedValue({ status: 'ok' });
    lock.getLockoutRemainingSec.mockResolvedValue(0);
    lock.biometricUnlock.mockResolvedValue('cancelled');
    biometricAvailable.mockResolvedValue(false);
    updateSetting.mockResolvedValue(undefined);
  });

  it('turning on with nothing stored goes straight to choosing a PIN', async () => {
    await renderSettings();
    await press('settings-app-lock-switch');
    expect(screen.getByTestId('settings-app-lock-pad')).toBeTruthy();
    expect(screen.queryByTestId('settings-app-lock-verify')).toBeNull();
  });

  it('turning on when a credential already exists asks for the current PIN first', async () => {
    lock.credentialState.mockResolvedValue('present');
    await renderSettings();
    await press('settings-app-lock-switch');
    expect(screen.getByTestId('settings-app-lock-verify')).toBeTruthy();
    expect(screen.queryByTestId('settings-app-lock-pad')).toBeNull();
    expect(lock.setPin).not.toHaveBeenCalled();

    await typeOnPad('settings-app-lock-verify-pad', '1234');
    await press('settings-app-lock-verify-submit');
    expect(lock.checkPin).toHaveBeenCalledWith('1234');
    expect(screen.getByTestId('settings-app-lock-pad')).toBeTruthy();
  });

  it('a credential that cannot be read is treated as existing: verify first', async () => {
    lock.credentialState.mockResolvedValue('error');
    await renderSettings();
    await press('settings-app-lock-switch');
    expect(screen.getByTestId('settings-app-lock-verify')).toBeTruthy();
    expect(lock.setPin).not.toHaveBeenCalled();
  });

  it('refreshes the lock state and the biometric state when a later step fails after the PIN was written', async () => {
    updateSetting.mockRejectedValue(new Error('settings write failed'));
    await renderSettings();
    await press('settings-app-lock-switch');
    await typeOnPad('settings-app-lock-pad', '2468');
    await press('settings-app-lock-continue');
    await typeOnPad('settings-app-lock-pad', '2468');
    lock.getBiometricEnabled.mockClear();
    await press('settings-app-lock-continue');

    expect(lock.setPin).toHaveBeenCalledWith('2468');
    expect(updateSetting).toHaveBeenCalledWith('appLockEnabled', true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Could not save the PIN. Please try again.')).toBeTruthy();
    // Back to choosing a PIN with nothing left over from the failed try.
    expect(screen.getByTestId('settings-app-lock-pad')).toBeTruthy();
    expect(screen.getByLabelText('PIN, 0 of 6 digits entered')).toBeTruthy();
  });

  it('refreshes the lock state when turning off fails halfway', async () => {
    lock.clearAll.mockRejectedValue(new Error('remove failed'));
    await renderSettings({ enabled: true });
    await press('settings-app-lock-switch');
    await typeOnPad('settings-app-lock-verify-pad', '1234');
    await press('settings-app-lock-verify-submit');
    expect(lock.clearAll).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Could not save the PIN. Please try again.')).toBeTruthy();
  });

  it('turning on fingerprint or face needs the current PIN first', async () => {
    biometricAvailable.mockResolvedValue(true);
    await renderSettings({ enabled: true });
    await press('settings-app-lock-bio-switch');
    expect(screen.getByTestId('settings-app-lock-verify')).toBeTruthy();
    expect(lock.enableBiometric).not.toHaveBeenCalled();

    await typeOnPad('settings-app-lock-verify-pad', '1234');
    await press('settings-app-lock-verify-submit');
    expect(lock.enableBiometric).toHaveBeenCalledTimes(1);
  });

  it('does not turn fingerprint or face on after a wrong PIN', async () => {
    biometricAvailable.mockResolvedValue(true);
    lock.checkPin.mockResolvedValue({ status: 'wrong', failed: 1, attemptsLeft: 4, lockedSec: 0 });
    await renderSettings({ enabled: true });
    await press('settings-app-lock-bio-switch');
    await typeOnPad('settings-app-lock-verify-pad', '9999');
    await press('settings-app-lock-verify-submit');
    expect(lock.enableBiometric).not.toHaveBeenCalled();
  });

  it('shows a plain error when fingerprint or face could not be turned on', async () => {
    biometricAvailable.mockResolvedValue(true);
    lock.enableBiometric.mockResolvedValue(false);
    await renderSettings({ enabled: true });
    await press('settings-app-lock-bio-switch');
    await typeOnPad('settings-app-lock-verify-pad', '1234');
    await press('settings-app-lock-verify-submit');
    expect(screen.getByText('Fingerprint or face unlock was not turned on.')).toBeTruthy();
  });

  it('turning fingerprint or face off reads the stored state back instead of assuming it', async () => {
    biometricAvailable.mockResolvedValue(true);
    lock.getBiometricEnabled.mockResolvedValue(true); // stays on: the removal did not take effect
    lock.disableBiometric.mockRejectedValue(new Error('remove failed'));
    await renderSettings({ enabled: true });
    expect(screen.getByTestId('settings-app-lock-bio-switch').props.accessibilityState.checked).toBe(true);
    lock.getBiometricEnabled.mockClear();
    await press('settings-app-lock-bio-switch');
    expect(lock.disableBiometric).toHaveBeenCalled();
    expect(lock.getBiometricEnabled).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('settings-app-lock-bio-switch').props.accessibilityState.checked).toBe(true);

    lock.disableBiometric.mockResolvedValue(undefined);
    lock.getBiometricEnabled.mockResolvedValue(false);
    await press('settings-app-lock-bio-switch');
    expect(screen.getByTestId('settings-app-lock-bio-switch').props.accessibilityState.checked).toBe(false);
  });
});
