import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
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

jest.mock('@expo/vector-icons', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  const Icon = ({ name }: { name: string }) => reactMod.createElement(rnMod.Text, null, name);
  Icon.glyphMap = {};
  return { Ionicons: Icon };
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
      expect(view.getByText('৳ 23,550')).toBeTruthy();
    });

    expect(view.getByText('Good evening')).toBeTruthy();
    expect(view.getByText('Hamim · Fri, 13 Nov 2026')).toBeTruthy();
    expect(view.getByTestId('overview-settings-shortcut')).toBeTruthy();
    expect(view.getByText('H')).toBeTruthy();
    expect(view.getAllByText('৳ 16,450').length).toBeGreaterThanOrEqual(1);
    expect(view.getByText('41.1% used')).toBeTruthy();
    expect(view.getByText('৳ 1,265.38')).toBeTruthy();
    expect(view.getByText('৳ 1,308.33')).toBeTruthy();
    expect(view.getByText('৳ 50,000')).toBeTruthy();
    expect(view.getByText(t('status.ok'))).toBeTruthy();
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
      expect(view.getByText('৳ 23,200')).toBeTruthy();
    });
    expect(view.getAllByText('৳ 16,800').length).toBeGreaterThanOrEqual(1);
  });
});
