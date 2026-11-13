import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { OverviewContent } from '@/app/(tabs)/index';
import { MemoryRepo } from '@/data/memoryRepo';
import { t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
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

describe('Overview Scenario A integration', () => {
  async function seedScenarioARepo(): Promise<MemoryRepo> {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('currency', 'BDT');
    await repo.setSetting('monthStartDay', 1);
    await repo.setSetting('name', 'Hamim');
    await repo.setBudget('2026-11-01', '', 4_000_000);

    await repo.insertTransaction({
      id: 'a1',
      type: 'expense',
      amountMinor: 650_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Dinner & Cafe',
      occurredOn: '2026-11-02',
    });
    await repo.insertTransaction({
      id: 'a2',
      type: 'expense',
      amountMinor: 280_000,
      currency: 'BDT',
      categoryId: 'transportation',
      description: 'Commute',
      occurredOn: '2026-11-04',
    });
    await repo.insertTransaction({
      id: 'a3',
      type: 'expense',
      amountMinor: 420_000,
      currency: 'BDT',
      categoryId: 'shopping',
      description: 'Clothing',
      occurredOn: '2026-11-07',
    });
    await repo.insertTransaction({
      id: 'a4',
      type: 'expense',
      amountMinor: 195_000,
      currency: 'BDT',
      categoryId: 'utilities',
      description: 'Electricity',
      occurredOn: '2026-11-10',
    });
    await repo.insertTransaction({
      id: 'a5',
      type: 'expense',
      amountMinor: 100_000,
      currency: 'BDT',
      categoryId: 'entertainment',
      description: 'Cinema',
      occurredOn: '2026-11-12',
    });
    await repo.insertTransaction({
      id: 'a6',
      type: 'income',
      amountMinor: 5_000_000,
      currency: 'BDT',
      categoryId: 'salary',
      description: 'November Salary',
      occurredOn: '2026-11-01',
    });
    await repo.insertTransaction({
      id: 'a7',
      type: 'expense',
      amountMinor: 300_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Deleted meal',
      occurredOn: '2026-11-11',
    });
    await repo.softDeleteTransaction('a7');
    await repo.insertTransaction({
      id: 'a8',
      type: 'expense',
      amountMinor: 999_900,
      currency: 'BDT',
      categoryId: 'shopping',
      description: 'Oct shopping',
      occurredOn: '2026-10-31',
    });
    await repo.insertTransaction({
      id: 'a9',
      type: 'expense',
      amountMinor: 10_000,
      currency: 'USD',
      categoryId: 'food_dining',
      description: 'USD lunch',
      occurredOn: '2026-11-05',
    });

    return repo;
  }

  it('renders Scenario A exact figures and re-queries live when dataVersion bumps', async () => {
    const repo = await seedScenarioARepo();
    const settings = await repo.getSettings();

    const view = await render(
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
          <OverviewContent todayOverride="2026-11-13" hourOverride={19} />
        </ThemeProvider>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(view.getByText(/৳ ?23,550/)).toBeTruthy();
    });

    expect(view.getByText('Good evening')).toBeTruthy();
    expect(view.getByText('Hamim · Fri, 13 Nov 2026')).toBeTruthy();
    expect(view.getByTestId('overview-settings-shortcut')).toBeTruthy();
    expect(view.getByText('H')).toBeTruthy();
    expect(view.getAllByText(/৳ ?16,450/).length).toBeGreaterThanOrEqual(1);
    expect(view.getByText('41.1% used')).toBeTruthy();
    expect(view.getByText(/৳ ?1,308\.33/)).toBeTruthy();
    expect(view.getByText(/৳ ?50,000/)).toBeTruthy();
    expect(view.getByText(t('status.ok'))).toBeTruthy();
    expect(view.queryByTestId('overview-new-cycle-banner')).toBeNull();
    expect(
      view.getByText(t('overview.ignoredCurrencyBanner', { count: 1 }))
    ).toBeTruthy();

    // Verify re-query without remounting after inserting a new expense
    await repo.insertTransaction({
      id: 'a10',
      type: 'expense',
      amountMinor: 35_000, // ৳350
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Coffee',
      occurredOn: '2026-11-13',
    });
    await act(async () => {
      bumpDataVersion();
    });

    await waitFor(() => {
      expect(view.getByText(/৳ ?23,200/)).toBeTruthy();
    });
    expect(view.getAllByText(/৳ ?16,800/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows new-cycle hint banner within first 7 days and inline no-budget invite when unset', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('currency', 'BDT');
    await repo.setSetting('monthStartDay', 10);
    await repo.setSetting('name', 'Hamim');

    // Prior cycle (10 Oct – 9 Nov): ৳4,600 spent
    await repo.insertTransaction({
      id: 'prev1',
      type: 'expense',
      amountMinor: 460_000,
      currency: 'BDT',
      categoryId: 'utilities',
      description: 'Internet',
      occurredOn: '2026-11-05',
    });
    // Current cycle (10 Nov – 9 Dec): ৳600 spent on Nov 11
    await repo.insertTransaction({
      id: 'cur1',
      type: 'expense',
      amountMinor: 60_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Lunch',
      occurredOn: '2026-11-11',
    });

    const settings = await repo.getSettings();
    const view = await render(
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
          <OverviewContent todayOverride="2026-11-13" hourOverride={14} />
        </ThemeProvider>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(view.getByTestId('hero-spent-no-budget')).toBeTruthy();
    });

    expect(view.getByTestId('overview-set-budget-inline')).toBeTruthy();
    expect(view.getByTestId('overview-new-cycle-banner')).toBeTruthy();
    expect(
      view.getByText(/New cycle started 10 Nov · Last cycle ৳ ?4,600/)
    ).toBeTruthy();
  });

  it('renders Wallets hero, tap-to-hide toggle, and Card due balance per v1.2 Scenario A', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('currency', 'BDT');
    await repo.setSetting('monthStartDay', 1);
    await repo.setSetting('name', 'Hamim');

    await repo.insertAccount({
      id: 'acc_bkash',
      name: 'bKash',
      kind: 'mobile_wallet',
      provider: 'bkash',
      colorKey: '#E2136E',
      monogram: 'bK',
      openingBalanceMinor: 1_000_000,
      openingDate: '2026-11-10',
      includeInTotal: true,
      sortOrder: 0,
    });
    await repo.insertAccount({
      id: 'acc_cash',
      name: 'Cash',
      kind: 'cash',
      colorKey: '#123227',
      openingBalanceMinor: 0,
      openingDate: '2026-11-10',
      includeInTotal: true,
      sortOrder: 1,
    });
    await repo.insertAccount({
      id: 'acc_card',
      name: 'Card',
      kind: 'credit_card',
      colorKey: '#334155',
      last4: '4821',
      openingBalanceMinor: -500_000,
      openingDate: '2026-11-01',
      includeInTotal: true,
      sortOrder: 2,
    });
    await repo.insertAccount({
      id: 'acc_savings',
      name: 'Savings',
      kind: 'bank',
      colorKey: '#1E40AF',
      openingBalanceMinor: 30_000_000,
      openingDate: '2026-11-01',
      includeInTotal: false,
      sortOrder: 3,
    });

    await repo.insertTransaction({
      id: 'e1',
      type: 'expense',
      amountMinor: 25_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      accountId: 'acc_cash',
      description: 'Lunch',
      occurredOn: '2026-11-09',
    });
    await repo.insertTransaction({
      id: 'e2',
      type: 'income',
      amountMinor: 250_000,
      currency: 'BDT',
      categoryId: 'salary',
      accountId: 'acc_bkash',
      description: 'Freelance',
      occurredOn: '2026-11-11',
    });
    await repo.insertTransaction({
      id: 'e4',
      type: 'expense',
      amountMinor: 35_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      accountId: 'acc_bkash',
      description: 'Coffee',
      occurredOn: '2026-11-12',
    });
    await repo.insertTransaction({
      id: 'e5',
      type: 'expense',
      amountMinor: 60_000,
      currency: 'BDT',
      categoryId: 'shopping',
      accountId: 'acc_card',
      description: 'Groceries card',
      occurredOn: '2026-11-12',
    });
    await repo.createTransfer({
      id: 't1',
      fromAccountId: 'acc_bkash',
      toAccountId: 'acc_cash',
      amountMinor: 100_000,
      feeMinor: 1_850,
      occurredOn: '2026-11-12',
    });

    const settings = await repo.getSettings();
    const view = await render(
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
          <OverviewContent todayOverride="2026-11-13" hourOverride={14} />
        </ThemeProvider>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(view.getByTestId('hero-wallets-total')).toBeTruthy();
    });

    expect(view.getByLabelText('৳6,531.50')).toBeTruthy();
    expect(view.getByText('Across 3 wallets')).toBeTruthy();
    expect(view.getByText(t('wallets.excludedBadge'))).toBeTruthy();
    expect(view.getByTestId('overview-wallets-list')).toBeTruthy();
    expect(view.getByTestId('overview-wallet-row-acc_bkash')).toBeTruthy();
    expect(view.getByTestId('overview-wallet-row-acc_card')).toBeTruthy();
    expect(view.getByLabelText('৳5,600 due')).toBeTruthy();

    // Tap Hero card toggles privacy hide-mode
    await fireEvent.press(view.getByTestId('overview-budget-card'));
    await waitFor(() => {
      expect(view.getByText(t('overview.tapToShowHint'))).toBeTruthy();
    });
    // Tap again to restore visibility
    await fireEvent.press(view.getByTestId('overview-budget-card'));
    await waitFor(() => {
      expect(view.getByText('Across 3 wallets')).toBeTruthy();
      expect(view.getByLabelText('৳6,531.50')).toBeTruthy();
    });
  });
});
