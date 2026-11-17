import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SmartInboxScreen from '@/app/inbox';
import { MemoryRepo } from '@/data/memoryRepo';
import type { NewPendingDraft } from '@/domain/types';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }));

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

const DAY = '2026-11-10';

function draft(over: Partial<NewPendingDraft> & { id: string }): NewPendingDraft {
  return {
    source: 'notification',
    fingerprint: `trx:${over.id}`,
    draftKind: 'transaction',
    type: 'expense',
    amountMinor: 10_000,
    feeMinor: 0,
    categoryId: 'food_dining',
    accountId: 'acc_bkash',
    description: `Draft ${over.id}`,
    rawText: 'raw',
    trxId: 'TRX00000AB',
    occurredOn: DAY,
    occurredTime: '10:00',
    ...over,
  };
}

async function setupRepo() {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('currency', 'BDT');
  for (const [id, name] of [
    ['acc_bkash', 'bKash'],
    ['acc_cash', 'Cash'],
    ['acc_old', 'Old wallet'],
  ] as const) {
    await repo.insertAccount({
      id,
      name,
      kind: id === 'acc_cash' ? 'cash' : 'mobile_wallet',
      colorKey: '#123227',
      openingBalanceMinor: 0,
      openingDate: '2026-11-01',
    });
  }
  await repo.archiveAccount('acc_old');

  // A saved entry whose TrxID matches the last draft.
  await repo.insertTransaction({
    id: 'tx_saved',
    type: 'expense',
    amountMinor: 77_700,
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: 'acc_bkash',
    description: 'Already saved',
    note: 'TrxID: DUPTRX0001',
    occurredOn: DAY,
    occurredTime: '09:00',
    source: 'manual',
  });

  await repo.upsertPendingDrafts([
    draft({ id: 'd_nowallet', accountId: null, amountMinor: 11_100, trxId: 'NOWALLET01' }),
    draft({ id: 'd_archived', accountId: 'acc_old', amountMinor: 22_200, trxId: 'ARCHIVED01' }),
    draft({ id: 'd_nocat', categoryId: null, amountMinor: 33_300, trxId: 'NOCATEGORY1' }),
    draft({
      id: 'd_clear',
      accountId: 'acc_cash',
      categoryId: 'food_dining',
      amountMinor: 44_400,
      feeMinor: 500,
      trxId: 'CLEARTRX01',
    }),
    draft({ id: 'd_dup', amountMinor: 55_500, trxId: 'DUPTRX0001' }),
    draft({
      id: 'd_usd',
      amountMinor: 66_600,
      trxId: 'USDTRX0001',
      description: 'GitHub (USD 0.90)',
    }),
  ]);
  return repo;
}

