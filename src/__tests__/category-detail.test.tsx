import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CategoryPeriodScreen from '@/app/category/[id]';
import { MemoryRepo } from '@/data/memoryRepo';
import { buildDefaultCategories } from '@/domain/categories';
import { setLocale, t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
let mockParams: { id: string; periodStart?: string; periodEnd?: string } = {
  id: 'groceries',
  periodStart: '2026-11-01',
  periodEnd: '2026-12-01',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => mockParams,
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

async function setupCategoryRepo(options?: { withExpense?: boolean }) {
  const repo = new MemoryRepo();
  for (const cat of buildDefaultCategories(1)) {
    await repo.upsertCategory(cat);
  }
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('currency', 'BDT');
  await repo.setSetting('monthStartDay', 1);

  if (options?.withExpense !== false) {
    await repo.insertTransaction({
      id: 'tx_groc_1',
      type: 'expense',
      amountMinor: 120_000,
      currency: 'BDT',
      categoryId: 'groceries',
      description: 'Monthly bazar',
      occurredOn: '2026-11-11',
      occurredTime: '16:28',
    });
  }
  return repo;
}

async function renderCategoryScreen(repo: MemoryRepo) {
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
        <CategoryPeriodScreen />
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('CategoryPeriodScreen', () => {
  beforeEach(() => {
    setLocale('en');
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack = true;
    mockParams = {
      id: 'groceries',
      periodStart: '2026-11-01',
      periodEnd: '2026-12-01',
    };
  });

  afterAll(() => {
    setLocale('en');
  });

  it('renders category period summary, expenses, and row navigation in English', async () => {
    const repo = await setupCategoryRepo();
    const view = await renderCategoryScreen(repo);

    await waitFor(() => {
      expect(view.getByText('Monthly bazar')).toBeTruthy();
    });

    expect(view.getByText('Groceries')).toBeTruthy();
    expect(view.getByText('1 Nov – 30 Nov')).toBeTruthy();
    expect(view.getByText('1 expense(s)')).toBeTruthy();

    await fireEvent.press(view.getByText('Monthly bazar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction/[id]',
      params: { id: 'tx_groc_1' },
    });

    await fireEvent.press(view.getByTestId('category-detail-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('localizes range, dates, and Bangla count badge with Fabric minWidth', async () => {
    setLocale('bn');
    const repo = await setupCategoryRepo();
    const view = await renderCategoryScreen(repo);

    await waitFor(() => {
      expect(view.getByText('মাসিক বাজার')).toBeTruthy();
    });

    const rangeEl = view.getByText('১ নভে – ৩০ নভে');
    expect(rangeEl).toBeTruthy();
    expect(StyleSheet.flatten(rangeEl.props.style)?.minWidth).toBeGreaterThan(0);

    const countEl = view.getByText('১টি খরচ');
    expect(countEl).toBeTruthy();
    expect(StyleSheet.flatten(countEl.props.style)?.minWidth).toBeGreaterThan(0);

    expect(view.getByText(/১১ নভে/)).toBeTruthy();

    mockCanGoBack = false;
    await fireEvent.press(view.getByTestId('category-detail-back'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('renders empty state when category has no transactions in range', async () => {
    const repo = await setupCategoryRepo({ withExpense: false });
    const view = await renderCategoryScreen(repo);

    await waitFor(() => {
      expect(view.getByText(t('categoryDetail.empty'))).toBeTruthy();
    });
    expect(view.getByText('0 expense(s)')).toBeTruthy();
  });
});
