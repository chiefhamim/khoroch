import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { OverviewContent } from '@/app/(tabs)/index';
import PlanScreen from '@/app/(tabs)/plan';
import SettingsScreen from '@/app/settings/index';
import { MemoryRepo } from '@/data/memoryRepo';
import { DEFAULT_SETTINGS } from '@/data/repo';
import { buildDefaultCategories } from '@/domain/categories';
import { todayLocalDate } from '@/domain/dates';
import { getWeekPeriod } from '@/domain/period';
import type { Settings } from '@/domain/types';
import { setLocale, t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { formatSpendingPeriodLabel } from '@/state/periodLabel';
import { useBudgets } from '@/state/useBudgets';
import { useDashboard } from '@/state/useDashboard';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

jest.mock('expo-router', () => {
  const api = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
    canGoBack: () => true,
  };
  return {
    router: api,
    useRouter: () => api,
    useLocalSearchParams: () => ({}),
    useFocusEffect: () => {},
  };
});

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

jest.mock('@/notifications/reminders', () => ({
  getNotificationPermissionStatus: jest.fn(async () => 'granted'),
  isNotificationsSupported: jest.fn(() => true),
  requestNotificationPermission: jest.fn(async () => 'granted'),
  syncReminderSchedule: jest.fn(async () => {}),
}));

const TODAY = '2026-11-17'; // a Tuesday; with a Saturday start the week is 14 to 20 Nov 2026

async function seedRepo(extra?: (repo: MemoryRepo) => Promise<void>): Promise<MemoryRepo> {
  const repo = new MemoryRepo();
  for (const cat of buildDefaultCategories(1)) {
    await repo.upsertCategory(cat);
  }
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('currency', 'BDT');
  await repo.setSetting('monthStartDay', 1);
  await repo.setSetting('name', 'Hamim');
  await repo.insertTransaction({
    id: 'w_in',
    type: 'expense',
    amountMinor: 100_000,
    currency: 'BDT',
    categoryId: 'food_dining',
    description: 'In the week',
    occurredOn: '2026-11-15',
  });
  await repo.insertTransaction({
    id: 'w_out',
    type: 'expense',
    amountMinor: 500_000,
    currency: 'BDT',
    categoryId: 'shopping',
    description: 'Before the week',
    occurredOn: '2026-11-13',
  });
  if (extra) await extra(repo);
  return repo;
}