async function renderInbox(repo: MemoryRepo) {
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
          <SmartInboxScreen />
        </ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('Smart Inbox', () => {
  beforeEach(() => setLocale('en'));
  afterAll(() => setLocale('en'));

  it('blocks Approve for a missing wallet, a dead wallet, a missing category and an estimated amount', async () => {
    const repo = await setupRepo();
    const view = await renderInbox(repo);
    await waitFor(() => expect(view.getByTestId('inbox-draft-d_clear')).toBeTruthy());

    const disabled = (id: string) =>
      view.getByTestId(`inbox-approve-${id}`).props.accessibilityState.disabled;
    expect(disabled('d_nowallet')).toBe(true);
    expect(disabled('d_archived')).toBe(true);
    expect(disabled('d_nocat')).toBe(true);
    expect(disabled('d_usd')).toBe(true);
    expect(disabled('d_clear')).toBe(false);
    // A likely duplicate can still be saved on purpose, under the "Save anyway" title.
    expect(disabled('d_dup')).toBe(false);

    expect(view.getByTestId('inbox-choose-wallet-d_nowallet')).toBeTruthy();
    expect(view.getByTestId('inbox-choose-wallet-d_archived')).toBeTruthy();
    expect(view.getByTestId('inbox-choose-category-d_nocat')).toBeTruthy();
    expect(view.getByText('Choose category')).toBeTruthy();
    expect(view.getByTestId('inbox-amount-check-d_usd')).toBeTruthy();
    expect(view.getByTestId('inbox-duplicate-d_dup')).toBeTruthy();
  });

  it('counts exactly one clear draft for bulk approve and saves it with its own wallet and category', async () => {
    const repo = await setupRepo();
    const view = await renderInbox(repo);
    await waitFor(() => expect(view.getByTestId('inbox-approve-all')).toBeTruthy());

    expect(view.getByText('Approve clear ones (1)')).toBeTruthy();
    await fireEvent.press(view.getByTestId('inbox-approve-all'));
    await fireEvent.press(await view.findByTestId('inbox-approve-all-confirm'));

    await waitFor(async () => {
      const pending = await repo.listPendingDrafts({ status: 'pending' });
      expect(pending.map((d) => d.id).sort()).toEqual([
        'd_archived',
        'd_dup',
        'd_nocat',
        'd_nowallet',
        'd_usd',
      ]);
    });

    const all = await repo.listTransactionsInRange('2026-11-01', '2026-12-01');
    const captured = all.filter((t) => t.source === 'capture');
    expect(captured).toHaveLength(2);
    const main = captured.find((t) => t.amountMinor === 44_400);
    const fee = captured.find((t) => t.amountMinor === 500);
    expect(main?.accountId).toBe('acc_cash');
    expect(main?.categoryId).toBe('food_dining');
    expect(fee?.accountId).toBe('acc_cash');
    expect(fee?.categoryId).toBe('fees');
    // Only the one saved entry from before plus the two new rows.
    expect(all).toHaveLength(3);
  });

  it('keeps a wallet and category pick after a reload', async () => {
    const repo = await setupRepo();
    const view = await renderInbox(repo);
    await waitFor(() => expect(view.getByTestId('inbox-edit-d_nocat')).toBeTruthy());

    await fireEvent.press(view.getByTestId('inbox-edit-d_nocat'));
    await fireEvent.press(await view.findByText('Groceries'));

    await waitFor(async () => {
      const [d] = (await repo.listPendingDrafts({ status: 'pending' })).filter((x) => x.id === 'd_nocat');
      expect(d.categoryId).toBe('groceries');
    });
  });

  it('dismiss all marks drafts dismissed so the same messages cannot return', async () => {
    const repo = await setupRepo();
    const view = await renderInbox(repo);
    await waitFor(() => expect(view.getByTestId('inbox-dismiss-all')).toBeTruthy());

    await fireEvent.press(view.getByTestId('inbox-dismiss-all'));
    await waitFor(async () => {
      expect(await repo.listPendingDrafts({ status: 'pending' })).toHaveLength(0);
    });
    const all = await repo.listPendingDrafts();
    expect(all).toHaveLength(6);
    expect(all.every((d) => d.status === 'dismissed' && d.rawText === '')).toBe(true);
    expect(await repo.upsertPendingDrafts([draft({ id: 'again', trxId: 'NOWALLET01', fingerprint: 'trx:d_nowallet' })])).toBe(0);
  });

  it('asks for the amount to be confirmed on an estimated foreign-currency draft, then allows approval', async () => {
    const repo = await setupRepo();
    const view = await renderInbox(repo);
    await waitFor(() => expect(view.getByTestId('inbox-check-amount-d_usd')).toBeTruthy());

    await fireEvent.press(view.getByTestId('inbox-check-amount-d_usd'));
    const field = await view.findByTestId('inbox-edit-amount');
    await fireEvent.changeText(field, '110');
    await fireEvent.press(view.getByTestId('inbox-edit-confirm-amount'));

    await waitFor(async () => {
      const [d] = (await repo.listPendingDrafts({ status: 'pending' })).filter((x) => x.id === 'd_usd');
      expect(d.amountMinor).toBe(11_000);
      expect(d.description).toBe('GitHub');
    });
    await waitFor(() =>
      expect(view.getByTestId('inbox-edit-approve').props.accessibilityState.disabled).toBe(false)
    );
  });
});
