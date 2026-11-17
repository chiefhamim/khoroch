import React, { useState } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings/index';
import { MemoryRepo } from '@/data/memoryRepo';
import type { Settings } from '@/domain/types';
import { setLocale, t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
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

const mockStatus = jest.fn<Promise<string>, []>(async () => 'granted');
const mockRequest = jest.fn<Promise<string>, []>(async () => 'granted');
const mockSupported = jest.fn(() => true);

jest.mock('@/notifications/reminders', () => ({
  getNotificationPermissionStatus: () => mockStatus(),
  isNotificationsSupported: () => mockSupported(),
  requestNotificationPermission: () => mockRequest(),
  syncReminderSchedule: jest.fn(async () => {}),
}));

function Harness({ repo, initial }: { repo: MemoryRepo; initial: Settings }) {
  const [settings, setSettings] = useState<Settings>(initial);
  return (
    <AppContext.Provider
      value={{
        repo,
        backend: 'memory',
        settings,
        updateSetting: async (key, value) => {
          await repo.setSetting(key, value);
          setSettings(await repo.getSettings());
        },
        refreshSettings: async () => {
          setSettings(await repo.getSettings());
        },
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

async function setup(billReminders?: Settings['billReminders']) {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  if (billReminders) await repo.setSetting('billReminders', billReminders);
  const view = await render(<Harness repo={repo} initial={await repo.getSettings()} />);
  await waitFor(() => expect(view.getByTestId('settings-bill-reminders-switch')).toBeTruthy());
  return { repo, view };
}

const switchChecked = (view: Awaited<ReturnType<typeof render>>) =>
  view.getByTestId('settings-bill-reminders-switch').props.accessibilityState.checked;

describe('Bill reminders in Settings', () => {
  beforeEach(() => {
    setLocale('en');
    mockStatus.mockReset().mockResolvedValue('granted');
    mockRequest.mockReset().mockResolvedValue('granted');
    mockSupported.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  it('is off by default, with a label and no timing row', async () => {
    const { view } = await setup();
    expect(view.getByText(t('settings.billRemindersToggle'))).toBeTruthy();
    expect(switchChecked(view)).toBe(false);
    expect(view.queryByTestId('settings-bill-lead-row')).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('turns on when permission is already granted, shows the timing row, and saves', async () => {
    const { repo, view } = await setup();
    await fireEvent.press(view.getByTestId('settings-bill-reminders-switch'));
    await waitFor(() => expect(switchChecked(view)).toBe(true));
    expect((await repo.getSettings()).billReminders).toEqual({ enabled: true, leadDays: 1 });
    expect(view.getByTestId('settings-bill-lead-row')).toBeTruthy();
    expect(view.getByText(t('settings.billRemindersLead1'))).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('asks for permission only when turned on, and turns on when it is allowed', async () => {
    mockStatus.mockResolvedValue('undetermined');
    const { repo, view } = await setup();
    expect(mockRequest).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('settings-bill-reminders-switch'));
    await waitFor(() => expect((mockRequest.mock.calls.length)).toBe(1));
    await waitFor(() => expect(switchChecked(view)).toBe(true));
    expect((await repo.getSettings()).billReminders.enabled).toBe(true);
  });

  it('stays off with a plain explanation when permission is refused', async () => {
    mockStatus.mockResolvedValue('undetermined');
    mockRequest.mockResolvedValue('denied');
    const { repo, view } = await setup();
    await fireEvent.press(view.getByTestId('settings-bill-reminders-switch'));
    await waitFor(() => expect(view.getByTestId('settings-bill-reminders-blocked')).toBeTruthy());
    expect(view.getByText(t('settings.billRemindersBlocked'))).toBeTruthy();
    expect(switchChecked(view)).toBe(false);
    expect((await repo.getSettings()).billReminders.enabled).toBe(false);
    expect(view.queryByTestId('settings-bill-lead-row')).toBeNull();
  });

  it('does not prompt when permission was already refused in system settings', async () => {
    mockStatus.mockResolvedValue('denied');
    const { repo, view } = await setup();
    await fireEvent.press(view.getByTestId('settings-bill-reminders-switch'));
    await waitFor(() => expect(view.getByTestId('settings-bill-reminders-blocked')).toBeTruthy());
    expect(mockRequest).not.toHaveBeenCalled();
    expect((await repo.getSettings()).billReminders.enabled).toBe(false);
  });

  it('turns off and clears the explanation', async () => {
    const { repo, view } = await setup({ enabled: true, leadDays: 3 });
    expect(switchChecked(view)).toBe(true);
    expect(view.getByText(t('settings.billRemindersLead3'))).toBeTruthy();
    await fireEvent.press(view.getByTestId('settings-bill-reminders-switch'));
    await waitFor(() => expect(switchChecked(view)).toBe(false));
    expect(await repo.getSettings().then((s) => s.billReminders)).toEqual({
      enabled: false,
      leadDays: 3,
    });
    expect(view.queryByTestId('settings-bill-lead-row')).toBeNull();
  });

  it('offers on the day, 1 day before and 3 days before in the sheet and saves the choice', async () => {
    const { repo, view } = await setup({ enabled: true, leadDays: 1 });
    await fireEvent.press(view.getByTestId('settings-bill-lead-row'));
    await waitFor(() => expect(view.getByTestId('settings-bill-lead-0')).toBeTruthy());
    expect(view.getByTestId('settings-bill-lead-1')).toBeTruthy();
    expect(view.getByTestId('settings-bill-lead-3')).toBeTruthy();
    await fireEvent.press(view.getByTestId('settings-bill-lead-3'));
    await waitFor(async () =>
      expect((await repo.getSettings()).billReminders).toEqual({ enabled: true, leadDays: 3 })
    );
    await waitFor(() => expect(view.getByText(t('settings.billRemindersLead3'))).toBeTruthy());
    await fireEvent.press(view.getByTestId('settings-bill-lead-row'));
    await waitFor(() => expect(view.getByTestId('settings-bill-lead-0')).toBeTruthy());
    await fireEvent.press(view.getByTestId('settings-bill-lead-0'));
    await waitFor(async () =>
      expect((await repo.getSettings()).billReminders.leadDays).toBe(0)
    );
  });

  it('saves the choice where notifications are not supported (web)', async () => {
    mockSupported.mockReturnValue(false);
    const { repo, view } = await setup();
    await fireEvent.press(view.getByTestId('settings-bill-reminders-switch'));
    await waitFor(() => expect(switchChecked(view)).toBe(true));
    expect((await repo.getSettings()).billReminders.enabled).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('renders the Bangla labels', async () => {
    setLocale('bn');
    const { view } = await setup({ enabled: true, leadDays: 0 });
    expect(view.getByText(t('settings.billRemindersToggle'))).toBeTruthy();
    expect(view.getByText('নির্ধারিত দিনে')).toBeTruthy();
  });
});
