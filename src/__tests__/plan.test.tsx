import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { DEFAULT_SETTINGS } from '@/data/repo';
import { buildDefaultCategories } from '@/domain/categories';
import { addDays, formatLocalDate, parseLocalDate, todayLocalDate } from '@/domain/dates';
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

  it('bills header: title shrinks and wraps, the Add button keeps its width and has the long label', async () => {
    const repo = await setupPlanRepo({ withBudgets: true });
    const view = await renderPlan(repo);
    await waitFor(() => {
      expect(view.getByTestId('plan-bills-header')).toBeTruthy();
    });

    const header = StyleSheet.flatten(view.getByTestId('plan-bills-header').props.style);
    expect(header.flexDirection).toBe('row');
    expect(header.flexWrap).toBeUndefined();

    const title = view.getByTestId('plan-bills-title');
    expect(title.props.numberOfLines).toBeUndefined();
    const titleStyle = StyleSheet.flatten(title.props.style);
    expect(titleStyle.flexShrink).toBe(1);
    expect(titleStyle.minWidth).toBe(0);

    const button = view.getByTestId('plan-add-bill-btn');
    expect(button.props.accessibilityLabel).toBe('Add bill or EMI');
    expect(StyleSheet.flatten(button.props.style).flexShrink).toBe(0);
    expect(view.getByText('Add')).toBeTruthy();
  });

  it('shows how many instalments an EMI is behind next to the payoff line', async () => {
    const repo = await setupPlanRepo({ withBudgets: true });
    const cur = parseLocalDate(getPeriod(todayLocalDate(), DEFAULT_SETTINGS.monthStartDay).start);
    const back = (months: number) => {
      const idx = cur.year * 12 + (cur.month - 1) - months;
      return formatLocalDate(Math.floor(idx / 12), (idx % 12) + 1, cur.day);
    };
    await repo.insertRecurringBill({
      id: 'bill_a',
      name: 'Phone',
      kind: 'emi',
      amountMinor: 100_000,
      dayOfMonth: 5,
      totalInstallments: 12,
      paidInstallments: 3,
      lastPaidPeriod: back(2),
    });
    await repo.insertRecurringBill({
      id: 'bill_b',
      name: 'Fridge',
      kind: 'emi',
      amountMinor: 100_000,
      dayOfMonth: 5,
      totalInstallments: 12,
      paidInstallments: 3,
      lastPaidPeriod: back(4),
    });
    await repo.insertRecurringBill({
      id: 'bill_c',
      name: 'Sofa',
      kind: 'emi',
      amountMinor: 100_000,
      dayOfMonth: 5,
      totalInstallments: 12,
      paidInstallments: 3,
      lastPaidPeriod: back(1),
    });
    const view = await renderPlan(repo);
    await waitFor(() => {
      expect(view.getByTestId('plan-bill-payoff-bill_a')).toBeTruthy();
    });
    expect(view.getByTestId('plan-bill-payoff-bill_a').props.accessibilityLabel).toContain(
      '1 instalment behind'
    );
    expect(view.getByTestId('plan-bill-payoff-bill_b').props.accessibilityLabel).toContain(
      '3 instalments behind'
    );
    expect(view.getByTestId('plan-bill-payoff-bill_c').props.accessibilityLabel).not.toContain(
      'behind'
    );
  });

  it('counts a payment stamped inside this period as paid even when it is not the period start', async () => {
    // A stamp left over from before the cycle day was changed: after the period start, not equal to it.
    const repo = await setupPlanRepo({ withBudgets: true });
    const period = getPeriod(todayLocalDate(), DEFAULT_SETTINGS.monthStartDay);
    const stamp = addDays(period.endExcl, -1);
    expect(stamp > period.start).toBe(true);
    await repo.insertRecurringBill({
      id: 'bill_paid',
      name: 'Water',
      kind: 'bill',
      amountMinor: 50_000,
      dayOfMonth: 5,
      lastPaidPeriod: stamp,
    });
    const view = await renderPlan(repo);
    await waitFor(() => {
      expect(view.getByText('Water')).toBeTruthy();
    });
    expect(view.queryByTestId('plan-bill-pay-bill_paid')).toBeNull();
    expect(view.getByText('Paid')).toBeTruthy();
  });
});
