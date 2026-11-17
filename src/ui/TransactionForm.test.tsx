import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import EditTransactionScreen from '@/app/transaction/[id]';
import EditTransferScreen from '@/app/transfer/[id]';
import { MemoryRepo } from '@/data/memoryRepo';
import { buildDefaultCategories } from '@/domain/categories';
import type { Account, Transaction } from '@/domain/types';
import { isValidLocalTime } from '@/domain/validation';
import { DEFAULT_SETTINGS } from '@/data/repo';
import { t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from './Toast';
import {
  buildContextualSuggestions,
  formatHeroAmountText,
  orderCategoriesForPicker,
  TransactionForm,
} from './TransactionForm';

let mockRouteId = 'tx-edit-1';
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockRouteId }),
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    replace: (...args: unknown[]) => mockReplace(...args),
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

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'tx-1',
    type: overrides.type ?? 'expense',
    amountMinor: overrides.amountMinor ?? 50_000,
    currency: 'BDT',
    categoryId: overrides.categoryId ?? 'food_dining',
    accountId: overrides.accountId ?? null,
    transferId: overrides.transferId ?? null,
    description: overrides.description ?? 'Lunch',
    note: '',
    occurredOn: overrides.occurredOn ?? '2026-11-12',
    occurredTime: overrides.occurredTime ?? '12:30',
    source: 'manual',
    createdAt: overrides.createdAt ?? 1700000000000,
    updatedAt: overrides.updatedAt ?? 1700000000000,
    deletedAt: overrides.deletedAt ?? null,
  };
}

