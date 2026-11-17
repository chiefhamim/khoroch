import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PersonDetailScreen from '@/app/people/[id]';
import { MemoryRepo } from '@/data/memoryRepo';
import { addDays, todayLocalDate } from '@/domain/dates';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { mapFontToBangla } from '@/theme/tokens';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

let mockPersonId = 'p_tanvir';
let mockCanGoBack = true;
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]);
  },
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
  },
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => ({ id: mockPersonId }),
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

async function setupPersonDetailRepo() {
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

async function renderPersonDetail(repo: MemoryRepo) {
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
          <PersonDetailScreen />
        </ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('PersonDetailScreen and PersonEditorSheet', () => {
  beforeEach(() => {
    setLocale('en');
    mockPersonId = 'p_tanvir';
    mockCanGoBack = true;
    mockBack.mockClear();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  afterAll(() => {
    setLocale('en');
  });

  it('renders receivable summary, share buttons, archive confirmation, and person editor', async () => {
    const repo = await setupPersonDetailRepo();
    const view = await renderPersonDetail(repo);

    await waitFor(() => {
      expect(view.getByTestId('person-detail-hero')).toBeTruthy();
    });

    expect(view.getByText('Owes you · Since Yesterday')).toBeTruthy();
    expect(view.getByText('Yesterday · 12:00 · Cash')).toBeTruthy();
    expect(view.getByTestId('person-remind-whatsapp-btn')).toBeTruthy();
    expect(view.getByTestId('person-remind-messenger-btn')).toBeTruthy();
    expect(view.getByTestId('person-remind-copy-btn')).toBeTruthy();

    await fireEvent.press(view.getByTestId('person-detail-options'));
    await waitFor(() => {
      expect(view.getByTestId('person-options-sheet')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('person-edit-action-btn'));
    await waitFor(() => {
      expect(view.getByTestId('person-editor-sheet')).toBeTruthy();
    });

    await fireEvent.changeText(view.getByTestId('person-editor-name-input'), 'Tanvir Ahmed');
    await fireEvent.press(view.getByTestId('person-editor-save-btn'));
    await waitFor(() => {
      expect(view.getAllByText('Tanvir Ahmed').length).toBeGreaterThanOrEqual(1);
    });

    await fireEvent.press(view.getByTestId('person-detail-options'));
    await fireEvent.press(view.getByTestId('person-archive-action-btn'));
    expect(view.getByTestId('person-archive-confirm-box')).toBeTruthy();
    expect(view.getByText('Archive "Tanvir Ahmed"?')).toBeTruthy();

    await fireEvent.press(view.getByTestId('person-archive-cancel-btn'));
    expect(view.queryByTestId('person-archive-confirm-box')).toBeNull();

    mockCanGoBack = false;
    await fireEvent.press(view.getByTestId('person-archive-action-btn'));
    await fireEvent.press(view.getByTestId('person-archive-confirm-btn'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/people');
    });
  });

  it('says in words when an open entry is overdue, and shows nothing once repaid', async () => {
    const repo = await setupPersonDetailRepo();
    await repo.updateDueEntry('due_1', {
      occurredOn: addDays(todayLocalDate(), -10),
      dueOn: addDays(todayLocalDate(), -3),
    });
    const view = await renderPersonDetail(repo);

    await waitFor(() => {
      expect(view.getByTestId('person-detail-hero')).toBeTruthy();
    });
    expect(view.getByText(/Overdue by 3 days/)).toBeTruthy();
    view.unmount();

    await repo.updateDueEntry('due_1', { dueOn: addDays(todayLocalDate(), -1) });
    const oneDay = await renderPersonDetail(repo);
    await waitFor(() => {
      expect(oneDay.getByText(/Overdue by 1 day$/)).toBeTruthy();
    });
    oneDay.unmount();

    await repo.insertDueEntry({
      id: 'due_back',
      personId: 'p_tanvir',
      kind: 'received_back',
      amountMinor: 150_000,
      occurredOn: todayLocalDate(),
    });
    const settled = await renderPersonDetail(repo);
    await waitFor(() => {
      expect(settled.getByTestId('person-detail-hero')).toBeTruthy();
    });
    expect(settled.queryByText(/Overdue by/)).toBeNull();
  });

  it('writes the overdue wording in Bangla', async () => {
    setLocale('bn');
    const repo = await setupPersonDetailRepo();
    await repo.updateDueEntry('due_1', { dueOn: addDays(todayLocalDate(), -1) });
    const view = await renderPersonDetail(repo);
    await waitFor(() => {
      expect(view.getByText(/পরিশোধের তারিখ পেরিয়েছে ১ দিন/)).toBeTruthy();
    });
  });

  it('localizes receivable/payable status, dates, Bangla input font, and CTA minWidth', async () => {
    setLocale('bn');
    const repo = await setupPersonDetailRepo();
    const view = await renderPersonDetail(repo);

    await waitFor(() => {
      expect(view.getByTestId('person-detail-hero')).toBeTruthy();
    });

    expect(view.getByText('আপনি পাবেন · গতকাল থেকে')).toBeTruthy();
    expect(view.getByText('গতকাল · ১২:০০ · ক্যাশ')).toBeTruthy();

    const addEntryEl = view.getByText('নতুন এন্ট্রি');
    expect(StyleSheet.flatten(addEntryEl.props.style)?.minWidth).toBeGreaterThan(0);

    const remindInput = view.getByTestId('person-remind-message-input');
    expect(StyleSheet.flatten(remindInput.props.style)?.fontFamily).toBe(
      mapFontToBangla('Manrope_400Regular')
    );

    mockPersonId = 'p_rakib';
    const rakibView = await renderPersonDetail(repo);
    await waitFor(() => {
      expect(rakibView.getByText('আপনার দেনা · গতকাল থেকে')).toBeTruthy();
    });
  });
});
