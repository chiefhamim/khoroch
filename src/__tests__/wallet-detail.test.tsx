import React from 'react';
import { StyleSheet } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import WalletDetailScreen from '@/app/wallets/[id]';
import { MemoryRepo } from '@/data/memoryRepo';
import { addDays, todayLocalDate } from '@/domain/dates';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

let mockCanGoBack = true;
let mockWalletId = 'acc_card';
let mockUuidSeq = 0;
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-crypto', () => ({
  randomUUID: () => `tx_adjust_${++mockUuidSeq}_12345678`,
}));

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
  useLocalSearchParams: () => ({ id: mockWalletId }),
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

async function setupWalletDetailRepo() {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('currency', 'BDT');
  const today = todayLocalDate();
  const yesterday = addDays(today, -1);
  const olderDay = addDays(today, -4);

  await repo.upsertCategory({
    id: 'cat_food',
    name: 'Food',
    icon: 'utensils',
    colorKey: 'orange',
    kind: 'expense',
    sortOrder: 0,
    isSelected: true,
    archivedAt: null,
    createdAt: Date.now(),
  });

  await repo.insertAccount({
    id: 'acc_card',
    name: 'City Card',
    kind: 'credit_card',
    colorKey: '#334155',
    last4: '4821',
    openingBalanceMinor: -560_000,
    openingDate: yesterday,
    includeInTotal: false,
    sortOrder: 0,
  });

  await repo.insertPerson({
    id: 'person_tanvir',
    name: 'Tanvir',
    honorific: 'bhai',
    colorKey: 'blue',
  });

  await repo.insertTransaction({
    id: 'tx_before_open',
    type: 'expense',
    amountMinor: 35_000,
    currency: 'BDT',
    categoryId: 'cat_food',
    accountId: 'acc_card',
    occurredOn: olderDay,
    occurredTime: null,
    description: 'Dinner before opening',
    source: 'manual',
  });

  await repo.insertDueEntry({
    id: 'due_tanvir',
    personId: 'person_tanvir',
    kind: 'lent',
    amountMinor: 50_000,
    accountId: 'acc_card',
    occurredOn: olderDay,
    occurredTime: null,
    note: 'Ticket',
  });

  return repo;
}

async function renderWalletDetail(repo: MemoryRepo) {
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
          <WalletDetailScreen />
        </ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('WalletDetailScreen', () => {
  beforeEach(() => {
    setLocale('en');
    mockCanGoBack = true;
    mockWalletId = 'acc_card';
    mockBack.mockClear();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  it('renders localized card due, chart, feed items, balance adjustment, and back fallback', async () => {
    const repo = await setupWalletDetailRepo();
    const view = await renderWalletDetail(repo);

    await waitFor(() => {
      expect(view.getByTestId('wallet-detail-balance')).toBeTruthy();
    });

    expect(view.getByText('City Card')).toBeTruthy();
    expect(view.getByText('৳5,600 due')).toBeTruthy();
    expect(view.getByText('Opening -৳ 5,600 · Yesterday')).toBeTruthy();
    expect(view.getByText('Ending 4821')).toBeTruthy();
    expect(view.getByText('Excluded')).toBeTruthy();
    expect(view.getByText('Balance trend')).toBeTruthy();
    expect(view.getByText('Today · ৳5,600 due')).toBeTruthy();
    expect(view.getByText('Lent to Tanvir')).toBeTruthy();
    expect(view.getAllByText(/Before opening/).length).toBe(2);

    await fireEvent.press(view.getByTestId('wallet-adjust-balance'));
    await waitFor(() => {
      expect(view.getByTestId('adjust-balance-keypad')).toBeTruthy();
    });
    await fireEvent.press(view.getByTestId('adjust-balance-keypad-key-1'));
    await fireEvent.press(view.getByTestId('adjust-balance-keypad-key-0'));
    await fireEvent.press(view.getByTestId('adjust-balance-keypad-key-0'));
    await fireEvent.press(view.getByTestId('adjust-balance-keypad-key-0'));
    await fireEvent.press(view.getByTestId('adjust-balance-save'));

    await waitFor(async () => {
      const txs = await repo.listAllActiveTransactions();
      expect(txs.some((tx) => tx.description === 'Balance adjustment')).toBe(true);
    });

    mockCanGoBack = false;
    await fireEvent.press(view.getByTestId('wallet-detail-back'));
    expect(mockReplace).toHaveBeenCalledWith('/wallets');
  });

  it('localizes hero, chart, and feed cleanly in Bangla without double middots or Fabric clipping', async () => {
    setLocale('bn');
    const repo = await setupWalletDetailRepo();
    const view = await renderWalletDetail(repo);

    await waitFor(() => {
      expect(view.getByText('ব্যালেন্সের ধারা')).toBeTruthy();
    });

    expect(view.getByText('৳5,600 বকেয়া')).toBeTruthy();
    expect(view.getByText('শুরুতে -৳ 5,600 · গতকাল')).toBeTruthy();
    expect(view.getByText('শেষ ৪ সংখ্যা 4821')).toBeTruthy();
    expect(view.getByText('বহির্ভূত')).toBeTruthy();
    expect(view.getByText('আজ · ৳5,600 বকেয়া')).toBeTruthy();
    expect(view.getByText('Tanvir-কে ধার দেওয়া হয়েছে')).toBeTruthy();
    expect(view.getAllByText(/শুরুর তারিখের আগে/).length).toBe(2);

    const chartLabel = StyleSheet.flatten(view.getByText('ব্যালেন্সের ধারা').props.style);
    expect(chartLabel.minWidth).toBeGreaterThan(0);

    const excludedLabel = StyleSheet.flatten(view.getByText('বহির্ভূত').props.style);
    expect(excludedLabel.minWidth).toBeGreaterThan(0);
  });
});