function StatefulApp({
  repo,
  initial,
  children,
}: {
  repo: MemoryRepo;
  initial: Settings;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<Settings>(initial);
  return (
    <AppContext.Provider
      value={{
        repo,
        backend: 'memory',
        settings,
        updateSetting: async (key, value) => {
          await repo.setSetting(key, value);
          setSettings(await repo.getSettings());
        },
        refreshSettings: async () => {
          setSettings(await repo.getSettings());
        },
      }}
    >
      <ThemeProvider preference="light">
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

async function renderIn(repo: MemoryRepo, ui: React.ReactElement) {
  const initial = await repo.getSettings();
  return render(
    <StatefulApp repo={repo} initial={initial}>
      {ui}
    </StatefulApp>
  );
}

describe('weekly period: Home', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  it('shows the 7-day totals, safe per day and the week range with a weekly budget', async () => {
    const repo = await seedRepo(async (r) => {
      await r.setSetting('periodKind', 'week');
      await r.setSetting('weekStartDay', 6);
      await r.setSetting('weeklyBudgetMinor', 700_000);
      // A monthly budget exists too and must not be used in weekly mode.
      await r.setBudget('2026-11-01', '', 4_000_000);
    });
    const view = await renderIn(repo, <OverviewContent todayOverride={TODAY} hourOverride={10} />);

    await waitFor(() => {
      expect(view.getByText('Left this week, 14 to 20 Nov')).toBeTruthy();
    });
    // 7000 budget - 1000 spent in the week (the 5000 on the 13th is outside) = 6000 left.
    expect(view.getByTestId('hero-remaining-amount').props.accessibilityLabel).toBe('৳6,000');
    expect(view.getByTestId('hero-spent-strip').props.accessibilityLabel).toBe('৳1,000');
    // 6000 over 4 days left (17, 18, 19, 20 Nov) = 1500 safe today.
    expect(view.getAllByLabelText('৳1,500').length).toBeGreaterThanOrEqual(1);
    expect(view.getByText('14.3% used')).toBeTruthy();
    expect(view.queryByText('Left to spend')).toBeNull();
  });

  it('shows the no-budget state with "Set budget" when no weekly amount is set', async () => {
    const repo = await seedRepo(async (r) => {
      await r.setSetting('periodKind', 'week');
      await r.setBudget('2026-11-01', '', 4_000_000); // monthly only
    });
    const view = await renderIn(repo, <OverviewContent todayOverride={TODAY} hourOverride={10} />);

    await waitFor(() => {
      expect(view.getByTestId('hero-spent-no-budget')).toBeTruthy();
    });
    expect(view.getByText('Spent this week, 14 to 20 Nov')).toBeTruthy();
    expect(view.getByTestId('hero-spent-no-budget').props.accessibilityLabel).toBe('৳1,000');
    expect(view.getByText(t('overview.noBudgetInlineWeek'))).toBeTruthy();
    expect(view.getByTestId('overview-set-budget-inline')).toBeTruthy();
  });

  it('monthly default is unchanged: month totals and the monthly caption', async () => {
    const repo = await seedRepo(async (r) => {
      await r.setBudget('2026-11-01', '', 4_000_000);
    });
    const view = await renderIn(repo, <OverviewContent todayOverride={TODAY} hourOverride={10} />);
    await waitFor(() => {
      // 40000 - (1000 + 5000) = 34000 left
      expect(view.getByTestId('hero-remaining-amount').props.accessibilityLabel).toBe('৳34,000');
    });
    expect(view.getByText('Left to spend')).toBeTruthy();
    expect(view.queryByText(/Left this week/)).toBeNull();
  });
});

describe('weekly period: Plan', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  async function seedPlanRepo(weekly: boolean, withWeeklyBudget: boolean) {
    const repo = new MemoryRepo();
    for (const cat of buildDefaultCategories(1)) {
      await repo.upsertCategory(cat);
    }
    await repo.setSetting('currency', 'BDT');
    await repo.setSetting('monthStartDay', 1);
    const today = todayLocalDate();
    const week = getWeekPeriod(today, 6);
    await repo.insertTransaction({
      id: 'p_today',
      type: 'expense',
      amountMinor: 35_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Lunch',
      occurredOn: today,
    });
    if (weekly) await repo.setSetting('periodKind', 'week');
    if (withWeeklyBudget) await repo.setSetting('weeklyBudgetMinor', 700_000);
    return { repo, week };
  }

  it('renders the ring, the week range, and one caption instead of category budgets', async () => {
    const { repo, week } = await seedPlanRepo(true, true);
    const view = await renderIn(repo, <PlanScreen />);
    const label = formatSpendingPeriodLabel(week, { periodKind: 'week', monthStartDay: 1 }, 'en');

    await waitFor(() => {
      expect(view.getByTestId('budget-overall-ring')).toBeTruthy();
    });
    expect(view.getByText(label)).toBeTruthy();
    // 7000 - 350 spent today = 6650
    expect(view.getByTestId('budget-ring-remaining').props.accessibilityLabel).toBe('৳6,650');
    expect(view.getByTestId('plan-category-weekly-note')).toBeTruthy();
    expect(view.getByText(t('budget.categoryWeeklyNote'))).toBeTruthy();
    expect(view.queryByText(t('budget.categorySection'))).toBeNull();
    expect(view.queryByTestId('budget-add-category-row')).toBeNull();
    expect(view.getByText(t('budget.pastWeeksTitle'))).toBeTruthy();
    expect(view.queryByText(t('budget.pastCyclesTitle'))).toBeNull();
  });

  it('with no weekly budget shows the empty state, and "Set weekly budget" saves the weekly amount', async () => {
    const { repo } = await seedPlanRepo(true, false);
    await repo.setBudget(getWeekPeriod(todayLocalDate(), 6).start, '', 9_999_900); // must not be picked up
    const view = await renderIn(repo, <PlanScreen />);

    await waitFor(() => {
      expect(view.getByTestId('budget-empty-overall')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(view.getByText('Set weekly budget'));
    });
    for (const digit of ['7', '0', '0', '0']) {
      await act(async () => {
        fireEvent.press(view.getByTestId(`budget-sheet-keypad-key-${digit}`));
      });
    }
    await act(async () => {
      fireEvent.press(view.getByTestId('budget-sheet-save-btn'));
    });
    await waitFor(() => {
      expect(view.getByTestId('budget-overall-ring')).toBeTruthy();
    });
    expect(view.getByTestId('budget-ring-remaining').props.accessibilityLabel).toBe('৳6,650');
    expect((await repo.getSettings()).weeklyBudgetMinor).toBe(700_000);
  });

  it('monthly mode keeps the category section and Past cycles', async () => {
    const { repo } = await seedPlanRepo(false, false);
    const view = await renderIn(repo, <PlanScreen />);
    await waitFor(() => {
      expect(view.getByText(t('budget.categorySection'))).toBeTruthy();
    });
    expect(view.getByText(t('budget.pastCyclesTitle'))).toBeTruthy();
    expect(view.queryByTestId('plan-category-weekly-note')).toBeNull();
  });
});

describe('weekly period: switching modes never changes stored amounts', () => {
  it('month to week to month restores the same numbers', async () => {
    const repo = await seedRepo(async (r) => {
      await r.setBudget('2026-11-01', '', 4_000_000);
      await r.setBudget('2026-11-01', 'food_dining', 1_000_000);
    });
    const budgetsBefore = await repo.getAllBudgets();

    let settings: Settings = await repo.getSettings();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppContext.Provider
        value={{
          repo,
          backend: 'memory',
          settings,
          updateSetting: async () => {},
          refreshSettings: async () => {},
        }}
      >
        {children}
      </AppContext.Provider>
    );
    const useBoth = () => ({ d: useDashboard(TODAY), b: useBudgets(TODAY) });
    const { result, rerender } = await renderHook(useBoth, { wrapper });

    await waitFor(() => expect(result.current.d.loading).toBe(false));
    await waitFor(() => expect(result.current.b.loading).toBe(false));
    const monthSnapshot = {
      budget: result.current.d.overallBudgetMinor,
      spent: result.current.d.summary.spentMinor,
      safe: result.current.d.summary.safeToSpendPerDayMinor,
      remaining: result.current.d.summary.remainingMinor,
      days: result.current.b.remainingDaysCount,
      cats: result.current.b.categoryBudgets.map((c) => [c.categoryId, c.budgetMinor, c.spentMinor]),
    };
    expect(monthSnapshot.budget).toBe(4_000_000);
    expect(monthSnapshot.spent).toBe(600_000);
    expect(monthSnapshot.days).toBe(14);
    expect(monthSnapshot.cats).toEqual([['food_dining', 1_000_000, 100_000]]);

    // Weekly mode with its own amount.
    settings = { ...settings, periodKind: 'week', weekStartDay: 6, weeklyBudgetMinor: 700_000 };
    await rerender({});
    await waitFor(() => expect(result.current.d.periodKind).toBe('week'));
    await waitFor(() => expect(result.current.d.summary.spentMinor).toBe(100_000));
    expect(result.current.d.overallBudgetMinor).toBe(700_000);
    expect(result.current.d.summary.safeToSpendPerDayMinor).toBe(150_000);
    expect(result.current.b.categoryBudgets).toEqual([]);
    expect(result.current.d.period).toEqual({ start: '2026-11-14', endExcl: '2026-11-21', lengthDays: 7 });
    expect(result.current.d.billPeriod).toEqual({ start: '2026-11-01', endExcl: '2026-12-01', lengthDays: 30 });

    // Back to monthly: nothing was lost, nothing was rewritten.
    settings = { ...settings, periodKind: 'month' };
    await rerender({});
    await waitFor(() => expect(result.current.d.periodKind).toBe('month'));
    await waitFor(() => expect(result.current.d.summary.spentMinor).toBe(600_000));
    expect({
      budget: result.current.d.overallBudgetMinor,
      spent: result.current.d.summary.spentMinor,
      safe: result.current.d.summary.safeToSpendPerDayMinor,
      remaining: result.current.d.summary.remainingMinor,
      days: result.current.b.remainingDaysCount,
      cats: result.current.b.categoryBudgets.map((c) => [c.categoryId, c.budgetMinor, c.spentMinor]),
    }).toEqual(monthSnapshot);
    expect(await repo.getAllBudgets()).toEqual(budgetsBefore);
  });
});

describe('weekly period: Settings rows', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  it('adds a Budget period row, reveals Week starts on only for Weekly, and relabels the month day row', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('monthStartDay', 1);
    const view = await renderIn(repo, <SettingsScreen />);

    await waitFor(() => {
      expect(view.getByTestId('settings-period-kind-row')).toBeTruthy();
    });
    expect(view.getByText('Budget period')).toBeTruthy();
    expect(view.getByText('Monthly')).toBeTruthy();
    // The week start row governs the calendar week everywhere, so it shows in both modes.
    expect(view.getByTestId('settings-week-start-row')).toBeTruthy();
    expect(view.getByText('Budget cycle starts')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('settings-period-kind-row'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('settings-period-kind-week'));
    });
    await waitFor(() => {
      expect(view.getByTestId('settings-week-start-row')).toBeTruthy();
    });
    expect((await repo.getSettings()).periodKind).toBe('week');
    expect(view.getByText('Saturday')).toBeTruthy(); // the default
    expect(view.getByText('Month starts, for bills and monthly budgets')).toBeTruthy();
    expect(view.getByTestId('settings-cycle-row')).toBeTruthy(); // still visible

    await act(async () => {
      fireEvent.press(view.getByTestId('settings-week-start-row'));
    });
    for (let day = 0; day <= 6; day += 1) {
      expect(view.getByTestId(`settings-week-start-${day}`)).toBeTruthy();
    }
    await act(async () => {
      fireEvent.press(view.getByTestId('settings-week-start-1'));
    });
    await waitFor(() => {
      expect(view.getByText('Monday')).toBeTruthy();
    });
    expect((await repo.getSettings()).weekStartDay).toBe(1);

    // Back to Monthly keeps the week row; the stored week day stays.
    await act(async () => {
      fireEvent.press(view.getByTestId('settings-period-kind-row'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('settings-period-kind-month'));
    });
    await waitFor(async () => {
      expect((await repo.getSettings()).periodKind).toBe('month');
    });
    expect(view.getByTestId('settings-week-start-row')).toBeTruthy();
    expect((await repo.getSettings()).weekStartDay).toBe(1);
    expect((await repo.getSettings()).weekStartsOn).toBe('monday');
  });

  it('says what Week starts on affects, and adds the budget week in weekly mode', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    const view = await renderIn(repo, <SettingsScreen />);
    await waitFor(() => expect(view.getByTestId('settings-week-start-row')).toBeTruthy());
    expect(view.getByText('Used for This week and calendars')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('settings-period-kind-row'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('settings-period-kind-week'));
    });
    await waitFor(() =>
      expect(view.getByText('Used for This week, calendars and the budget week')).toBeTruthy()
    );
    expect(t('settings.weekStartSubtitle')).not.toBe('settings.weekStartSubtitle');
    setLocale('bn');
    expect(t('settings.weekStartSubtitle')).toMatch(/[ঀ-৿]/);
    expect(t('settings.weekStartSubtitleWeekly')).toMatch(/[ঀ-৿]/);
    expect(t('budget.billAlreadyPaidToast')).toMatch(/[ঀ-৿]/);
  });

  it('reads in Bangla', async () => {
    setLocale('bn');
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('language', 'bn');
    await repo.setSetting('periodKind', 'week');
    const view = await renderIn(repo, <SettingsScreen />);
    await waitFor(() => {
      expect(view.getByText('বাজেটের মেয়াদ')).toBeTruthy();
    });
    expect(view.getByText('সাপ্তাহিক')).toBeTruthy();
    expect(view.getByText('সপ্তাহ শুরুর দিন')).toBeTruthy();
    expect(view.getByText('শনিবার')).toBeTruthy();
  });
});

