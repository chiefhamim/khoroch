import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PeopleTabScreen from '@/app/(tabs)/people';
import { MemoryRepo } from '@/data/memoryRepo';
import { addDays, todayLocalDate } from '@/domain/dates';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    back: jest.fn(),
    replace: jest.fn(),
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

async function setupPeopleRepo() {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('currency', 'BDT');
  await repo.insertAccount({
    id: 'acc_cash',
    name: 'Cash',
    kind: 'cash',
    colorKey: '#123227',
    openingBalanceMinor: 500_000,
    openingDate: '2026-11-01',
  });
  await repo.insertPerson({
    id: 'p_tanvir',
    name: 'Tanvir',
    colorKey: 'green',
    honorific: 'none',
  });
  await repo.insertPerson({
    id: 'p_rakib',
    name: 'Rakib',
    colorKey: 'blue',
    honorific: 'none',
  });

  const yesterday = addDays(todayLocalDate(), -1);
  await repo.insertDueEntry({
    id: 'due_1',
    personId: 'p_tanvir',
    kind: 'lent',
    amountMinor: 150_000,
    accountId: 'acc_cash',
    occurredOn: yesterday,
    occurredTime: '12:00',
    note: '',
  });
  await repo.insertDueEntry({
    id: 'due_2',
    personId: 'p_rakib',
    kind: 'borrowed',
    amountMinor: 80_000,
    accountId: 'acc_cash',
    occurredOn: yesterday,
    occurredTime: '13:00',
    note: '',
  });
  return repo;
}

async function renderPeopleScreen(repo: MemoryRepo) {
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
        <ToastProvider>
          <PeopleTabScreen />
        </ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('PeopleTabScreen and DueEntrySheet', () => {
  beforeEach(() => {
    setLocale('en');
    mockPush.mockClear();
  });

  afterAll(() => {
    setLocale('en');
  });

  it('renders People list summary, localized due rows, and EN overpayment warning', async () => {
    const repo = await setupPeopleRepo();
    const view = await renderPeopleScreen(repo);

    await waitFor(() => {
      expect(view.getByText('Tanvir')).toBeTruthy();
    });

    expect(view.getByText('Owes you')).toBeTruthy();
    expect(view.getAllByText('You owe').length).toBeGreaterThanOrEqual(2);
    expect(view.getAllByText('1 person').length).toBe(2);
    expect(view.getAllByText('Since Yesterday · 1 entry').length).toBe(2);

    await fireEvent.press(view.getByTestId('people-new-due-btn'));
    await waitFor(() => {
      expect(view.getByTestId('due-entry-sheet')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('due-person-chip-p_tanvir'));
    await fireEvent.press(view.getByTestId('due-kind-received_back'));
    await fireEvent.changeText(view.getByTestId('due-amount-input'), '2000');

    expect(view.getByTestId('due-overpayment-warning')).toBeTruthy();
    expect(view.getByText('This is ৳500 more than Tanvir owes')).toBeTruthy();
  });

  it('localizes People list and DueEntrySheet into Bangla with Fabric minWidth', async () => {
    setLocale('bn');
    const repo = await setupPeopleRepo();
    const view = await renderPeopleScreen(repo);

    await waitFor(() => {
      expect(view.getByText('Tanvir')).toBeTruthy();
    });

    const personCounts = view.getAllByText('১ জন');
    expect(personCounts.length).toBe(2);
    expect(StyleSheet.flatten(personCounts[0].props.style)?.minWidth).toBeGreaterThan(0);

    const owesYouRow = view.getAllByText('আপনি পাবেন');
    expect(owesYouRow.length).toBe(2);
    expect(StyleSheet.flatten(owesYouRow[1].props.style)?.minWidth).toBeGreaterThan(0);

    const youOweLabels = view.getAllByText('আপনার দেনা');
    expect(youOweLabels.length).toBe(2);
    expect(StyleSheet.flatten(youOweLabels[1].props.style)?.minWidth).toBeGreaterThan(0);

    expect(view.getAllByText('গতকাল থেকে · ১টি এন্ট্রি').length).toBe(2);

    await fireEvent.press(view.getByTestId('people-new-due-btn'));
    await waitFor(() => {
      expect(view.getByTestId('due-entry-sheet')).toBeTruthy();
    });

    const walletLabelEl = view.getByText('ওয়ালেট (ঐচ্ছিক)');
    expect(StyleSheet.flatten(walletLabelEl.props.style)?.minWidth).toBeGreaterThan(96);
    const noWalletEl = view.getByText('ওয়ালেট ছাড়া');
    expect(StyleSheet.flatten(noWalletEl.props.style)?.minWidth).toBeGreaterThan(0);

    await fireEvent.press(view.getByTestId('due-person-chip-p_tanvir'));
    await fireEvent.press(view.getByTestId('due-kind-received_back'));
    await fireEvent.changeText(view.getByTestId('due-amount-input'), '2000');

    expect(
      view.getByText('Tanvir যতটুকু দেবেন তার চেয়ে ৳500 বেশি হয়েছে')
    ).toBeTruthy();
  });
});
