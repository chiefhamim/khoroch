import { DEFAULT_CATEGORIES } from '@/domain/categories';
import { MemoryRepo } from './memoryRepo';

describe('MemoryRepo (TEST-CASES §6)', () => {
  it('ignores duplicate insert with same id', async () => {
    const repo = new MemoryRepo();
    await repo.insertTransaction({
      id: 'tx-dup',
      type: 'expense',
      amountMinor: 50000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'First',
      occurredOn: '2026-11-13',
    });
    await repo.insertTransaction({
      id: 'tx-dup',
      type: 'expense',
      amountMinor: 99900,
      currency: 'BDT',
      categoryId: 'shopping',
      description: 'Second',
      occurredOn: '2026-11-13',
    });

    const rows = await repo.listTransactionsInRange('2026-11-01', '2026-12-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].amountMinor).toBe(50000);
    expect(rows[0].description).toBe('First');
  });

  it('soft-deleted rows are hidden from range/search but still returned by getTransaction with deletedAt', async () => {
    const repo = new MemoryRepo();
    await repo.insertTransaction({
      id: 'tx-soft',
      type: 'expense',
      amountMinor: 25000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Dinner',
      occurredOn: '2026-11-13',
    });

    await repo.softDeleteTransaction('tx-soft');

    expect(await repo.listTransactionsInRange('2026-11-01', '2026-12-01')).toHaveLength(0);
    expect((await repo.searchTransactions({}, { limit: 20 })).rows).toHaveLength(0);

    const fetched = await repo.getTransaction('tx-soft');
    expect(fetched).not.toBeNull();
    expect(fetched?.deletedAt).not.toBeNull();
  });

  it('archiving a category keeps old transactions pointing at it and hides from default listCategories', async () => {
    const repo = new MemoryRepo();
    await repo.insertTransaction({
      id: 'tx-cat',
      type: 'expense',
      amountMinor: 12000,
      currency: 'BDT',
      categoryId: 'coffee_custom',
      occurredOn: '2026-11-13',
    });
    await repo.upsertCategory({
      id: 'coffee_custom',
      name: 'Specialty Coffee',
      icon: 'cafe',
      colorKey: 'orange',
      kind: 'expense',
      sortOrder: 50,
      isSelected: true,
      archivedAt: null,
      createdAt: 1000,
    });

    await repo.archiveCategory('coffee_custom');

    const active = await repo.listCategories();
    expect(active.find((c) => c.id === 'coffee_custom')).toBeUndefined();

    const all = await repo.listCategories({ includeArchived: true });
    const archived = all.find((c) => c.id === 'coffee_custom');
    expect(archived).toBeDefined();
    expect(archived?.archivedAt).not.toBeNull();

    const tx = await repo.getTransaction('tx-cat');
    expect(tx?.categoryId).toBe('coffee_custom');
  });

  it('setBudget for Nov does not alter Oct', async () => {
    const repo = new MemoryRepo();
    await repo.setBudget('2026-10-01', '', 3000000);
    await repo.setBudget('2026-11-01', '', 4000000);

    const oct = await repo.getBudgets('2026-10-01');
    const nov = await repo.getBudgets('2026-11-01');
    expect(oct[0].amountMinor).toBe(3000000);
    expect(nov[0].amountMinor).toBe(4000000);
  });

  it('ensureBudgetsForPeriod copies previous period once and respects subsequent edits', async () => {
    const repo = new MemoryRepo();
    await repo.setBudget('2026-11-01', '', 4000000);
    await repo.setBudget('2026-11-01', 'food_dining', 1000000);

    await repo.ensureBudgetsForPeriod('2026-12-01', '2026-11-01');
    let dec = await repo.getBudgets('2026-12-01');
    expect(dec).toHaveLength(2);
    expect(dec.find((b) => b.categoryId === '')?.amountMinor).toBe(4000000);

    // Edit Dec and remove category budget
    await repo.setBudget('2026-12-01', '', 5000000);
    await repo.deleteBudget('2026-12-01', 'food_dining');

    // Calling again does not overwrite or restore deleted row
    await repo.ensureBudgetsForPeriod('2026-12-01', '2026-11-01');
    dec = await repo.getBudgets('2026-12-01');
    expect(dec).toHaveLength(1);
    expect(dec[0].amountMinor).toBe(5000000);
  });

  it('deleteAllData clears transactions, budgets, reviews and resets settings', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('name', 'Hamim');
    await repo.setBudget('2026-11-01', '', 4000000);
    await repo.insertTransaction({
      id: 'tx-del',
      type: 'expense',
      amountMinor: 10000,
      currency: 'BDT',
      categoryId: 'food_dining',
      occurredOn: '2026-11-13',
    });
    await repo.markDayReviewed('2026-11-13');

    await repo.deleteAllData();

    expect(await repo.hasAnyTransactions()).toBe(false);
    expect(await repo.getAllBudgets()).toHaveLength(0);
    expect(await repo.isDayReviewed('2026-11-13')).toBe(false);
    const settings = await repo.getSettings();
    expect(settings.onboardingDone).toBe(false);
    expect(settings.name).toBe('');
  });

  it('paginates searchTransactions cleanly without duplicates or omissions', async () => {
    const repo = new MemoryRepo();
    for (let i = 1; i <= 5; i++) {
      await repo.insertTransaction({
        id: `tx-${i}`,
        type: 'expense',
        amountMinor: i * 1000,
        currency: 'BDT',
        categoryId: 'food_dining',
        description: `Item ${i}`,
        occurredOn: `2026-11-0${i}`,
        createdAt: 1000 + i,
      });
    }

    const page1 = await repo.searchTransactions({}, { limit: 2 });
    expect(page1.rows.map((r) => r.id)).toEqual(['tx-5', 'tx-4']);
    expect(page1.next).toBeDefined();

    const page2 = await repo.searchTransactions({}, { limit: 2, cursor: page1.next });
    expect(page2.rows.map((r) => r.id)).toEqual(['tx-3', 'tx-2']);
    expect(page2.next).toBeDefined();

    const page3 = await repo.searchTransactions({}, { limit: 2, cursor: page2.next });
    expect(page3.rows.map((r) => r.id)).toEqual(['tx-1']);
    expect(page3.next).toBeUndefined();
  });

  it('paginates 550+ transactions strictly using LIMIT and filtered queries', async () => {
    const repo = new MemoryRepo();
    const txs = Array.from({ length: 550 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0');
      const month = i < 275 ? '10' : '11';
      return {
        id: `bulk-${i}`,
        type: (i % 10 === 0 ? 'income' : 'expense') as 'income' | 'expense',
        amountMinor: (i + 1) * 100,
        currency: 'BDT' as const,
        categoryId: i % 2 === 0 ? 'food_dining' : 'transportation',
        description: i % 5 === 0 ? `Uber ride ${i}` : `Coffee shop ${i}`,
        occurredOn: `2026-${month}-${day}`,
        createdAt: 10_000 + i,
      };
    });
    await repo.insertTransactionsBatch(txs);

    // Filtered search by description + type uses LIMIT 30 per page
    const page1 = await repo.searchTransactions(
      { search: 'uber', type: 'expense' },
      { limit: 30 }
    );
    expect(page1.rows).toHaveLength(30);
    expect(page1.next).toBeDefined();

    // Unfiltered walk across pages covers all 550 without loading everything in 1 query
    let cursor: string | undefined;
    let totalFetched = 0;
    let pageCount = 0;
    do {
      const page = await repo.searchTransactions({}, { limit: 30, cursor });
      expect(page.rows.length).toBeLessThanOrEqual(30);
      totalFetched += page.rows.length;
      cursor = page.next;
      pageCount += 1;
    } while (cursor);

    expect(totalFetched).toBe(550);
    expect(pageCount).toBe(Math.ceil(550 / 30));
  });

  it('seeds default categories with colorKey, rent_income, and fees', async () => {
    const repo = new MemoryRepo();
    const cats = await repo.listCategories();
    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(cats.find((c) => c.id === 'food_dining')).toEqual(
      expect.objectContaining({ icon: 'utensils', colorKey: 'orange' })
    );
    expect(cats.find((c) => c.id === 'rent_income')).toEqual(
      expect.objectContaining({ icon: 'building-2', colorKey: 'violet', kind: 'income' })
    );
    expect(cats.find((c) => c.id === 'fees')).toEqual(
      expect.objectContaining({ name: 'Fees & charges', icon: 'receipt', colorKey: 'gray', kind: 'expense' })
    );
  });

  it('filters searchTransactions by multiple categoryIds and summarizes expense/income totals', async () => {
    const repo = new MemoryRepo();
    await repo.insertTransactionsBatch([
      {
        id: 's1',
        type: 'expense',
        amountMinor: 12000,
        currency: 'BDT',
        categoryId: 'food_dining',
        occurredOn: '2026-11-10',
      },
      {
        id: 's2',
        type: 'expense',
        amountMinor: 8000,
        currency: 'BDT',
        categoryId: 'transportation',
        occurredOn: '2026-11-11',
      },
      {
        id: 's3',
        type: 'expense',
        amountMinor: 5000,
        currency: 'BDT',
        categoryId: 'utilities',
        occurredOn: '2026-11-11',
      },
      {
        id: 's4',
        type: 'income',
        amountMinor: 50000,
        currency: 'BDT',
        categoryId: 'salary',
        occurredOn: '2026-11-12',
      },
    ]);

    const filtered = await repo.searchTransactions(
      { categoryIds: ['food_dining', 'transportation'] },
      { limit: 30 }
    );
    expect(filtered.rows.map((r) => r.id).sort()).toEqual(['s1', 's2']);

    const multiSummary = await repo.summarizeTransactions(
      { categoryIds: ['food_dining', 'salary'] },
      'BDT'
    );
    expect(multiSummary).toEqual({
      count: 2,
      expenseMinor: 12000,
      incomeMinor: 50000,
    });

    const allSummary = await repo.summarizeTransactions({}, 'BDT');
    expect(allSummary).toEqual({
      count: 4,
      expenseMinor: 25000,
      incomeMinor: 50000,
    });
  });
});
