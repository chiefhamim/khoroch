import { parse } from './parser';

const TODAY = '2026-11-13';

describe('voice/quick-entry parser (TEST-CASES §4)', () => {
  it('parses all TEST-CASES §4 cases accurately', () => {
    // 1. I spent 350 taka on lunch today
    expect(parse('I spent 350 taka on lunch today', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 35000,
        categoryId: 'food_dining',
        description: 'Lunch',
        occurredOn: '2026-11-13',
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 2. Paid 1200 taka for electricity
    expect(parse('Paid 1200 taka for electricity', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 120000,
        categoryId: 'utilities',
        description: 'Electricity bill',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 3. I received 25 thousand taka salary
    expect(parse('I received 25 thousand taka salary', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'income',
        amountMinor: 2500000,
        categoryId: 'salary',
        description: 'Salary',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 4. Spent 500 on Uber and 200 on coffee -> 2 drafts
    expect(parse('Spent 500 on Uber and 200 on coffee', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 50000,
        categoryId: 'transportation',
        description: 'Uber',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
      {
        id: 'draft-1',
        type: 'expense',
        amountMinor: 20000,
        categoryId: 'food_dining',
        description: 'Coffee',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 5. 350 taka lunch
    expect(parse('350 taka lunch', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 35000,
        categoryId: 'food_dining',
        description: 'Lunch',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 6. 1200 electricity
    expect(parse('1200 electricity', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 120000,
        categoryId: 'utilities',
        description: 'Electricity bill',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 7. spent 1.5k on groceries
    expect(parse('spent 1.5k on groceries', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 150000,
        categoryId: 'groceries',
        description: 'Groceries',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 8. ৳250 dinner yesterday -> 2026-11-12
    expect(parse('৳250 dinner yesterday', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 25000,
        categoryId: 'food_dining',
        description: 'Dinner',
        occurredOn: '2026-11-12',
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 9. Three hundred taka for lunch
    expect(parse('Three hundred taka for lunch', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 30000,
        categoryId: 'food_dining',
        description: 'Lunch',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 10. spent 25,000 on rent
    expect(parse('spent 25,000 on rent', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 2500000,
        categoryId: 'housing_rent',
        description: 'Rent',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 11. got 2 lakh from business
    expect(parse('got 2 lakh from business', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'income',
        amountMinor: 20000000,
        categoryId: 'business',
        description: 'Business',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 12. rickshaw 60 tk
    expect(parse('rickshaw 60 tk', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 6000,
        categoryId: 'transportation',
        description: 'Rickshaw',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 13. bought medicine for 450.50
    expect(parse('bought medicine for 450.50', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 45050,
        categoryId: 'health',
        description: 'Medicine',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 14. ২০০ টাকা -> needsCategory true
    expect(parse('২০০ টাকা', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 20000,
        categoryId: null,
        description: '',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: true,
        requiresConfirmation: true,
      },
    ]);

    // 15. lunch -> needsAmount true, never guesses amount
    expect(parse('lunch', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: null,
        categoryId: 'food_dining',
        description: 'Lunch',
        occurredOn: TODAY,
        needsAmount: true,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // 16. spent 300 on blah -> needsCategory true
    expect(parse('spent 300 on blah', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 30000,
        categoryId: null,
        description: 'Blah',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: true,
        requiresConfirmation: true,
      },
    ]);

    // 17. empty / hello -> []
    expect(parse('', TODAY)).toEqual([]);
    expect(parse('   ', TODAY)).toEqual([]);
    expect(parse('hello', TODAY)).toEqual([]);
  });

  it('handles compound number words, word boundaries, and month rollover yesterday', () => {
    // Month start rollover: 2026-03-01 yesterday -> 2026-02-28
    expect(parse('Two hundred and fifty taka coffee yesterday', '2026-03-01')).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 25000,
        categoryId: 'food_dining',
        description: 'Coffee',
        occurredOn: '2026-02-28',
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // Word boundaries: "business" does not falsely trigger "bus"
    const res = parse('earned 15000 from freelance business', TODAY);
    expect(res[0].categoryId).toBe('business');
    expect(res[0].type).toBe('income');

    // Never guesses 0 or invalid amounts
    const zeroLunch = parse('spent 0 on lunch', TODAY);
    expect(zeroLunch[0].amountMinor).toBeNull();
    expect(zeroLunch[0].needsAmount).toBe(true);
  });

  it('parses every TEST-CASES-v1.2 §D wallet, transfer, due, and missing-wallet case', () => {
    const accounts = [
      {
        id: 'acc-cash',
        name: 'Cash',
        kind: 'cash' as const,
        provider: null,
        colorKey: 'cash',
        monogram: null,
        last4: null,
        openingBalanceMinor: 100_000,
        openingDate: TODAY,
        includeInTotal: true,
        sortOrder: 0,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'acc-bkash',
        name: 'bKash',
        kind: 'mobile_wallet' as const,
        provider: 'bkash',
        colorKey: 'bkash',
        monogram: 'bK',
        last4: null,
        openingBalanceMinor: 500_000,
        openingDate: TODAY,
        includeInTotal: true,
        sortOrder: 1,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'acc-nagad',
        name: 'Nagad',
        kind: 'mobile_wallet' as const,
        provider: 'nagad',
        colorKey: 'nagad',
        monogram: 'Ng',
        last4: null,
        openingBalanceMinor: 200_000,
        openingDate: TODAY,
        includeInTotal: true,
        sortOrder: 2,
        archivedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'acc-city',
        name: 'City Bank',
        kind: 'bank' as const,
        provider: 'city_bank',
        colorKey: 'city_bank',
        monogram: 'CB',
        last4: null,
        openingBalanceMinor: 1_000_000,
        openingDate: TODAY,
        includeInTotal: true,
        sortOrder: 3,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    // Mark Nagad active (accidentally typed archivedAt: 1 above, let's fix to null cleanly!)
    accounts[2].archivedAt = null;

    const people = [
      {
        id: 'p-rafi',
        name: 'Rafi',
        colorKey: 'blue' as const,
        honorific: 'bhai' as const,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const ctx = { accounts, people };

    // §D.1: "350 lunch bkash"
    expect(parse('350 lunch bkash', TODAY, undefined, ctx)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 35_000,
        categoryId: 'food_dining',
        accountId: 'acc-bkash',
        description: 'Lunch',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // §D.2: "paid 1200 electricity from nagad"
    expect(parse('paid 1200 electricity from nagad', TODAY, undefined, ctx)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 120_000,
        categoryId: 'utilities',
        accountId: 'acc-nagad',
        description: 'Electricity bill',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // §D.3: "got 25000 salary in city bank"
    expect(parse('got 25000 salary in city bank', TODAY, undefined, ctx)).toEqual([
      {
        id: 'draft-0',
        type: 'income',
        amountMinor: 2_500_000,
        categoryId: 'salary',
        accountId: 'acc-city',
        description: 'Salary',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // §D.4: "cash out 1000 bkash"
    expect(parse('cash out 1000 bkash', TODAY, undefined, ctx)).toEqual([
      {
        id: 'draft-0',
        draftKind: 'transfer',
        type: 'expense',
        amountMinor: 100_000,
        categoryId: null,
        fromAccountId: 'acc-bkash',
        toAccountId: 'acc-cash',
        feeMinor: 0,
        asksFee: true,
        description: 'Cash out',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // §D.5: "sent 500 to rafi bkash"
    expect(parse('sent 500 to rafi bkash', TODAY, undefined, ctx)).toEqual([
      {
        id: 'draft-0',
        draftKind: 'due',
        type: 'expense',
        amountMinor: 50_000,
        categoryId: null,
        accountId: 'acc-bkash',
        dueKind: 'lent',
        personId: 'p-rafi',
        personName: 'Rafi',
        description: 'Lent to Rafi',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // §D.6: "rafi paid me back 500"
    expect(parse('rafi paid me back 500', TODAY, undefined, ctx)).toEqual([
      {
        id: 'draft-0',
        draftKind: 'due',
        type: 'income',
        amountMinor: 50_000,
        categoryId: null,
        accountId: null,
        dueKind: 'received_back',
        personId: 'p-rafi',
        personName: 'Rafi',
        description: 'Rafi paid back',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    // §D.7: "350 lunch upay" when no Upay wallet exists
    expect(parse('350 lunch upay', TODAY, undefined, ctx)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 35_000,
        categoryId: 'food_dining',
        missingWalletName: 'Upay',
        missingWalletHint: 'No Upay wallet yet: add it?',
        description: 'Lunch',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);
  });

  it('parses Bangla multi-clause phrases with Bangla digits and connectors', () => {
    expect(parse('উবারে ৫০০ আর কফিতে ২০০ খরচ', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'expense',
        amountMinor: 50_000,
        categoryId: 'transportation',
        description: 'উবার',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
      {
        id: 'draft-1',
        type: 'expense',
        amountMinor: 20_000,
        categoryId: 'food_dining',
        description: 'কফি',
        occurredOn: TODAY,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);

    expect(parse('২৫০০০ টাকা বেতন পেয়েছি গতকাল', TODAY)).toEqual([
      {
        id: 'draft-0',
        type: 'income',
        amountMinor: 2_500_000,
        categoryId: 'salary',
        description: 'বেতন',
        occurredOn: '2026-11-12',
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    ]);
  });
});
