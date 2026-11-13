import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { InsightsContent } from '@/screens/InsightsScreen';
import { MemoryRepo } from '@/data/memoryRepo';
import { t } from '@/i18n';
import { useActivityFilterStore } from '@/state/activityFilterStore';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
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

describe('InsightsContent integration', () => {
  beforeEach(() => {
    mockPush.mockClear();
    useActivityFilterStore.getState().resetAll();
  });

  async function renderInsights(repo: MemoryRepo) {
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
          <InsightsContent todayOverride="2026-11-13" />
        </ThemeProvider>
      </AppContext.Provider>
    );
  }

  it('shows friendly empty state rather than fake zeros when DB has no transactions', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('currency', 'BDT');

    const view = await renderInsights(repo);

    await waitFor(() => {
      expect(view.getByText(t('insights.notEnoughTitle'))).toBeTruthy();
    });
    expect(view.getByText(t('insights.notEnoughBody'))).toBeTruthy();
    expect(view.queryByTestId('insight-mtd-summary')).toBeNull();
  });

  it('renders MTD comparisons, pattern sentence (+18% Food & Dining), SVG summary, and Activity drill-down', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('currency', 'BDT');
    await repo.setSetting('monthStartDay', 1);

    const seed = [
      { id: 'n1', amountMinor: 11800, occurredOn: '2026-11-01', categoryId: 'food_dining', description: 'Nov food 1' },
      { id: 'n2', amountMinor: 20000, occurredOn: '2026-11-03', categoryId: 'food_dining', description: 'Nov food 2' },
      { id: 'n3', amountMinor: 30000, occurredOn: '2026-11-05', categoryId: 'food_dining', description: 'Nov food 3' },
      { id: 'n4', amountMinor: 30000, occurredOn: '2026-11-08', categoryId: 'food_dining', description: 'Nov food 4' },
      { id: 'n5', amountMinor: 26200, occurredOn: '2026-11-12', categoryId: 'food_dining', description: 'Nov food 5' },
      { id: 'o1', amountMinor: 20000, occurredOn: '2026-10-01', categoryId: 'food_dining', description: 'Oct food 1' },
      { id: 'o2', amountMinor: 20000, occurredOn: '2026-10-03', categoryId: 'food_dining', description: 'Oct food 2' },
      { id: 'o3', amountMinor: 20000, occurredOn: '2026-10-05', categoryId: 'food_dining', description: 'Oct food 3' },
      { id: 'o4', amountMinor: 20000, occurredOn: '2026-10-08', categoryId: 'food_dining', description: 'Oct food 4' },
      { id: 'o5', amountMinor: 20000, occurredOn: '2026-10-12', categoryId: 'food_dining', description: 'Oct food 5' },
    ];
    for (const row of seed) {
      await repo.insertTransaction({
        ...row,
        type: 'expense',
        currency: 'BDT',
      });
    }

    const view = await renderInsights(repo);

    await waitFor(() => {
      expect(
        view.getByText('You spent 18% more on Food & Dining than the same point last month.')
      ).toBeTruthy();
    });

    expect(
      view.getByText(t('insights.spentSoFarHeadline', { amount: '৳ 1,180' }))
    ).toBeTruthy();
    expect(
      view.getByText(
        `${t('insights.mtdDiffMore', { diff: '৳ 180', days: 13 })} ↑`
      )
    ).toBeTruthy();

    const chart = view.getByTestId('insights-history-svg');
    expect(chart.props.accessibilityLabel).toBe(
      'Spending history over 6 cycles totaling ৳ 2,180. Peak cycle was November 2026 at ৳ 1,180.'
    );

    await fireEvent.press(view.getByTestId('insight-top-category'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ledger');
    const filterState = useActivityFilterStore.getState();
    expect(filterState.type).toBe('expense');
    expect(filterState.categoryId).toBe('food_dining');
    expect(filterState.categoryIds).toEqual(['food_dining']);
    expect(filterState.datePreset).toBe('custom');
    expect(filterState.customFromIncl).toBe('2026-11-01');
    expect(filterState.customToIncl).toBe('2026-11-30');
  });

  it('formats non-1st cycle labels with date ranges everywhere instead of calendar month names', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('currency', 'BDT');
    await repo.setSetting('monthStartDay', 10);

    await repo.insertTransaction({
      id: 'c1',
      type: 'expense',
      amountMinor: 50000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Cycle tx',
      occurredOn: '2026-11-11',
    });

    const view = await renderInsights(repo);

    await waitFor(() => {
      expect(view.getByTestId('insight-full-period-card')).toBeTruthy();
    });

    expect(view.getByText('10 Oct – 9 Nov vs 10 Sep – 9 Oct')).toBeTruthy();
    expect(view.queryByText(/Oct 2026/)).toBeNull();
  });
});
