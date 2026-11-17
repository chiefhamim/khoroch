import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { DEFAULT_SETTINGS } from '@/data/repo';
import { buildDefaultCategories } from '@/domain/categories';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';
import QuickEntryScreen from '@/app/quick-entry';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockPush = jest.fn();
const mockReplace = jest.fn();

let mockUuidSeq = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `test-uuid-${++mockUuidSeq}-1234-5678-90abcdef`,
}));

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) =>
      reactMod.createElement(rnMod.View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

async function setupSeededRepo() {
  const repo = new MemoryRepo();
  for (const cat of buildDefaultCategories(1)) {
    await repo.upsertCategory(cat);
  }
  await repo.insertAccount({
    id: 'acc_cash',
    name: 'Cash',
    kind: 'cash',
    colorKey: '#123227',
    openingBalanceMinor: 100_000,
    openingDate: '2026-11-10',
  });
  await repo.insertAccount({
    id: 'acc_bkash',
    name: 'bKash',
    kind: 'mobile_wallet',
    provider: 'bkash',
    colorKey: '#E2136E',
    openingBalanceMinor: 500_000,
    openingDate: '2026-11-10',
  });
  return repo;
}

function renderWithProviders(repo: MemoryRepo) {
  return render(
    <ThemeProvider preference="light">
      <ToastProvider>
        <AppContext.Provider
          value={{
            repo,
            backend: 'memory',
            settings: DEFAULT_SETTINGS,
            updateSetting: async () => {},
            refreshSettings: async () => {},
          }}
        >
          <QuickEntryScreen />
        </AppContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('QuickEntryScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it('parses multiple entries, prioritizes selected category, and saves to SQLite repo on confirm', async () => {
    const repo = await setupSeededRepo();
    const view = await renderWithProviders(repo);

    await waitFor(() => expect(view.getByTestId('quick-entry-input')).toBeTruthy());

    await fireEvent.changeText(
      view.getByTestId('quick-entry-input'),
      'Spent 500 on Uber and 200 on coffee'
    );
    await fireEvent.press(view.getByTestId('quick-entry-parse-btn'));

    expect(view.getByTestId('quick-draft-0')).toBeTruthy();
    expect(view.getByTestId('quick-draft-1')).toBeTruthy();
    expect(view.getByTestId('quick-entry-confirm-btn')).toBeTruthy();

    // Selected category chip on draft 0 should be prioritized first
    expect(view.getByTestId('quick-draft-0-cat-transportation').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true })
    );

    await fireEvent.press(view.getByTestId('quick-entry-confirm-btn'));

    await waitFor(async () => {
      const txs = await repo.listAllActiveTransactions();
      expect(txs).toHaveLength(2);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('validates invalid transfer fee inline and supports Bangla multi-entry parsing', async () => {
    const repo = await setupSeededRepo();
    setLocale('bn');
    try {
      const view = await renderWithProviders(repo);

      await waitFor(() => expect(view.getByTestId('quick-entry-input')).toBeTruthy());

      await fireEvent.changeText(view.getByTestId('quick-entry-input'), 'cash out 500 bkash');
      await fireEvent.press(view.getByTestId('quick-entry-parse-btn'));

      expect(view.getByTestId('quick-draft-fee-0')).toBeTruthy();
      await fireEvent.changeText(view.getByTestId('quick-draft-fee-0'), '12..5');
      await fireEvent.press(view.getByTestId('quick-entry-confirm-btn'));

      expect(view.getByTestId('quick-draft-needs-fee-0')).toBeTruthy();
      expect(view.getByTestId('quick-entry-save-error')).toBeTruthy();

      await fireEvent.changeText(view.getByTestId('quick-entry-input'), 'উবারে ৫০০ আর কফিতে ২০০ খরচ');
      await fireEvent.press(view.getByTestId('quick-entry-parse-btn'));

      expect(view.getByTestId('quick-draft-0')).toBeTruthy();
      expect(view.getByTestId('quick-draft-1')).toBeTruthy();
      expect(view.getByText('নিশ্চিত ও সেভ করুন (২)')).toBeTruthy();
    } finally {
      await act(async () => {
        setLocale('en');
      });
    }
  });
});

describe('QuickEntryScreen transfer fee default', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  async function setupRepoWithRate(rateBp: number | null) {
    const repo = new MemoryRepo();
    for (const cat of buildDefaultCategories(1)) {
      await repo.upsertCategory(cat);
    }
    await repo.insertAccount({
      id: 'acc_cash',
      name: 'Cash',
      kind: 'cash',
      colorKey: '#123227',
      openingBalanceMinor: 100_000,
      openingDate: '2026-11-10',
    });
    await repo.insertAccount({
      id: 'acc_bkash',
      name: 'bKash',
      kind: 'mobile_wallet',
      provider: 'bkash',
      colorKey: '#E2136E',
      defaultFeeBp: rateBp,
      openingBalanceMinor: 500_000,
      openingDate: '2026-11-10',
    });
    await repo.insertAccount({
      id: 'acc_bank',
      name: 'City Bank',
      kind: 'bank',
      colorKey: '#1D4ED8',
      openingBalanceMinor: 500_000,
      openingDate: '2026-11-10',
    });
    return repo;
  }

  async function parseCashOut(repo: MemoryRepo) {
    const view = await renderWithProviders(repo);
    await waitFor(() => expect(view.getByTestId('quick-entry-input')).toBeTruthy());
    await fireEvent.changeText(view.getByTestId('quick-entry-input'), 'cash out 500 bkash');
    await fireEvent.press(view.getByTestId('quick-entry-parse-btn'));
    expect(view.getByTestId('quick-draft-fee-0')).toBeTruthy();
    return view;
  }

  it('pre-fills the cash-out fee, keeps a typed fee, keeps a cleared fee, and offers the way back', async () => {
    const repo = await setupRepoWithRate(185);
    const view = await parseCashOut(repo);

    // Untouched: the default shows with its source caption, and no way-back button yet.
    expect(view.getByTestId('quick-draft-fee-0').props.value).toBe('9.25');
    expect(view.getByTestId('quick-draft-fee-source-0')).toBeTruthy();
    expect(view.queryByTestId('quick-draft-fee-use-default-0')).toBeNull();

    // Untouched follows the amount.
    await fireEvent.changeText(view.getByTestId('quick-draft-amount-0'), '1000');
    expect(view.getByTestId('quick-draft-fee-0').props.value).toBe('18.5');

    // Typed: never overwritten when the amount changes.
    await fireEvent.changeText(view.getByTestId('quick-draft-fee-0'), '20');
    await fireEvent.changeText(view.getByTestId('quick-draft-amount-0'), '2000');
    expect(view.getByTestId('quick-draft-fee-0').props.value).toBe('20');
    expect(view.queryByTestId('quick-draft-fee-source-0')).toBeNull();
    const useDefault = view.getByTestId('quick-draft-fee-use-default-0');
    expect(useDefault.props.accessibilityRole).toBe('button');
    expect(useDefault.props.accessibilityLabel).toBe('Use 1.85% default');

    // Cleared: stays empty after an amount change and saves no fee.
    await fireEvent.changeText(view.getByTestId('quick-draft-fee-0'), '');
    await fireEvent.changeText(view.getByTestId('quick-draft-amount-0'), '3000');
    expect(view.getByTestId('quick-draft-fee-0').props.value).toBe('');
    expect(view.getByTestId('quick-draft-fee-use-default-0')).toBeTruthy();

    await fireEvent.press(view.getByTestId('quick-entry-confirm-btn'));
    await waitFor(async () => {
      const transfers = await repo.listTransfers();
      expect(transfers).toHaveLength(1);
      expect(transfers[0].amountMinor).toBe(300_000);
      expect(transfers[0].feeMinor).toBe(0);
    });
  });

  it('way-back button restores the default and the saved fee is the default', async () => {
    const repo = await setupRepoWithRate(185);
    const view = await parseCashOut(repo);

    await fireEvent.changeText(view.getByTestId('quick-draft-fee-0'), '');
    expect(view.getByTestId('quick-draft-fee-0').props.value).toBe('');
    await fireEvent.press(view.getByTestId('quick-draft-fee-use-default-0'));
    expect(view.getByTestId('quick-draft-fee-0').props.value).toBe('9.25');
    expect(view.queryByTestId('quick-draft-fee-use-default-0')).toBeNull();

    await fireEvent.press(view.getByTestId('quick-entry-confirm-btn'));
    await waitFor(async () => {
      const transfers = await repo.listTransfers();
      expect(transfers).toHaveLength(1);
      expect(transfers[0].feeMinor).toBe(925);
    });
  });

  it('warns, without blocking, when the typed fee is larger than the amount', async () => {
    const repo = await setupRepoWithRate(185);
    const view = await parseCashOut(repo);
    expect(view.queryByTestId('quick-draft-fee-large-0')).toBeNull();

    await fireEvent.changeText(view.getByTestId('quick-draft-fee-0'), '500');
    expect(view.queryByTestId('quick-draft-fee-large-0')).toBeNull();
    await fireEvent.changeText(view.getByTestId('quick-draft-fee-0'), '600');
    expect(view.getByTestId('quick-draft-fee-large-0')).toBeTruthy();
    expect(view.getByText('Fee is larger than the amount')).toBeTruthy();

    await fireEvent.press(view.getByTestId('quick-entry-confirm-btn'));
    await waitFor(async () => {
      const transfers = await repo.listTransfers();
      expect(transfers).toHaveLength(1);
      expect(transfers[0].amountMinor).toBe(50_000);
      expect(transfers[0].feeMinor).toBe(60_000);
    });
  });

  it('gives no pre-fill when the destination is a bank, and none without a rate', async () => {
    const repo = await setupRepoWithRate(185);
    const view = await parseCashOut(repo);
    expect(view.getByTestId('quick-draft-fee-0').props.value).toBe('9.25');

    await fireEvent.press(view.getByTestId('quick-draft-0-to-wallet-acc_bank'));
    expect(view.getByTestId('quick-draft-fee-0').props.value).toBe('');
    expect(view.queryByTestId('quick-draft-fee-source-0')).toBeNull();
    expect(view.queryByTestId('quick-draft-fee-use-default-0')).toBeNull();

    const repo2 = await setupRepoWithRate(null);
    const view2 = await parseCashOut(repo2);
    expect(view2.getByTestId('quick-draft-fee-0').props.value).toBe('');
    expect(view2.queryByTestId('quick-draft-fee-source-0')).toBeNull();
  });
});
