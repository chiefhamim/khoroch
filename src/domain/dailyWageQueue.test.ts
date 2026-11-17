import { MemoryRepo } from '@/data/memoryRepo';
import {
  addWageId,
  createSerialQueue,
  hasMatchingQuickWageEntry,
  undoWageEntry,
} from './dailyWage';
import type { Transaction } from './types';

const DAY = '2026-11-17';

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    type: 'income',
    amountMinor: 80_000,
    currency: 'BDT',
    categoryId: 'salary',
    accountId: null,
    transferId: null,
    description: 'Salary',
    note: '',
    occurredOn: DAY,
    occurredTime: '09:00',
    source: 'quick',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...over,
  };
}

const wage = { amountMinor: 80_000, categoryId: 'salary' };

describe('hasMatchingQuickWageEntry', () => {
  it('matches a live quick income entry of today with the same category and exact amount', () => {
    expect(hasMatchingQuickWageEntry(wage, [tx()], DAY)).toBe(true);
  });

  it('does not match a different amount or category', () => {
    expect(hasMatchingQuickWageEntry(wage, [tx({ amountMinor: 80_001 })], DAY)).toBe(false);
    expect(hasMatchingQuickWageEntry(wage, [tx({ categoryId: 'freelance' })], DAY)).toBe(false);
  });

  it('does not match manual, deleted, other-day, expense or transfer entries', () => {
    expect(hasMatchingQuickWageEntry(wage, [tx({ source: 'manual' })], DAY)).toBe(false);
    expect(hasMatchingQuickWageEntry(wage, [tx({ deletedAt: 5 })], DAY)).toBe(false);
    expect(hasMatchingQuickWageEntry(wage, [tx({ occurredOn: '2026-11-16' })], DAY)).toBe(false);
    expect(hasMatchingQuickWageEntry(wage, [tx({ type: 'expense' })], DAY)).toBe(false);
    expect(hasMatchingQuickWageEntry(wage, [tx({ transferId: 'tr' })], DAY)).toBe(false);
    expect(hasMatchingQuickWageEntry(wage, [], DAY)).toBe(false);
  });
});

describe('createSerialQueue', () => {
  it('runs tasks in order and keeps going after a failure', async () => {
    const queue = createSerialQueue();
    const order: string[] = [];
    const slow = queue.run(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push('a');
    });
    const failing = queue.run(async () => {
      order.push('b');
      throw new Error('boom');
    });
    const last = queue.run(async () => {
      order.push('c');
      return 3;
    });
    await expect(failing).rejects.toThrow('boom');
    await slow;
    expect(await last).toBe(3);
    expect(order).toEqual(['a', 'b', 'c']);
  });
});

describe('createSerialQueue with a task timeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('rejects a task that never settles and runs the next one', async () => {
    const queue = createSerialQueue({ taskTimeoutMs: 10_000 });
    const hung = queue.run(() => new Promise<void>(() => {}));
    const hungResult = hung.then(
      () => 'ok',
      (e: Error) => e.message
    );
    const next = queue.run(async () => 'next');
    await jest.advanceTimersByTimeAsync(9_999);
    let settled = false;
    void hungResult.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(2);
    expect(await hungResult).toBe('Queued task timed out');
    expect(await next).toBe('next');
  });

  it('does not fire for tasks that finish in time, and keeps order', async () => {
    const queue = createSerialQueue({ taskTimeoutMs: 10_000 });
    const order: string[] = [];
    const a = queue.run(async () => {
      await new Promise((r) => setTimeout(r, 5_000));
      order.push('a');
      return 1;
    });
    const b = queue.run(async () => {
      order.push('b');
      return 2;
    });
    await jest.advanceTimersByTimeAsync(5_000);
    expect(await a).toBe(1);
    expect(await b).toBe(2);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(order).toEqual(['a', 'b']);
  });
});

describe('Undo of entry A racing a second record B', () => {
  async function seedA(repo: MemoryRepo) {
    await repo.insertTransaction(tx({ id: 'A' }) as never);
    await repo.setSetting('dailyWageLast', addWageId(null, 'A', DAY));
  }

  // The record step as the screen does it: read the latest pointer, insert, write the pointer.
  async function recordB(repo: MemoryRepo) {
    const previous = (await repo.getSettings()).dailyWageLast;
    await new Promise((r) => setTimeout(r, 10));
    await repo.insertTransaction(tx({ id: 'B', createdAt: 2 }) as never);
    await repo.setSetting('dailyWageLast', addWageId(previous, 'B', DAY));
  }

  it('through one queue leaves the day recorded with [B], in either order', async () => {
    for (const undoFirst of [true, false]) {
      const repo = new MemoryRepo();
      await seedA(repo);
      const queue = createSerialQueue();
      const jobs = undoFirst
        ? [queue.run(() => undoWageEntry(repo, 'A')), queue.run(() => recordB(repo))]
        : [queue.run(() => recordB(repo)), queue.run(() => undoWageEntry(repo, 'A'))];
      await Promise.all(jobs);
      expect((await repo.getSettings()).dailyWageLast).toEqual({ day: DAY, ids: ['B'] });
    }
  });

  it('Undo removes only its own id from the freshly read pointer', async () => {
    const repo = new MemoryRepo();
    await seedA(repo);
    await repo.insertTransaction(tx({ id: 'B', createdAt: 2 }) as never);
    await repo.setSetting('dailyWageLast', { day: DAY, ids: ['A', 'B'] });
    await undoWageEntry(repo, 'A');
    expect((await repo.getSettings()).dailyWageLast).toEqual({ day: DAY, ids: ['B'] });
    await undoWageEntry(repo, 'B');
    expect((await repo.getSettings()).dailyWageLast).toBeNull();
  });
});