/** The text pieces of a caption whose amount is a nested element. */
function captionText(children: unknown): string {
  return (Array.isArray(children) ? children.flat(5) : [children])
    .filter((c): c is string => typeof c === 'string')
    .join('');
}

describe('weekly period: captions say what is counted', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  it('Home names this week\'s unpaid bills in the weekly caption', async () => {
    const weeklyRepo = await seedRepo(async (r) => {
      await r.setSetting('periodKind', 'week');
      await r.setSetting('weeklyBudgetMinor', 700_000);
      await r.insertRecurringBill({
        id: 'b1',
        name: 'Internet',
        kind: 'bill',
        amountMinor: 50_000,
        dayOfMonth: 18,
      });
    });
    const weeklyView = await renderIn(
      weeklyRepo,
      <OverviewContent todayOverride={TODAY} hourOverride={10} />
    );
    await waitFor(() => {
      expect(weeklyView.getByTestId('hero-after-bills')).toBeTruthy();
    });
    expect(captionText(weeklyView.getByTestId('hero-after-bills').props.children)).toContain(
      "After this week's unpaid bills: "
    );
  });

  it('Home keeps the monthly caption in monthly mode', async () => {
    const monthlyRepo = await seedRepo(async (r) => {
      await r.setBudget('2026-11-01', '', 4_000_000);
      await r.insertRecurringBill({
        id: 'b1',
        name: 'Internet',
        kind: 'bill',
        amountMinor: 50_000,
        dayOfMonth: 18,
      });
    });
    const monthlyView = await renderIn(
      monthlyRepo,
      <OverviewContent todayOverride={TODAY} hourOverride={10} />
    );
    await waitFor(() => {
      expect(monthlyView.getByTestId('hero-after-bills')).toBeTruthy();
    });
    const caption = captionText(monthlyView.getByTestId('hero-after-bills').props.children);
    expect(caption).toContain('After unpaid bills: ');
    expect(caption).not.toContain("this week's");
  });

  it('Plan shows the Past weeks caption only in weekly mode', async () => {
    const weekly = await renderIn(
      (await (async () => {
        const repo = new MemoryRepo();
        await repo.setSetting('periodKind', 'week');
        await repo.setSetting('weeklyBudgetMinor', 700_000);
        return repo;
      })()),
      <PlanScreen />
    );
    await waitFor(() => {
      expect(weekly.getByTestId('budget-past-weeks-caption')).toBeTruthy();
    });
    expect(weekly.getByText('Measured against your current weekly budget')).toBeTruthy();
  });

  it('has both languages for every new caption', () => {
    setLocale('bn');
    for (const key of [
      'budget.pastWeeksCaption',
      'budget.afterWeekBillsSafe',
      'overview.afterWeekUnpaidBills',
      'overview.shortAfterWeekUnpaidBills',
      'overview.afterWeekBillsLabel',
      'insights.monthlyCyclesNote',
    ] as const) {
      expect(t(key)).not.toBe(key);
      expect(t(key)).toMatch(/[ঀ-৿]/);
    }
  });
});

