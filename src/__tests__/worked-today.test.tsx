import React from 'react';
import { AppState, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { OverviewContent } from '@/app/(tabs)/index';
import { MemoryRepo } from '@/data/memoryRepo';
import { buildDefaultCategories } from '@/domain/categories';
import { formatMoney } from '@/domain/money';
import type { Transaction } from '@/domain/types';
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
const TOMORROW = '2026-11-18';
const WAGE = { amountMinor: 80_000, categoryId: 'business', accountId: 'acc_cash' };
const OLD_MARK = String.fromCharCode(0x2063, 0x2063);

/** Only the clock is faked, so timers and promises keep running for waitFor. */
function fakeClock(now: Date) {
  jest.useFakeTimers({
    now,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
}

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

/** A wage entry that already exists for the day, with the saved pointer to it. */
async function seedRecordedWage(repo: MemoryRepo, id = 'prev-wage', day = TODAY) {
  await repo.insertTransaction({
    id,
    type: 'income',
    amountMinor: 80_000,
    currency: 'BDT',
    categoryId: 'business',
    accountId: 'acc_cash',
    description: 'Business / Freelance',
    occurredOn: day,
    source: 'quick',
  });
  await repo.setSetting('dailyWageLast', { id, day });
}

interface RenderOptions {
  /** No todayOverride: Home reads the clock, as the app does. */
  live?: boolean;
  /** Holds back every settings read until released. */
  gate?: Promise<void>;
}

async function renderHome(repo: MemoryRepo, opts: RenderOptions = {}) {
  const settings = await repo.getSettings();
  if (opts.gate) {
    const real = repo.getSettings.bind(repo);
    const gate = opts.gate;
    repo.getSettings = async () => {
      await gate;
      return real();
    };
  }
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
          <OverviewContent todayOverride={opts.live ? undefined : TODAY} hourOverride={9} />
        </AppContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  );
}

async function wageRows(repo: MemoryRepo, day = TODAY) {
  const next = new Date(`${day}T00:00:00`);
  next.setDate(next.getDate() + 1);
  const toExcl = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  return (await repo.listTransactionsInRange(day, toExcl)).filter((r) => r.source === 'quick');
}

describe('Worked today on Home', () => {
  beforeEach(() => {
    fakeClock(new Date(2026, 10, 17, 9, 0));
    (hapticLight as jest.Mock).mockClear();
    usePrivacyStore.setState({ hideAmounts: false });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
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

  it('saves exactly one entry on tap with an empty note, records the pointer, and cannot be tapped twice', async () => {
    const repo = await seedRepo(true);
    const view = await renderHome(repo);
    const button = await waitFor(() => view.getByTestId('overview-worked-today-btn'));

    await fireEvent.press(button);
    // A second press on the same element while the save is in flight must not add another entry.
    await fireEvent.press(button);

    await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
    expect(view.getByText(t('overview.wageRecorded'))).toBeTruthy();
    expect(view.queryByTestId('overview-worked-today-btn')).toBeNull();

    const rows = await repo.listTransactionsInRange(TODAY, TOMORROW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'income',
      amountMinor: 80_000,
      categoryId: 'business',
      accountId: 'acc_cash',
      occurredOn: TODAY,
      source: 'quick',
      note: '',
      description: 'Business / Freelance',
    });
    expect((await repo.getSettings()).dailyWageLast).toEqual({ id: rows[0].id, day: TODAY });
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

  it('does not treat other quick income as the wage: no pointer means no recorded state', async () => {
    const repo = await seedRepo(true);
    await repo.insertTransaction({
      id: 'quick-other',
      type: 'income',
      amountMinor: 5_000,
      currency: 'BDT',
      categoryId: 'business',
      description: 'Tip',
      occurredOn: TODAY,
      source: 'quick',
    });
    const view = await renderHome(repo);
    await waitFor(() => expect(view.getByTestId('overview-worked-today-btn')).toBeTruthy());
  });

  it('reads as not recorded when the pointed entry was deleted or moved to another day', async () => {
    const deleted = await seedRepo(true);
    await seedRecordedWage(deleted);
    await deleted.softDeleteTransaction('prev-wage');
    const viewA = await renderHome(deleted);
    await waitFor(() => expect(viewA.getByTestId('overview-worked-today-btn')).toBeTruthy());
    await viewA.unmount();

    const moved = await seedRepo(true);
    await seedRecordedWage(moved);
    await moved.updateTransaction('prev-wage', { occurredOn: '2026-11-16' });
    const viewB = await renderHome(moved);
    await waitFor(() => expect(viewB.getByTestId('overview-worked-today-btn')).toBeTruthy());
  });

  it('a pointer for yesterday does not count as recorded today', async () => {
    const repo = await seedRepo(true);
    await seedRecordedWage(repo, 'old-wage', '2026-11-16');
    const view = await renderHome(repo);
    await waitFor(() => expect(view.getByTestId('overview-worked-today-btn')).toBeTruthy());
  });

  it('Undo removes exactly that entry, clears the pointer and brings the button back', async () => {
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
    expect(await repo.listTransactionsInRange(TODAY, TOMORROW)).toHaveLength(2);

    await fireEvent.press(view.getByLabelText(t('common.undo')));

    await waitFor(() => expect(view.getByTestId('overview-worked-today-btn')).toBeTruthy());
    expect(view.queryByTestId('overview-wage-recorded')).toBeNull();
    const rows = await repo.listTransactionsInRange(TODAY, TOMORROW);
    expect(rows.map((r) => r.id)).toEqual(['other']);
    expect((await repo.getSettings()).dailyWageLast).toBeNull();
  });

  it('does not show the button when the wage category is no longer an active income category', async () => {
    const repo = await seedRepo(false);
    await repo.setSetting('dailyWage', { ...WAGE, categoryId: 'food_dining' });
    const view = await renderHome(repo);
    await waitFor(() => expect(view.getByTestId('overview-daybook-card')).toBeTruthy());
    expect(view.queryByTestId('overview-worked-today-btn')).toBeNull();
  });

  describe('while the recorded state is unknown', () => {
    it('shows no tappable button until the first read resolves, and then no extra entry exists', async () => {
      const repo = await seedRepo(true);
      await seedRecordedWage(repo);
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const view = await renderHome(repo, { gate });

      await waitFor(() => expect(view.getByTestId('overview-wage-row')).toBeTruthy());
      // The query is still running: nothing to tap, so a fast tap cannot insert anything.
      expect(view.queryByTestId('overview-worked-today-btn')).toBeNull();
      expect(view.queryByTestId('overview-wage-add-again')).toBeNull();
      expect(await wageRows(repo)).toHaveLength(1);

      await act(async () => release());
      await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
      expect(view.queryByTestId('overview-worked-today-btn')).toBeNull();
      expect(await wageRows(repo)).toHaveLength(1);
    });

    it('shows no button after a failed read, and keeps the strip height', async () => {
      const repo = await seedRepo(true);
      const view = await renderHome(repo);
      await waitFor(() => expect(view.getByTestId('overview-worked-today-btn')).toBeTruthy());
      const height = StyleSheet.flatten(view.getByTestId('overview-wage-row').props.style).height;

      jest.spyOn(repo, 'getSettings').mockRejectedValue(new Error('read failed'));
      await act(async () => {
        const { bumpDataVersion } = jest.requireActual<typeof import('@/state/dataVersion')>(
          '@/state/dataVersion'
        );
        bumpDataVersion();
      });
      await waitFor(() => expect(view.queryByTestId('overview-worked-today-btn')).toBeNull());
      expect(view.queryByTestId('overview-wage-add-again')).toBeNull();
      expect(StyleSheet.flatten(view.getByTestId('overview-wage-row').props.style).height).toBe(height);
    });

    it('re-checks through the repo right before inserting: a wage that appeared behind the screen is not doubled', async () => {
      const repo = await seedRepo(true);
      const view = await renderHome(repo);
      const button = await waitFor(() => view.getByTestId('overview-worked-today-btn'));
      // Recorded elsewhere (another screen) after the strip last read.
      await seedRecordedWage(repo);

      await fireEvent.press(button);

      await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
      expect(await wageRows(repo)).toHaveLength(1);
      expect(hapticLight).not.toHaveBeenCalled();
    });
  });

  describe('the day comes from the clock at the tap', () => {
    it('files the entry on the new day when the clock passes midnight between render and tap, then refreshes when the app returns', async () => {
      const handlers: ((state: string) => void)[] = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation(((
        _type: string,
        handler: (state: string) => void
      ) => {
        handlers.push(handler);
        return { remove: jest.fn() };
      }) as never);

      jest.setSystemTime(new Date(2026, 10, 17, 23, 59));
      const repo = await seedRepo(true);
      const view = await renderHome(repo, { live: true });
      const button = await waitFor(() => view.getByTestId('overview-worked-today-btn'));

      jest.setSystemTime(new Date(2026, 10, 18, 0, 1));
      await fireEvent.press(button);
      await waitFor(() => expect(hapticLight).toHaveBeenCalledTimes(1));

      const rows = await repo.listTransactionsInRange(TODAY, '2026-11-19');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ occurredOn: TOMORROW, occurredTime: '00:01' });
      expect((await repo.getSettings()).dailyWageLast).toEqual({ id: rows[0].id, day: TOMORROW });

      // Home still shows the old day until it refreshes; returning to the app moves it on.
      await act(async () => {
        handlers.forEach((handler) => handler('active'));
      });
      await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
    });

    it('brings the button back for a new day when the app returns to the foreground', async () => {
      const handlers: ((state: string) => void)[] = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation(((
        _type: string,
        handler: (state: string) => void
      ) => {
        handlers.push(handler);
        return { remove: jest.fn() };
      }) as never);

      jest.setSystemTime(new Date(2026, 10, 17, 23, 59));
      const repo = await seedRepo(true);
      await seedRecordedWage(repo);
      const view = await renderHome(repo, { live: true });
      await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());

      jest.setSystemTime(new Date(2026, 10, 18, 0, 1));
      await act(async () => {
        handlers.forEach((handler) => handler('active'));
      });
      await waitFor(() => expect(view.getByTestId('overview-worked-today-btn')).toBeTruthy());
      expect(view.queryByTestId('overview-wage-recorded')).toBeNull();
    });
  });

  describe('when saving does not work out', () => {
    it('shows an error toast for a failed insert, inserts nothing, and the button stays usable', async () => {
      const repo = await seedRepo(true);
      jest.spyOn(repo, 'insertTransaction').mockRejectedValueOnce(new Error('disk full'));
      const view = await renderHome(repo);
      await fireEvent.press(await waitFor(() => view.getByTestId('overview-worked-today-btn')));

      await waitFor(() => expect(view.getByText(t('dailyWage.failedToast'))).toBeTruthy());
      expect(await wageRows(repo)).toHaveLength(0);
      expect((await repo.getSettings()).dailyWageLast).toBeNull();
      expect(hapticLight).not.toHaveBeenCalled();
      const again = await waitFor(() => view.getByTestId('overview-worked-today-btn'));

      await fireEvent.press(again);
      await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
      expect(await wageRows(repo)).toHaveLength(1);
    });

    it('takes the entry back and says so when the pointer cannot be saved', async () => {
      const repo = await seedRepo(true);
      jest.spyOn(repo, 'setSetting').mockRejectedValueOnce(new Error('settings write failed'));
      const view = await renderHome(repo);
      await fireEvent.press(await waitFor(() => view.getByTestId('overview-worked-today-btn')));

      await waitFor(() => expect(view.getByText(t('dailyWage.failedToast'))).toBeTruthy());
      expect(await wageRows(repo)).toHaveLength(0);
      await waitFor(() => expect(view.getByTestId('overview-worked-today-btn')).toBeTruthy());
    });

    it('saves with no wallet and says so when the saved wallet is archived', async () => {
      const repo = await seedRepo(true);
      await repo.archiveAccount('acc_cash');
      const view = await renderHome(repo);
      await fireEvent.press(await waitFor(() => view.getByTestId('overview-worked-today-btn')));

      await waitFor(() => expect(view.getByText(t('dailyWage.savedNoWalletToast'))).toBeTruthy());
      const rows = await wageRows(repo);
      expect(rows).toHaveLength(1);
      expect(rows[0].accountId).toBeNull();
    });

    it('saves with no wallet and says so when the saved wallet no longer exists', async () => {
      const repo = await seedRepo(false);
      await repo.setSetting('dailyWage', { ...WAGE, accountId: 'acc_missing' });
      const view = await renderHome(repo);
      await fireEvent.press(await waitFor(() => view.getByTestId('overview-worked-today-btn')));

      await waitFor(() => expect(view.getByText(t('dailyWage.savedNoWalletToast'))).toBeTruthy());
      expect((await wageRows(repo))[0].accountId).toBeNull();
    });
  });

  describe('a second shift', () => {
    it('shows the quiet line and an Add again action with a role and a label', async () => {
      const repo = await seedRepo(true);
      await seedRecordedWage(repo);
      const view = await renderHome(repo);
      await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
      const action = view.getByTestId('overview-wage-add-again');
      expect(action.props.accessibilityRole).toBe('button');
      expect(action.props.accessibilityLabel).toBe(t('overview.wageAddAgainA11y'));
      expect(view.getByText(t('overview.wageAddAgain'))).toBeTruthy();
    });

    it('asks first, records nothing on cancel, and only a confirmed second entry is added', async () => {
      const repo = await seedRepo(true);
      await seedRecordedWage(repo);
      const view = await renderHome(repo);
      await fireEvent.press(await waitFor(() => view.getByTestId('overview-wage-add-again')));

      expect(await view.findByText(t('overview.wageAnotherTitle'))).toBeTruthy();
      expect(
        view.getByText(t('overview.wageAnotherBody', { amount: formatMoney(80_000, 'BDT') }))
      ).toBeTruthy();
      await fireEvent.press(view.getByTestId('overview-wage-another-cancel'));
      expect(await wageRows(repo)).toHaveLength(1);

      await fireEvent.press(view.getByTestId('overview-wage-add-again'));
      await fireEvent.press(await waitFor(() => view.getByTestId('overview-wage-another-confirm')));

      await waitFor(async () => expect(await wageRows(repo)).toHaveLength(2));
      const newest = (await wageRows(repo)).find((r) => r.id !== 'prev-wage') as Transaction;
      expect((await repo.getSettings()).dailyWageLast).toEqual({ id: newest.id, day: TODAY });
      expect(view.getByTestId('overview-wage-recorded')).toBeTruthy();
    });

    it('Undo after a second entry removes only that one and the day stays recorded', async () => {
      const repo = await seedRepo(true);
      await seedRecordedWage(repo);
      const view = await renderHome(repo);
      await fireEvent.press(await waitFor(() => view.getByTestId('overview-wage-add-again')));
      await fireEvent.press(await waitFor(() => view.getByTestId('overview-wage-another-confirm')));
      await waitFor(async () => expect(await wageRows(repo)).toHaveLength(2));

      await fireEvent.press(await waitFor(() => view.getByLabelText(t('common.undo'))));

      await waitFor(async () => expect(await wageRows(repo)).toHaveLength(1));
      expect((await wageRows(repo))[0].id).toBe('prev-wage');
      expect((await repo.getSettings()).dailyWageLast).toEqual({ id: 'prev-wage', day: TODAY });
      await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
      expect(view.queryByTestId('overview-worked-today-btn')).toBeNull();
    });

    it('keeps the strip the same height in every state', async () => {
      const repo = await seedRepo(true);
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const view = await renderHome(repo, { gate });
      const heightOf = () => StyleSheet.flatten(view.getByTestId('overview-wage-row').props.style).height;

      await waitFor(() => expect(view.getByTestId('overview-wage-row')).toBeTruthy());
      const unknown = heightOf();
      await act(async () => release());
      const button = await waitFor(() => view.getByTestId('overview-worked-today-btn'));
      expect(heightOf()).toBe(unknown);
      await fireEvent.press(button);
      await waitFor(() => expect(view.getByTestId('overview-wage-recorded')).toBeTruthy());
      expect(heightOf()).toBe(unknown);
      expect(typeof unknown).toBe('number');
    });

    it('the wage button is flat: no shadow or elevation', async () => {
      const view = await renderHome(await seedRepo(true));
      const button = await waitFor(() => view.getByTestId('overview-worked-today-btn'));
      const style = StyleSheet.flatten(button.props.style);
      expect(style.elevation ?? 0).toBe(0);
      expect(style.shadowOpacity ?? 0).toBe(0);
      expect(style.borderWidth).toBe(1);
    });
  });
});

describe('Set daily wage on the add-entry screen', () => {
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

  it('shows only on the Received side, only when the handler is given, as a button', async () => {
    const onSet = jest.fn();
    const view = await renderForm(onSet);
    expect(view.queryByTestId('set-daily-wage-chip')).toBeNull();

    await fireEvent.press(view.getByLabelText(t('fast.received')));
    const control = view.getByTestId('set-daily-wage-chip');
    expect(control.props.accessibilityRole).toBe('button');
    expect(view.getByText(t('dailyWage.setChip'))).toBeTruthy();
    await fireEvent.press(control);
    expect(onSet).toHaveBeenCalledTimes(1);
    await view.unmount();

    const without = await renderForm(undefined);
    await fireEvent.press(without.getByLabelText(t('fast.received')));
    expect(without.queryByTestId('set-daily-wage-chip')).toBeNull();
  });

  it('is the last control in the row, so it moving in or out shifts nothing before it', async () => {
    const view = await renderForm(jest.fn());
    await fireEvent.press(view.getByLabelText(t('fast.received')));
    const row = view.getByTestId('capture-shortcuts');
    const ids: string[] = [];
    const walk = (node: { props?: { testID?: string }; children?: unknown[] }) => {
      if (node.props?.testID) ids.push(node.props.testID);
      (node.children ?? []).forEach((child) => {
        if (typeof child === 'object' && child !== null) walk(child as never);
      });
    };
    walk(row as never);
    expect(ids.indexOf('set-daily-wage-chip')).toBeGreaterThan(ids.indexOf('preset-open'));
    expect(ids[ids.length - 1]).toBe('set-daily-wage-chip');
  });
});

describe('Old invisible note marks clean themselves up', () => {
  const base = {
    type: 'income' as const,
    amountMinor: 80_000,
    categoryId: 'business',
    accountId: null,
    description: 'Business / Freelance',
    occurredOn: TODAY,
    occurredTime: '09:00',
  };

  function renderEdit(note: string) {
    return render(
      <ThemeProvider preference="light">
        <TransactionForm
          mode="edit"
          fastEntry
          currency="BDT"
          categories={buildDefaultCategories(1)}
          accounts={[]}
          initialValues={{ ...base, note }}
          onSubmit={async () => {}}
        />
      </ThemeProvider>
    );
  }

  it('opens an old wage entry with its note empty, and keeps a real note', async () => {
    const old = await renderEdit(OLD_MARK);
    expect(old.queryByLabelText(t('common.note'))).toBeNull();
    expect(old.getByLabelText(t('tx.addNoteCta'))).toBeTruthy();
    await old.unmount();

    const real = await renderEdit(`${OLD_MARK}paid in cash`);
    expect(real.getByLabelText(t('common.note')).props.value).toBe('paid in cash');
  });

  it('the Repeat chip copies the note without the old marks', async () => {
    const entry: Transaction = {
      id: 'old-wage',
      ...base,
      currency: 'BDT',
      transferId: null,
      note: OLD_MARK,
      source: 'quick',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    };
    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          mode="new"
          fastEntry
          currency="BDT"
          categories={buildDefaultCategories(1)}
          accounts={[]}
          recentTransactions={[entry]}
          pinnedAmounts={{ expense: [], income: [] }}
          onPinnedAmountsChange={() => {}}
          onSubmit={async () => {}}
        />
      </ThemeProvider>
    );
    await fireEvent.press(view.getByLabelText(t('fast.received')));
    await fireEvent.press(view.getByTestId('repeat-chip-old-wage'));
    expect(view.queryByLabelText(t('common.note'))).toBeNull();
    expect(view.getByLabelText(t('tx.addNoteCta'))).toBeTruthy();
  });
});

describe('Daily wage sheet', () => {
  async function renderSheet(repo: MemoryRepo) {
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
    return { view, onClose };
  }

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
    const { view, onClose } = await renderSheet(repo);

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

  it('falls back visibly to the defaults when the saved wallet has been archived', async () => {
    const repo = await seedRepo(true);
    await repo.insertAccount({
      id: 'acc_bank',
      name: 'Bank',
      kind: 'bank',
      colorKey: '#123227',
      openingBalanceMinor: 0,
      openingDate: '2026-11-01',
    });
    await repo.archiveAccount('acc_cash');
    const { view, onClose } = await renderSheet(repo);

    expect(await view.findByTestId('daily-wage-fallback-note')).toBeTruthy();
    expect(view.getByText(t('dailyWage.fallbackNote'))).toBeTruthy();
    expect(view.getByText('Bank')).toBeTruthy();

    await fireEvent.press(view.getByTestId('daily-wage-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await repo.getSettings()).dailyWage).toEqual({
      amountMinor: 80_000,
      categoryId: 'business',
      accountId: 'acc_bank',
    });
  });

  it('falls back visibly when the saved category has been archived', async () => {
    const repo = await seedRepo(true);
    await repo.archiveCategory('business');
    const { view } = await renderSheet(repo);

    expect(await view.findByTestId('daily-wage-fallback-note')).toBeTruthy();
  });

  it('shows no fallback note when the saved choices are still available', async () => {
    const repo = await seedRepo(true);
    const { view } = await renderSheet(repo);
    await waitFor(() => expect(view.getByTestId('daily-wage-category-business')).toBeTruthy());
    expect(view.queryByTestId('daily-wage-fallback-note')).toBeNull();
  });
});
