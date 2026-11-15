import React, { useState } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings/index';
import { MemoryRepo } from '@/data/memoryRepo';
import type { Settings } from '@/domain/types';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

let mockCanGoBack = true;
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSetParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
    setParams: (...args: unknown[]) => mockSetParams(...args),
  },
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
    setParams: (...args: unknown[]) => mockSetParams(...args),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
}));

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

function StatefulSettingsHarness({
  repo,
  initialSettings,
}: {
  repo: MemoryRepo;
  initialSettings: Settings;
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings);

  return (
    <AppContext.Provider
      value={{
        repo,
        backend: 'memory',
        settings,
        updateSetting: async (key, value) => {
          await repo.setSetting(key, value);
          const next = await repo.getSettings();
          setSettings(next);
        },
        refreshSettings: async () => {
          const next = await repo.getSettings();
          setSettings(next);
        },
      }}
    >
      <ThemeProvider preference={settings.theme} accent={settings.accent}>
        <ToastProvider>
          <SettingsScreen />
        </ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

async function setupSettingsRepo() {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('name', 'Hamim');
  await repo.setSetting('currency', 'BDT');
  await repo.setSetting('language', 'en');
  await repo.setSetting('monthStartDay', 1);
  await repo.setSetting('theme', 'dark');
  await repo.setSetting('reminder', {
    enabled: true,
    time: '21:00',
    days: [1, 2, 3, 4, 5, 6],
  });
  return repo;
}

async function renderSettings(repo: MemoryRepo) {
  const settings = await repo.getSettings();
  return render(<StatefulSettingsHarness repo={repo} initialSettings={settings} />);
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    setLocale('en');
    mockCanGoBack = true;
    mockBack.mockClear();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  it('renders EN settings, updates display name, opens appearance & backup sheets, and uses back fallback', async () => {
    const repo = await setupSettingsRepo();
    const view = await renderSettings(repo);

    await waitFor(() => {
      expect(view.getByText('Settings')).toBeTruthy();
    });

    expect(view.getByText('1st of the month')).toBeTruthy();
    expect(view.getByText('Forest · Dark')).toBeTruthy();

    await fireEvent.press(view.getByTestId('settings-profile-row'));
    await waitFor(() => {
      expect(view.getByTestId('settings-name-input')).toBeTruthy();
    });
    await fireEvent.changeText(view.getByTestId('settings-name-input'), 'Rafi');
    await fireEvent.press(view.getByTestId('settings-name-save'));
    await waitFor(() => {
      expect(view.getByText('Rafi')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('settings-appearance-row'));
    await waitFor(() => {
      expect(view.getByTestId('settings-theme-light')).toBeTruthy();
    });
    await fireEvent.press(view.getByTestId('settings-theme-light'));
    await waitFor(() => {
      expect(view.getByText('Forest · Light')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('settings-backup-row'));
    await waitFor(() => {
      expect(view.getByTestId('settings-backup-share-btn')).toBeTruthy();
      expect(view.getByTestId('settings-backup-restore-btn')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('settings-currency-row'));
    await waitFor(() => {
      expect(view.getByText('Bangladeshi Taka (BDT ৳)')).toBeTruthy();
    });

    mockCanGoBack = false;
    await fireEvent.press(view.getByTestId('settings-back'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('localizes ordinals, DayToggles, currency names, and cycle preview in Bangla', async () => {
    const repo = await setupSettingsRepo();
    await repo.setSetting('language', 'bn');
    setLocale('bn');
    const view = await renderSettings(repo);

    await waitFor(() => {
      expect(view.getByText('সেটিংস')).toBeTruthy();
    });

    expect(view.getByText('মাসের 1 তারিখ')).toBeTruthy();
    expect(view.queryByText(/1st/)).toBeNull();
    expect(view.getByText('সো')).toBeTruthy();
    expect(view.getByText('বু')).toBeTruthy();
    expect(view.getByText('শু')).toBeTruthy();

    await fireEvent.press(view.getByTestId('settings-currency-row'));
    await waitFor(() => {
      expect(view.getByText('বাংলাদেশি টাকা (BDT ৳)')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('settings-cycle-row'));
    await waitFor(() => {
      expect(view.getByTestId('settings-cycle-preview')).toBeTruthy();
    });
    expect(view.getByTestId('settings-cycle-preview').props.children).not.toMatch(/November/);
  });
});
