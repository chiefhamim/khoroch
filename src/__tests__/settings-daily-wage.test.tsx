import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings/index';
import { MemoryRepo } from '@/data/memoryRepo';
import { formatMoney, HIDDEN_AMOUNT_TEXT } from '@/domain/money';
import { setLocale, t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { usePrivacyStore } from '@/state/privacyStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

jest.mock('expo-router', () => {
  const nav = {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
    setParams: jest.fn(),
  };
  return {
    router: nav,
    useRouter: () => nav,
    useLocalSearchParams: () => ({}),
    useFocusEffect: () => {},
  };
});

jest.mock('react-native-safe-area-context', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) =>
      reactMod.createElement(rnMod.View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@/notifications/reminders', () => ({
  getNotificationPermissionStatus: jest.fn(async () => 'granted'),
  isNotificationsSupported: jest.fn(() => true),
  requestNotificationPermission: jest.fn(async () => 'granted'),
  syncReminderSchedule: jest.fn(async () => {}),
}));

async function renderSettings() {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('dailyWage', { amountMinor: 80_050, categoryId: 'business', accountId: null });
  const settings = await repo.getSettings();
  return render(
    <AppContext.Provider
      value={{
        repo,
        backend: 'memory',
        settings,
        updateSetting: async (k, v) => {
          await repo.setSetting(k, v);
        },
        refreshSettings: async () => {},
      }}
    >
      <ThemeProvider preference="light">
        <ToastProvider>
          <SettingsScreen />
        </ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('Daily wage row in Settings', () => {
  beforeEach(() => {
    setLocale('en');
    usePrivacyStore.setState({ hideAmounts: false, showPoisha: false });
  });

  it('follows the show-poisha setting', async () => {
    const view = await renderSettings();
    await waitFor(() => expect(view.getByTestId('settings-daily-wage-row')).toBeTruthy());
    expect(view.getByText(formatMoney(80_050, 'BDT', { showPoisha: false }))).toBeTruthy();
    await act(async () => usePrivacyStore.setState({ showPoisha: true }));
    expect(view.getByText(formatMoney(80_050, 'BDT', { showPoisha: true }))).toBeTruthy();
  });

  it('hides the amount when amounts are hidden', async () => {
    await act(async () => usePrivacyStore.setState({ hideAmounts: true }));
    const view = await renderSettings();
    await waitFor(() => expect(view.getByTestId('settings-daily-wage-row')).toBeTruthy());
    expect(view.queryByText(formatMoney(80_050, 'BDT', { showPoisha: false }))).toBeNull();
    expect(view.getAllByText(HIDDEN_AMOUNT_TEXT).length).toBeGreaterThan(0);
    expect(view.getByText(t('settings.dailyWageRow'))).toBeTruthy();
  });
});
