import React from 'react';
import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { DEFAULT_SETTINGS } from '@/data/repo';
import type { Settings } from '@/domain/types';
import { AppContext } from './AppContext';
import { bumpDataVersion } from './dataVersion';
import { BILL_REMINDER_SYNC_DEBOUNCE_MS, useBillReminderSync } from './useBillReminderSync';

const mockSync = jest.fn<
  Promise<{ scheduled: number; permissionMissing?: boolean; permission?: 'denied' | 'undetermined' }>,
  [unknown]
>(
  async () => ({ scheduled: 0 })
);

jest.mock('@/notifications/billReminders', () => ({
  syncBillReminders: (input: unknown) => mockSync(input),
}));

const makeSettings = (over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  onboardingDone: true,
  billReminders: { enabled: true, leadDays: 1 },
  ...over,
});

function setup(settings: Settings, updateSetting = jest.fn(async () => {})) {
  const repo = new MemoryRepo();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppContext.Provider
      value={{
        repo,
        backend: 'memory',
        settings,
        updateSetting: updateSetting as never,
        refreshSettings: async () => {},
      }}
    >
      {children}
    </AppContext.Provider>
  );
  return { wrapper, updateSetting };
}

async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(BILL_REMINDER_SYNC_DEBOUNCE_MS + 10);
  });
}

describe('useBillReminderSync', () => {
  let appStateListener: ((state: string) => void) | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    mockSync.mockClear();
    mockSync.mockImplementation(async () => ({ scheduled: 0 }));
    appStateListener = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      cb: (state: string) => void
    ) => {
      appStateListener = cb;
      return { remove: () => {} };
    }) as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs once on start', async () => {
    const { wrapper } = setup(makeSettings());
    await renderHook(() => useBillReminderSync(), { wrapper });
    expect(mockSync).not.toHaveBeenCalled();
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync.mock.calls[0][0]).toMatchObject({ enabled: true, hideNames: false });
  });

  it('twenty rapid data changes cause one run', async () => {
    const { wrapper } = setup(makeSettings());
    await renderHook(() => useBillReminderSync(), { wrapper });
    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        bumpDataVersion();
        jest.advanceTimersByTime(20);
      });
    }
    expect(mockSync).not.toHaveBeenCalled();
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it('runs again when the app returns to the foreground', async () => {
    const { wrapper } = setup(makeSettings());
    await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
    await act(async () => {
      appStateListener?.('active');
    });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(2);
  });

  it('when off, cleans up once and then skips every later change', async () => {
    const { wrapper } = setup(makeSettings({ billReminders: { enabled: false, leadDays: 1 } }));
    await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync.mock.calls[0][0]).toMatchObject({ enabled: false });
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        bumpDataVersion();
      });
    }
    await act(async () => {
      appStateListener?.('active');
    });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it('leaves settings alone when permission is granted', async () => {
    mockSync.mockResolvedValue({ scheduled: 1 });
    const { wrapper, updateSetting } = setup(makeSettings());
    await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(updateSetting).not.toHaveBeenCalled();
  });

  it('turns the switch off but does not mark denied when the phone was never asked', async () => {
    mockSync.mockResolvedValue({ scheduled: 0, permissionMissing: true, permission: 'undetermined' });
    const { wrapper, updateSetting } = setup(makeSettings());
    await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(updateSetting).toHaveBeenCalledTimes(1);
    expect(updateSetting).toHaveBeenCalledWith('billReminders', { enabled: false, leadDays: 1 });
    expect(updateSetting).not.toHaveBeenCalledWith('notificationPermissionDenied', true);
  });

  it('clears a wrongly set denied flag when the phone was never asked', async () => {
    mockSync.mockResolvedValue({ scheduled: 0, permissionMissing: true, permission: 'undetermined' });
    const { wrapper, updateSetting } = setup(makeSettings({ notificationPermissionDenied: true }));
    await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(updateSetting).toHaveBeenCalledWith('notificationPermissionDenied', false);
    expect(updateSetting).toHaveBeenCalledTimes(2);
    expect(updateSetting).not.toHaveBeenCalledWith('notificationPermissionDenied', true);
  });

  it('does not write the denied flag when it is already false and the phone was never asked', async () => {
    mockSync.mockResolvedValue({ scheduled: 0, permissionMissing: true, permission: 'undetermined' });
    const { wrapper, updateSetting } = setup(makeSettings({ notificationPermissionDenied: false }));
    await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(updateSetting).not.toHaveBeenCalledWith('notificationPermissionDenied', false);
  });

  it('turns the setting off and marks denied when notification permission is really denied', async () => {
    mockSync.mockResolvedValue({ scheduled: 0, permissionMissing: true, permission: 'denied' });
    const { wrapper, updateSetting } = setup(
      makeSettings({ billReminders: { enabled: true, leadDays: 3, hideNames: true } })
    );
    await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(updateSetting).toHaveBeenCalledWith('billReminders', {
      enabled: false,
      leadDays: 3,
      hideNames: true,
    });
    // The denied state is recorded too, so settings shows the blocked row and its button.
    expect(updateSetting).toHaveBeenCalledWith('notificationPermissionDenied', true);
    expect(updateSetting).toHaveBeenCalledTimes(2);
  });

  it('runs at once, without the debounce, when hiding names turns on', async () => {
    const repo = new MemoryRepo();
    let current = makeSettings();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppContext.Provider
        value={{
          repo,
          backend: 'memory',
          settings: current,
          updateSetting: (async () => {}) as never,
          refreshSettings: async () => {},
        }}
      >
        {children}
      </AppContext.Provider>
    );
    const { rerender } = await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync.mock.calls[0][0]).toMatchObject({ hideNames: false });

    current = makeSettings({ billReminders: { enabled: true, leadDays: 1, hideNames: true } });
    await act(async () => {
      rerender({});
    });
    // No timers advanced: the run already happened.
    expect(mockSync).toHaveBeenCalledTimes(2);
    expect(mockSync.mock.calls[1][0]).toMatchObject({ hideNames: true });

    // Turning another setting later is debounced as usual.
    current = makeSettings({ billReminders: { enabled: true, leadDays: 3, hideNames: true } });
    await act(async () => {
      rerender({});
    });
    expect(mockSync).toHaveBeenCalledTimes(2);
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(3);
  });

  it('does not touch the setting when permission is fine', async () => {
    const { wrapper, updateSetting } = setup(makeSettings());
    await renderHook(() => useBillReminderSync(), { wrapper });
    await flush();
    expect(updateSetting).not.toHaveBeenCalled();
  });

  it('hides bill names when app lock is on, or when the setting is on', async () => {
    const locked = setup(makeSettings({ appLockEnabled: true }));
    await renderHook(() => useBillReminderSync(), { wrapper: locked.wrapper });
    await flush();
    expect(mockSync.mock.calls[0][0]).toMatchObject({ hideNames: true });

    mockSync.mockClear();
    const hidden = setup(makeSettings({ billReminders: { enabled: true, leadDays: 1, hideNames: true } }));
    await renderHook(() => useBillReminderSync(), { wrapper: hidden.wrapper });
    await flush();
    expect(mockSync.mock.calls[0][0]).toMatchObject({ hideNames: true });
  });
});