describe('Phase 9 TransactionForm helpers & flows', () => {
  const categories = buildDefaultCategories(1700000000000);

  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockReplace.mockReset();
  });

  it('orders most-recently-used category first without auto-selecting any', () => {
    const recentTxs: Transaction[] = [
      makeTx({ id: 't1', categoryId: 'transportation', occurredOn: '2026-11-10', createdAt: 100 }),
      makeTx({ id: 't2', categoryId: 'transportation', occurredOn: '2026-11-11', createdAt: 200 }),
      makeTx({ id: 't3', categoryId: 'utilities', occurredOn: '2026-11-13', createdAt: 300 }),
    ];

    const ordered = orderCategoriesForPicker(categories, 'expense', recentTxs);
    expect(ordered[0].id).toBe('utilities'); // most recent
    expect(ordered[1].id).toBe('transportation'); // next most frequently used
    expect(ordered.every((c) => c.kind === 'expense')).toBe(true);
  });

  it('filters suggestions strictly by type and category without cross-pollination', () => {
    const recentTxs: Transaction[] = [
      makeTx({ id: 'e1', type: 'expense', categoryId: 'transportation', description: 'Uber to office' }),
      makeTx({ id: 'e2', type: 'expense', categoryId: 'food_dining', description: 'Biryani lunch' }),
      makeTx({ id: 'i1', type: 'income', categoryId: 'salary', description: 'October salary' }),
    ];

    const foodSuggestions = buildContextualSuggestions('expense', 'food_dining', recentTxs);
    expect(foodSuggestions[0]).toBe('Biryani lunch');
    expect(foodSuggestions).not.toContain('Uber to office');
    expect(foodSuggestions).not.toContain('October salary');

    const salarySuggestions = buildContextualSuggestions('income', 'salary', recentTxs);
    expect(salarySuggestions[0]).toBe('October salary');
    expect(salarySuggestions).not.toContain('Biryani lunch');
    expect(salarySuggestions).not.toContain('Uber to office');

    expect(formatHeroAmountText('')).toBe('0');
    expect(formatHeroAmountText('12500.5')).toBe('12,500.5');
  });

  it('keeps Save disabled until positive amount AND category are chosen, and auto-fills time on new', async () => {
    const onSubmit = jest.fn(async () => {});

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          mode="new"
          currency="BDT"
          categories={categories}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    const saveBtn = view.getByTestId('save-tx-button');
    expect(saveBtn.props.accessibilityState.disabled).toBe(true);

    // Type 350 via custom keypad — still disabled because NO category is preselected
    await fireEvent.press(view.getByTestId('tx-keypad-key-3'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-5'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-0'));
    expect(view.getByTestId('save-tx-button').props.accessibilityState.disabled).toBe(true);

    // Select Food & Dining
    await fireEvent.press(view.getByTestId('cat-chip-food_dining'));
    expect(view.getByTestId('save-tx-button').props.accessibilityState.disabled).toBe(false);

    // Switch type to In — resets category so Save returns to disabled
    await fireEvent.press(view.getByText('In'));
    expect(view.getByTestId('save-tx-button').props.accessibilityState.disabled).toBe(true);

    // Switch back to Out, pick Food & Dining, fill description chip, submit
    await fireEvent.press(view.getByText('Out'));
    await fireEvent.press(view.getByTestId('cat-chip-food_dining'));
    await fireEvent.press(view.getByTestId('suggestion-chip-0'));
    await fireEvent.press(view.getByTestId('save-tx-button'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = (onSubmit.mock.calls as unknown[][])[0][0] as {
      type: string;
      amountMinor: number;
      categoryId: string | null;
      occurredTime: string | null;
    };
    expect(submitted.type).toBe('expense');
    expect(submitted.amountMinor).toBe(35_000);
    expect(submitted.categoryId).toBe('food_dining');
    expect(typeof submitted.occurredTime).toBe('string');
    expect(isValidLocalTime(submitted.occurredTime ?? '')).toBe(true);
  });

  it('prevents duplicate submissions on rapid double-tap', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          mode="new"
          currency="USD"
          categories={categories}
          initialValues={{ amountMinor: 2_500, categoryId: 'groceries' }}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    const btn = view.getByTestId('save-tx-button');
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit();
    });
  });

  it('supports All sheet selection, inline + New category creation, note toggle, and keypad hide/return', async () => {
    const onCreateCategory = jest.fn(async (input) => ({
      id: 'custom_pets_1',
      name: input.name,
      icon: input.icon,
      colorKey: input.colorKey,
      kind: input.kind,
      sortOrder: 99,
      isSelected: true,
      archivedAt: null,
      createdAt: 1700000005000,
    }));

    const view = await render(
      <ThemeProvider preference="dark">
        <TransactionForm
          mode="new"
          currency="BDT"
          categories={categories}
          onClose={jest.fn()}
          onCreateCategory={onCreateCategory}
          onSubmit={jest.fn(async () => {})}
        />
      </ThemeProvider>
    );

    // Focus description hides Keypad; tapping hero amount brings Keypad back
    expect(view.getByTestId('tx-keypad')).toBeTruthy();
    await fireEvent(view.getByTestId('description-input'), 'focus');
    expect(view.queryByTestId('tx-keypad')).toBeNull();
    await fireEvent.press(view.getByTestId('tx-hero-amount'));
    expect(view.getByTestId('tx-keypad')).toBeTruthy();

    // "+ Add a note" opens note field
    await fireEvent.press(view.getByTestId('tx-add-note-toggle'));
    expect(view.getByTestId('note-input')).toBeTruthy();

    // Open All sheet and select a category beyond first 7 ("travel")
    await fireEvent.press(view.getByTestId('cat-all-button'));
    expect(view.getByTestId('all-categories-sheet')).toBeTruthy();
    await fireEvent.press(view.getByTestId('cat-sheet-item-travel'));
    expect(view.queryByTestId('all-categories-sheet')).toBeNull();
    expect(view.getByTestId('cat-chip-travel')).toBeTruthy();

    // Re-open All and create a custom category inline
    await fireEvent.press(view.getByTestId('cat-all-button'));
    await fireEvent.press(view.getByTestId('new-category-open-button'));
    await fireEvent.changeText(view.getByTestId('new-category-name-input'), 'Pets');
    await fireEvent.press(view.getByTestId('new-category-save-button'));

    await waitFor(() => expect(onCreateCategory).toHaveBeenCalledTimes(1));
    expect(onCreateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pets', kind: 'expense' })
    );
  });

  it('keeps an entry without a time blank when editing, and saves the same date', async () => {
    const onSubmit = jest.fn(async () => {});

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          mode="edit"
          currency="BDT"
          categories={categories}
          initialValues={{
            type: 'expense',
            amountMinor: 50_000,
            categoryId: 'utilities',
            occurredOn: '2026-11-10',
            occurredTime: null,
          }}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    await fireEvent.press(view.getByTestId('fast-save'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        occurredOn: '2026-11-10',
        occurredTime: null,
        amountMinor: 50_000,
        categoryId: 'utilities',
      })
    );
  });

  it('EditTransactionScreen deletes via labelled actions and confirmation sheet', async () => {
    const repo = new MemoryRepo();
    await repo.insertTransaction({
      id: 'tx-edit-1',
      type: 'expense',
      amountMinor: 42_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Tea & snacks',
      occurredOn: '2026-11-12',
      occurredTime: '16:10',
    });

    const view = await render(
      <AppContext.Provider
        value={{
          repo,
          backend: 'memory',
          settings: DEFAULT_SETTINGS,
          updateSetting: async () => {},
          refreshSettings: async () => {},
        }}
      >
        <ThemeProvider preference="light">
          <ToastProvider>
            <EditTransactionScreen />
          </ToastProvider>
        </ThemeProvider>
      </AppContext.Provider>
    );

    await waitFor(() => expect(view.getByTestId('tx-delete-button')).toBeTruthy());

    // The unified edit screen keeps Delete in its footer.
    // Direct Delete button -> Confirm Delete
    await fireEvent.press(view.getByTestId('tx-delete-button'));
    expect(view.getByTestId('tx-delete-confirm-sheet')).toBeTruthy();
    expect(view.getByText(t('tx.deleteConfirmTitle'))).toBeTruthy();

    await fireEvent.press(view.getByTestId('tx-confirm-delete-button'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));

    const after = await repo.getTransaction('tx-edit-1');
    expect(after?.deletedAt).not.toBeNull();
  });

  it('defaults Wallet to defaultAccountId, supports No wallet, and formats Save CTA', async () => {
    const categories = buildDefaultCategories(1700000000000);
    const accounts: Account[] = [
      {
        id: 'acc_bkash',
        name: 'bKash',
        kind: 'mobile_wallet',
        provider: 'bkash',
        colorKey: '#E2136E',
        monogram: 'bK',
        last4: null,
        openingBalanceMinor: 1_000_000,
        openingDate: '2026-11-10',
        includeInTotal: true,
        sortOrder: 0,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'acc_cash',
        name: 'Cash',
        kind: 'cash',
        provider: null,
        colorKey: '#123227',
        monogram: null,
        last4: null,
        openingBalanceMinor: 50_000,
        openingDate: '2026-11-10',
        includeInTotal: true,
        sortOrder: 1,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const onSubmit = jest.fn(async () => {});

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          currency="BDT"
          categories={categories}
          accounts={accounts}
          defaultAccountId="acc_bkash"
          balancesById={new Map([['acc_bkash', 1_000_000], ['acc_cash', 50_000]])}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    expect(view.getByTestId('tx-wallet-row')).toBeTruthy();
    await fireEvent.press(view.getByTestId('tx-keypad-key-3'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-5'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-0'));
    await fireEvent.press(view.getByTestId('cat-chip-food_dining'));

    expect(view.getByText('Save · ৳ 350 from bKash')).toBeTruthy();

    // Switch wallet to No wallet and submit
    await fireEvent.press(view.getByTestId('tx-wallet-row'));
    await waitFor(() => expect(view.getByTestId('wallet-picker-option-none')).toBeTruthy());
    await fireEvent.press(view.getByTestId('wallet-picker-option-none'));
    expect(view.getByText('Save · ৳ 350')).toBeTruthy();

    await fireEvent.press(view.getByTestId('save-tx-button'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        amountMinor: 35_000,
        accountId: null,
      })
    );
  });

  it('submits Transfer mode atomically with fee', async () => {
    const categories = buildDefaultCategories(1700000000000);
    const accounts: Account[] = [
      {
        id: 'acc_bkash',
        name: 'bKash',
        kind: 'mobile_wallet',
        provider: 'bkash',
        colorKey: '#E2136E',
        monogram: 'bK',
        last4: null,
        openingBalanceMinor: 1_000_000,
        openingDate: '2026-11-10',
        includeInTotal: true,
        sortOrder: 0,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'acc_cash',
        name: 'Cash',
        kind: 'cash',
        provider: null,
        colorKey: '#123227',
        monogram: null,
        last4: null,
        openingBalanceMinor: 0,
        openingDate: '2026-11-10',
        includeInTotal: true,
        sortOrder: 1,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const onSubmit = jest.fn(async () => {});
    const onSubmitTransfer = jest.fn(async () => {});

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          currency="BDT"
          categories={categories}
          accounts={accounts}
          defaultAccountId="acc_bkash"
          onSubmit={onSubmit}
          onSubmitTransfer={onSubmitTransfer}
        />
      </ThemeProvider>
    );

    await fireEvent.press(view.getByText('Transfer'));
    expect(view.getByTestId('transfer-from-row')).toBeTruthy();
    expect(view.getByTestId('transfer-to-row')).toBeTruthy();
    expect(view.getByText(t('transfer.feeHintMfs'))).toBeTruthy();

    await fireEvent.press(view.getByTestId('tx-keypad-key-1'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-0'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-0'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-0'));
    await fireEvent.changeText(view.getByTestId('transfer-fee-input'), '18.50');

    expect(view.getByText('Transfer ৳ 1,000 + ৳ 18.50 fee')).toBeTruthy();
    await fireEvent.press(view.getByTestId('save-tx-button'));

    await waitFor(() => expect(onSubmitTransfer).toHaveBeenCalledTimes(1));
    expect(onSubmitTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAccountId: 'acc_bkash',
        toAccountId: 'acc_cash',
        amountMinor: 100_000,
        feeMinor: 1_850,
      })
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe('EditTransferScreen never applies the wallet default fee', () => {
    async function renderEdit(feeMinor: number) {
      const repo = new MemoryRepo();
      await repo.insertAccount({
        id: 'acc_cash',
        name: 'Cash',
        kind: 'cash',
        colorKey: '#123227',
        openingBalanceMinor: 50_000,
        openingDate: '2026-11-10',
      });
      await repo.insertAccount({
        id: 'acc_bkash',
        name: 'bKash',
        kind: 'mobile_wallet',
        provider: 'bkash',
        colorKey: '#D82A77',
        defaultFeeBp: 185,
        openingBalanceMinor: 100_000,
        openingDate: '2026-11-10',
      });
      await repo.createTransfer({
        id: 'tr-fee-1',
        fromAccountId: 'acc_bkash',
        toAccountId: 'acc_cash',
        amountMinor: 100_000,
        feeMinor,
        occurredOn: '2026-11-12',
        occurredTime: '14:15',
        note: '',
      });
      mockRouteId = 'tr-fee-1';
      const view = await render(
        <AppContext.Provider
          value={{
            repo,
            backend: 'memory',
            settings: DEFAULT_SETTINGS,
            updateSetting: async () => {},
            refreshSettings: async () => {},
          }}
        >
          <ThemeProvider preference="light">
            <ToastProvider>
              <EditTransferScreen />
            </ToastProvider>
          </ThemeProvider>
        </AppContext.Provider>
      );
      await waitFor(() => expect(view.getByTestId('transfer-fee-input')).toBeTruthy());
      return { repo, view };
    }

    afterEach(() => {
      mockRouteId = 'tx-edit-1';
    });

    it('shows the stored fee and keeps it when the amount changes', async () => {
      const { repo, view } = await renderEdit(400);
      expect(view.getByTestId('transfer-fee-input').props.value).toBe('4');
      expect(view.queryByTestId('transfer-fee-source')).toBeNull();
      expect(view.queryByTestId('transfer-fee-use-default')).toBeNull();

      await fireEvent.press(view.getByTestId('tx-keypad-key-0'));
      expect(view.getByTestId('transfer-fee-input').props.value).toBe('4');

      await fireEvent.press(view.getByTestId('save-tx-button'));
      await waitFor(async () => {
        const saved = await repo.getTransfer('tr-fee-1');
        expect(saved?.amountMinor).toBe(1_000_000);
        expect(saved?.feeMinor).toBe(400);
      });
    });

    it('treats a stored zero fee as no fee: empty field, no default, amount change leaves it empty', async () => {
      const { repo, view } = await renderEdit(0);
      expect(view.getByTestId('transfer-fee-input').props.value).toBe('');
      expect(view.queryByTestId('transfer-fee-use-default')).toBeNull();

      await fireEvent.press(view.getByTestId('tx-keypad-key-0'));
      expect(view.getByTestId('transfer-fee-input').props.value).toBe('');
      expect(view.queryByTestId('transfer-fee-source')).toBeNull();

      await fireEvent.press(view.getByTestId('save-tx-button'));
      await waitFor(async () => {
        const saved = await repo.getTransfer('tr-fee-1');
        expect(saved?.amountMinor).toBe(1_000_000);
        expect(saved?.feeMinor).toBe(0);
      });
    });
  });

  it('keeps Delete visible with transfer-fee-input focus and confirms soft delete in EditTransferScreen', async () => {
    const repo = new MemoryRepo();
    await repo.insertAccount({
      id: 'acc_cash',
      name: 'Cash',
      kind: 'cash',
      colorKey: '#123227',
      openingBalanceMinor: 50_000,
      openingDate: '2026-11-10',
    });
    await repo.insertAccount({
      id: 'acc_bkash',
      name: 'bKash',
      kind: 'mobile_wallet',
      provider: 'bkash',
      colorKey: '#D82A77',
      openingBalanceMinor: 100_000,
      openingDate: '2026-11-10',
    });
    await repo.createTransfer({
      id: 'tr-edit-1',
      fromAccountId: 'acc_bkash',
      toAccountId: 'acc_cash',
      amountMinor: 25_000,
      feeMinor: 400,
      occurredOn: '2026-11-12',
      occurredTime: '14:15',
      note: 'Cash out',
    });

    mockRouteId = 'tr-edit-1';
    try {
      const view = await render(
        <AppContext.Provider
          value={{
            repo,
            backend: 'memory',
            settings: DEFAULT_SETTINGS,
            updateSetting: async () => {},
            refreshSettings: async () => {},
          }}
        >
          <ThemeProvider preference="light">
            <ToastProvider>
              <EditTransferScreen />
            </ToastProvider>
          </ThemeProvider>
        </AppContext.Provider>
      );

      await waitFor(() => expect(view.getByTestId('tx-delete-button')).toBeTruthy());
      expect(view.getByText(t('transfer.editTitle'))).toBeTruthy();
      expect(view.queryByTestId('tx-type-toggle')).toBeNull();
      expect(view.queryByTestId('tx-more-button')).toBeNull();

      await fireEvent(view.getByTestId('transfer-fee-input'), 'focus');
      expect(view.getByTestId('tx-delete-button')).toBeTruthy();

      await fireEvent.press(view.getByTestId('tx-delete-button'));
      expect(view.getByTestId('transfer-delete-confirm-sheet')).toBeTruthy();

      await fireEvent.press(view.getByTestId('transfer-confirm-delete-button'));
      await waitFor(async () => {
        const after = await repo.getTransfer('tr-edit-1');
        expect(after?.deletedAt).not.toBeNull();
      });
    } finally {
      mockRouteId = 'tx-edit-1';
    }
  });
});
