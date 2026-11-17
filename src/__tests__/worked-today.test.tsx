import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { OverviewContent } from '@/app/(tabs)/index';
import { MemoryRepo } from '@/data/memoryRepo';
import { buildDefaultCategories } from '@/domain/categories';
import { WAGE_NOTE_MARKER } from '@/domain/dailyWage';
import { formatMoney } from '@/domain/money';
import { t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { usePrivacyStore } from '@/state/privacyStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DailyWageSheet } from '@/ui/DailyWageSheet';
import { hapticLight } from '@/ui/haptics';
import { ToastProvider } from '@/ui/Toast';
import { TransactionForm } from '@/ui/TransactionForm';

let mockUuidSeq = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `wage-uuid-${++mockUuidSeq}-1234-5678-90abcdef`,
}));

jest.mock('@/ui/haptics', () => ({
  ...jest.requireActual<typeof import('@/ui/haptics')>('@/ui/haptics'),
  hapticLight: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const react = jest.requireActual<typeof import('react')>('react');
    react.useEffect(cb, [cb]);
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

const TODAY = '2026-11-17';
const WAGE = { amountMinor: 80_000, categoryId: 'business', accountId: 'acc_cash' };

async function seedRepo(withWage: boolean): Promise<MemoryRepo> {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.insertAccount({
    id: 'acc_cash',
    name: 'Cash',
    kind: 'cash',
    colorKey: '#123227',
    openingBalanceMinor: 0,
    openingDate: '2026-11-01',
  });
  if (withWage) await repo.setSetting('dailyWage', WAGE);
  return repo;
}

async function renderHome(repo: MemoryRepo) {
  const settings = await repo.getSettings();
  return render(
    <ThemeProvider preference="light">
      <ToastProvider>
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
          <OverviewContent todayOverride={TODAY} hourOverride={9} />
        </AppContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('Worked today on Home', () => {
  beforeEach(() => {
    (hapticLight as jest.Mock).mockClear();
    usePrivacyStore.setState({ hideAmounts: false });
  });

  it('shows no button and no wage row when no wage is set', async () => {
    const view = await renderHome(await seedRepo(false));
    await waitFor(() => expect(view.getByTestId('overview-daybook-card')).toBeTruthy());
    expect(view.queryByTestId('overview-worked-today-btn')).toBeNull();
    expect(view.queryByTestId('overview-wage-row')).toBeNull();
  });

  it('shows the labelled button when a wage is set, and hides the amount when amounts are hidden', async () => {
    const view = await renderHome(await seedRepo(true));
    const label = t('overview.workedTodayA11y', { amount: formatMoney(80_000, 'BDT') });
    await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());
    expect(view.getByText(t('overview.workedToday', { amount: formatMoney(80_000, 'BDT') }))).toBeTruthy();
    await view.unmount();

    await act(async () => usePrivacyStore.setState({ hideAmounts: true }));
    const hidden = await renderHome(await seedRepo(true));
    await waitFor(() => expect(hidden.getByTestId('overview-worked-today-btn')).toBeTruthy());
    expect(hidden.queryByText(/800/)).toBeNull();
  });

  it('saves exactly one entry on tap, replaces the button with the quiet line, and cannot be tapped twice', async () => {
    const repo = await seedRepo(true);
    const view = await renderHome(repo);
    const button = await waitFor(() => view.getByTestId('overview-worked-today-btn'));

    await fireEvent.press(button);
    // A second press on the same element while the save is in flight must not add another entry.
    await fireEvent.press(button);

    await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
    expect(view.getByText(t('overview.wageRecorded'))).toBeTruthy();
    expect(view.queryByTestId('overview-worked-today-btn')).toBeNull();

    const rows = await repo.listTransactionsInRange(TODAY, '2026-11-18');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'income',
      amountMinor: 80_000,
      categoryId: 'business',
      accountId: 'acc_cash',
      occurredOn: TODAY,
      source: 'quick',
      note: WAGE_NOTE_MARKER,
      description: 'Business / Freelance',
    });
    expect(hapticLight).toHaveBeenCalledTimes(1);
    expect(view.getByText(t('dailyWage.savedToast'))).toBeTruthy();
  });

  it('keeps the quiet line when the home screen is opened again the same day', async () => {
    const repo = await seedRepo(true);
    const first = await renderHome(repo);
    await fireEvent.press(await waitFor(() => first.getByTestId('overview-worked-today-btn')));
    await waitFor(() => expect(first.getByTestId('overview-wage-recorded')).toBeTruthy());
    await first.unmount();

    const second = await renderHome(repo);
    await waitFor(() => expect(second.getByTestId('overview-wage-recorded')).toBeTruthy());
    expect(second.queryByTestId('overview-worked-today-btn')).toBeNull();
  });

  it('Undo removes exactly that entry and brings the button back', async () => {
    const repo = await seedRepo(true);
    await repo.insertTransaction({
      id: 'other',
      type: 'expense',
      amountMinor: 5_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Tea',
      occurredOn: TODAY,
    });
    const view = await renderHome(repo);
    await fireEvent.press(await waitFor(() => view.getByTestId('overview-worked-today-btn')));
    await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
    expect(await repo.listTransactionsInRange(TODAY, '2026-11-18')).toHaveLength(2);

    await fireEvent.press(view.getByLabelText(t('common.undo')));

    await waitFor(() => expect(view.getByTestId('overview-worked-today-btn')).toBeTruthy());
    expect(view.queryByTestId('overview-wage-recorded')).toBeNull();
    const rows = await repo.listTransactionsInRange(TODAY, '2026-11-18');
    expect(rows.map((r) => r.id)).toEqual(['other']);
  });

  it('does not show the button when the wage category is no longer an active income category', async () => {
    const repo = await seedRepo(false);
    await repo.setSetting('dailyWage', { ...WAGE, categoryId: 'food_dining' });
    const view = await renderHome(repo);
    await waitFor(() => expect(view.getByTestId('overview-daybook-card')).toBeTruthy());
    expect(view.queryByTestId('overview-worked-today-btn')).toBeNull();
  });
});

describe('Set daily wage chip on the add-entry screen', () => {
  function renderForm(onSetDailyWage?: () => void) {
    return render(
      <ThemeProvider preference="light">
        <TransactionForm
          mode="new"
          fastEntry
          currency="BDT"
          categories={buildDefaultCategories(1)}
          accounts={[]}
          pinnedAmounts={{ expense: [], income: [] }}
          onPinnedAmountsChange={() => {}}
          onSetDailyWage={onSetDailyWage}
          onSubmit={async () => {}}
        />
      </ThemeProvider>
    );
  }

  it('shows only on the Received side, and only when the handler is given', async () => {
    const onSet = jest.fn();
    const view = await renderForm(onSet);
    expect(view.queryByTestId('set-daily-wage-chip')).toBeNull();

    await fireEvent.press(view.getByLabelText(t('fast.received')));
    const chip = view.getByTestId('set-daily-wage-chip');
    expect(view.getByText(t('dailyWage.setChip'))).toBeTruthy();
    await fireEvent.press(chip);
    expect(onSet).toHaveBeenCalledTimes(1);
    await view.unmount();

    const without = await renderForm(undefined);
    await fireEvent.press(without.getByLabelText(t('fast.received')));
    expect(without.queryByTestId('set-daily-wage-chip')).toBeNull();
  });
});

describe('Daily wage sheet', () => {
  it('saves the typed amount with the most used income category and wallet as defaults', async () => {
    const repo = await seedRepo(false);
    await repo.insertTransaction({
      id: 'inc1',
      type: 'income',
      amountMinor: 100_000,
      currency: 'BDT',
      categoryId: 'business',
      accountId: 'acc_cash',
      description: 'Job',
      occurredOn: '2026-11-10',
    });
    const settings = await repo.getSettings();
    const onClose = jest.fn();
    const view = await render(
      <ThemeProvider preference="light">
        <ToastProvider>
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
            <DailyWageSheet visible onClose={onClose} />
          </AppContext.Provider>
        </ToastProvider>
      </ThemeProvider>
    );

    await fireEvent.press(await waitFor(() => view.getByTestId('daily-wage-save')));
    expect(await view.findByText(t('dailyWage.invalidAmount'))).toBeTruthy();
    expect((await repo.getSettings()).dailyWage).toBeNull();

    await fireEvent.changeText(view.getByTestId('daily-wage-amount'), '800');
    await waitFor(() => expect(view.getByTestId('daily-wage-category-business')).toBeTruthy());
    await fireEvent.press(view.getByTestId('daily-wage-save'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await repo.getSettings()).dailyWage).toEqual({
      amountMinor: 80_000,
      categoryId: 'business',
      accountId: 'acc_cash',
    });
  });
});