describe('Home hero caption row wraps instead of clipping', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  it('lets the fees and after-bills captions wrap, with no line limit on either', async () => {
    const repo = await seedRepo(async (r) => {
      await r.setSetting('periodKind', 'week');
      await r.setSetting('weeklyBudgetMinor', 700_000);
      await r.insertTransaction({
        id: 'fee1',
        type: 'expense',
        amountMinor: 1_500,
        currency: 'BDT',
        categoryId: 'fees',
        description: 'Fee',
        occurredOn: '2026-11-16',
      });
      await r.insertRecurringBill({
        id: 'b1',
        name: 'Internet',
        kind: 'bill',
        amountMinor: 50_000,
        dayOfMonth: 18,
      });
    });
    const view = await renderIn(repo, <OverviewContent todayOverride={TODAY} hourOverride={10} />);
    await waitFor(() => expect(view.getByTestId('overview-hero-tab-networth')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('overview-hero-tab-networth'));
    });
    await waitFor(() => expect(view.getByTestId('hero-subrow')).toBeTruthy());
    const row = StyleSheet.flatten(view.getByTestId('hero-subrow').props.style);
    expect(row.flexDirection).toBe('row');
    expect(row.flexWrap).toBe('wrap');
    for (const id of ['hero-fees-caption', 'hero-afterbills-caption']) {
      const caption = view.getByTestId(id);
      expect(caption.props.numberOfLines).toBeUndefined();
    }
  });
});

