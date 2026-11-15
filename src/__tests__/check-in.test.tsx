import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { DEFAULT_SETTINGS } from '@/data/repo';
import { buildDefaultCategories } from '@/domain/categories';
import { formatWeekdayShortDate, todayLocalDate } from '@/domain/dates';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';
import CheckInScreen from '@/app/check-in';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
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

async function setupRepo(withTodayTxs = false) {
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
  if (withTodayTxs) {
    const today = todayLocalDate();
    await repo.insertTransaction({
      id: 'tx_1',
      type: 'expense',
      amountMinor: 35_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      accountId: 'acc_cash',
      description: 'Lunch',
      occurredOn: today,
      occurredTime: '13:30',
    });
    await repo.insertTransaction({
      id: 'tx_2',
      type: 'income',
      amountMinor: 150_000,
      currency: 'BDT',
      categoryId: 'salary',
      accountId: 'acc_cash',
      description: 'Bonus',
      occurredOn: today,
      occurredTime: '10:00',
    });
  }
  return repo;
}

function renderCheckIn(repo: MemoryRepo) {
  return render(
    <ThemeProvider preference="dark">
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
          <CheckInScreen />
        </AppContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('CheckInScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  it('localizes weekday date header in Bangla and marks day reviewed on done tap', async () => {
    const repo = await setupRepo(false);
    const today = todayLocalDate();
    setLocale('bn');
    try {
      const view = await renderCheckIn(repo);
      await waitFor(() => expect(view.getByTestId('check-in-done-btn')).toBeTruthy());

      expect(view.getByText(formatWeekdayShortDate(today, 'bn'))).toBeTruthy();
      expect(view.getByTestId('check-in-tx-count').props.children).toBe(0);

      await fireEvent.press(view.getByTestId('check-in-done-btn'));

      await waitFor(async () => {
        expect(await repo.isDayReviewed(today)).toBe(true);
      });
      expect(view.getByTestId('check-in-reviewed-badge')).toBeTruthy();
      expect(view.getAllByText('আজকের হিসাব মেলানো হয়েছে').length).toBeGreaterThanOrEqual(1);
      expect(view.getByText('হিসাব মেলানো হয়েছে ✓')).toBeTruthy();
    } finally {
      await act(async () => {
        setLocale('en');
      });
    }
  });

  it('sums today expenses and income accurately and navigates to entry screens', async () => {
    const repo = await setupRepo(true);
    const view = await renderCheckIn(repo);

    await waitFor(() => expect(view.getByText('Lunch')).toBeTruthy());
    expect(view.getByText('Bonus')).toBeTruthy();
    expect(view.getByTestId('check-in-tx-count').props.children).toBe(2);

    await fireEvent.press(view.getByTestId('check-in-add-btn'));
    expect(mockPush).toHaveBeenCalledWith('/transaction/new');

    await fireEvent.press(view.getByTestId('check-in-quick-entry-btn'));
    expect(mockPush).toHaveBeenCalledWith('/quick-entry');
  });
});
