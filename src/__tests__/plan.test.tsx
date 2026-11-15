import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { DEFAULT_SETTINGS } from '@/data/repo';
import { buildDefaultCategories } from '@/domain/categories';
import { todayLocalDate } from '@/domain/dates';
import { formatCycleLabel, getPeriod } from '@/domain/period';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';
import PlanScreen from '@/app/(tabs)/plan';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    back: jest.fn(),
    canGoBack: () => true,
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

async function setupPlanRepo(options?: { withBudgets?: boolean }) {
  const repo = new MemoryRepo();
  for (const cat of buildDefaultCategories(1)) {
    await repo.upsertCategory(cat);
  }
  await repo.insertAccount({
    id: 'acc_cash',
    name: 'Cash',
    kind: 'cash',
    colorKey: '#123227',
    openingBalanceMinor: 500_000,
    openingDate: '2026-11-01',
  });
  const today = todayLocalDate();
  const period = getPeriod(today, DEFAULT_SETTINGS.monthStartDay);

  await repo.insertTransaction({
    id: 'tx_food',
    type: 'expense',
    amountMinor: 35_000,
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: 'acc_cash',
    description: 'Lunch',
    occurredOn: today,
    occurredTime: '13:00',
  });

  if (options?.withBudgets) {
    await repo.setBudget(period.start, '', 3_000_000);
    await repo.setBudget(period.start, 'food_dining', 1_000);
  }
  return repo;
}

function renderPlan(repo: MemoryRepo) {
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
          <PlanScreen />
        </AppContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('PlanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('en');
  });

  afterAll(() => {
    setLocale('en');
  });

  it('sets and removes an overall budget via the keypad sheet', async () => {
    const repo = await setupPlanRepo({ withBudgets: false });
    const view = await renderPlan(repo);

    await waitFor(() => {
      expect(view.getByTestId('budget-empty-overall')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByText('Set monthly budget'));
    });
    for (const digit of ['3', '0', '0', '0', '0']) {
      await act(async () => {
        fireEvent.press(view.getByTestId(`budget-sheet-keypad-key-${digit}`));
      });
    }
    await act(async () => {
      fireEvent.press(view.getByTestId('budget-sheet-save-btn'));
    });

    await waitFor(() => {
      expect(view.getByTestId('budget-overall-ring')).toBeTruthy();
      expect(view.getByTestId('budget-ring-remaining').props.numberOfLines).toBe(1);
      expect(view.getByTestId('budget-ring-remaining').props.accessibilityLabel).toBe('৳29,650');
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('budget-edit-overall-btn'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('budget-sheet-remove-btn'));
    });

    await waitFor(() => {
      expect(view.getByTestId('budget-empty-overall')).toBeTruthy();
    });
  });

  it('localizes cycle label in Bangla, prevents Fabric category/CTA clipping, and navigates to insights', async () => {
    setLocale('bn');
    const repo = await setupPlanRepo({ withBudgets: true });
    const period = getPeriod(todayLocalDate(), DEFAULT_SETTINGS.monthStartDay);
    const expectedMonth = formatCycleLabel(period, DEFAULT_SETTINGS.monthStartDay, { locale: 'bn' });

    const view = await renderPlan(repo);

    await waitFor(() => {
      expect(view.getByText(expectedMonth)).toBeTruthy();
      expect(view.getByTestId('budget-cat-row-food_dining')).toBeTruthy();
    });

    const catHeader = view.getByText('ক্যাটাগরি বাজেট');
    expect(catHeader.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(catHeader.props.style).minWidth).toBeGreaterThan(100);

    const addCatText = view.getByText('ক্যাটাগরি বাজেট যোগ করুন');
    expect(addCatText.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(addCatText.props.style).minWidth).toBeGreaterThan(150);

    await act(async () => {
      fireEvent.press(view.getByTestId('budget-past-cycles-toggle'));
    });
    await waitFor(() => {
      expect(
        view.getByText('আগের মাসগুলোর বাজেট বা খরচের তথ্য জমলে এখানে দেখা যাবে।')
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('plan-insights-row'));
    });
    expect(mockPush).toHaveBeenCalledWith('/plan/insights');
  });
});