describe('Home hero caption row in monthly mode', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  async function openHero(withFees: boolean) {
    const repo = await seedRepo(async (r) => {
      await r.setBudget('2026-11-01', '', 4_000_000);
      if (withFees) {
        await r.insertTransaction({
          id: 'fee1',
          type: 'expense',
          amountMinor: 1_500,
          currency: 'BDT',
          categoryId: 'fees',
          description: 'Fee',
          occurredOn: '2026-11-16',
        });
      }
      await r.insertRecurringBill({
        id: 'b1',
        name: 'Internet',
        kind: 'bill',
        amountMinor: 50_000,
        dayOfMonth: 18,
      });
    });
    const view = await renderIn(repo, <OverviewContent todayOverride={TODAY} hourOverride={10} />);
    await waitFor(() => expect(view.getByTestId('overview-hero-tab-networth')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('overview-hero-tab-networth'));
    });
    await waitFor(() => expect(view.getByTestId('hero-subrow')).toBeTruthy());
    return view;
  }

  it('keeps the after-bills caption on the right when there are no fees', async () => {
    const view = await openHero(false);
    expect(view.queryByTestId('hero-fees-caption')).toBeNull();
    const style = StyleSheet.flatten(view.getByTestId('hero-afterbills-caption').props.style);
    expect(style.marginLeft).toBe('auto');
  });

  it('shows both captions when fees are present', async () => {
    const view = await openHero(true);
    expect(view.getByTestId('hero-fees-caption')).toBeTruthy();
    expect(view.getByTestId('hero-afterbills-caption')).toBeTruthy();
  });
});

describe('weekly period: defaults', () => {
  it('the default settings are monthly, Saturday and no weekly budget', () => {
    expect(DEFAULT_SETTINGS.periodKind).toBe('month');
    expect(DEFAULT_SETTINGS.weekStartDay).toBe(6);
    expect(DEFAULT_SETTINGS.weeklyBudgetMinor).toBeNull();
  });
});
