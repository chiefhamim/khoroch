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
      expect(view.getByText('নিশ্চিত ও সেভ করুন (2)')).toBeTruthy();
    } finally {
      await act(async () => {
        setLocale('en');
      });
    }
  });
});
