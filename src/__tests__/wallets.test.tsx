import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ManageWalletsScreen from '@/app/wallets/index';
import { MemoryRepo } from '@/data/memoryRepo';
import { addDays, todayLocalDate } from '@/domain/dates';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

let mockCanGoBack = true;
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
  },
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => ({}),
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

async function setupWalletsRepo() {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('currency', 'BDT');
  const yesterday = addDays(todayLocalDate(), -1);

  await repo.insertAccount({
    id: 'acc_cash',
    name: 'Cash',
    kind: 'cash',
    colorKey: '#123227',
    openingBalanceMinor: 415_000,
    openingDate: yesterday,
    sortOrder: 0,
  });
  await repo.insertAccount({
    id: 'acc_card',
    name: 'Card',
    kind: 'credit_card',
    colorKey: '#334155',
    last4: '4821',
    openingBalanceMinor: -560_000,
    openingDate: yesterday,
    includeInTotal: true,
    sortOrder: 1,
  });
  await repo.insertTransaction({
    id: 'tx_untagged',
    type: 'expense',
    amountMinor: 25_000,
    currency: 'BDT',
    categoryId: 'cat_food',
    accountId: null,
    occurredOn: yesterday,
    occurredTime: '14:00',
    description: 'Tea',
    source: 'manual',
  });
  return repo;
}

async function renderWalletsScreen(repo: MemoryRepo) {
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
          <ManageWalletsScreen />
        </ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('ManageWalletsScreen and WalletEditorSheet', () => {
  beforeEach(() => {
    setLocale('en');
    mockCanGoBack = true;
    mockBack.mockClear();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  afterAll(() => {
    setLocale('en');
  });

  it('renders wallet list, localized card metadata, archive/restore flow, and back fallback', async () => {
    const repo = await setupWalletsRepo();
    const view = await renderWalletsScreen(repo);

    await waitFor(() => {
      expect(view.getByText('Cash')).toBeTruthy();
    });

    expect(view.getByText('Ending 4821')).toBeTruthy();
    expect(view.getByText('৳5,600 due')).toBeTruthy();

    await fireEvent.press(view.getByTestId('wallet-edit-acc_card'));
    await waitFor(() => {
      expect(view.getByTestId('wallet-editor-sheet')).toBeTruthy();
    });

    expect(view.getByTestId('wallet-last4-input')).toBeTruthy();
    expect(view.getByText('Amount due (−)')).toBeTruthy();

    await fireEvent.press(view.getByTestId('wallet-archive-button'));
    await fireEvent.press(view.getByTestId('wallet-confirm-archive-button'));
    await waitFor(() => {
      expect(view.getByText('Archived wallets')).toBeTruthy();
      expect(view.getByTestId('restore-wallet-acc_card')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('restore-wallet-acc_card'));
    await waitFor(() => {
      expect(view.queryByTestId('restore-wallet-acc_card')).toBeNull();
    });

    mockCanGoBack = false;
    await fireEvent.press(view.getByTestId('wallets-back-btn'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('localizes due suffix, card last4, editor kinds, sign pill, and tag-older dates into Bangla', async () => {
    setLocale('bn');
    const repo = await setupWalletsRepo();
    const view = await renderWalletsScreen(repo);

    await waitFor(() => {
      expect(view.getByText('ক্যাশ')).toBeTruthy();
    });

    expect(view.getByText('শেষ ৪ সংখ্যা ৪৮২১')).toBeTruthy();
    const dueBalEl = view.getByText('৳৫,৬০০ বকেয়া');
    expect(dueBalEl).toBeTruthy();
    expect(StyleSheet.flatten(dueBalEl.props.style)?.minWidth).toBeGreaterThan(0);

    await fireEvent.press(view.getByTestId('wallets-tag-older-row'));
    await waitFor(() => {
      expect(view.getByTestId('tag-older-entries-sheet')).toBeTruthy();
    });
    expect(view.getByText('গতকাল')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Close'));

    await fireEvent.press(view.getByTestId('wallet-edit-acc_card'));
    await waitFor(() => {
      expect(view.getByTestId('wallet-editor-sheet')).toBeTruthy();
    });

    expect(view.getByText('নগদ')).toBeTruthy();
    expect(view.getByText('মোবাইল')).toBeTruthy();
    expect(view.getByText('ব্যাংক')).toBeTruthy();
    expect(view.getAllByText('কার্ড').length).toBeGreaterThanOrEqual(1);
    expect(view.getByText('অন্যান্য')).toBeTruthy();
    expect(view.getByText('বকেয়া আছে (−)')).toBeTruthy();

    await fireEvent.press(view.getByTestId('wallet-negative-toggle'));
    expect(view.getByText('জমা ব্যালেন্স (+)')).toBeTruthy();
  });
});
