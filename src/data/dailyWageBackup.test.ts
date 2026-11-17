import { exportBackupJson, parseAndValidateBackup, restoreBackupPayload } from './backup';
import { MemoryRepo } from './memoryRepo';

const WAGE = { amountMinor: 80_000, categoryId: 'salary', accountId: null };

async function backupWith(dailyWage: unknown): Promise<string> {
  const repo = new MemoryRepo();
  const parsed = JSON.parse(await exportBackupJson(repo, '2026-11-17T10:00:00.000Z'));
  if (dailyWage === undefined) delete parsed.data.settings.dailyWage;
  else parsed.data.settings.dailyWage = dailyWage;
  return JSON.stringify(parsed);
}

describe('daily wage in backups', () => {
  it('exports the wage and restores it into another store', async () => {
    const src = new MemoryRepo();
    await src.setSetting('dailyWage', WAGE);
    const json = await exportBackupJson(src, '2026-11-17T10:00:00.000Z');
    expect(JSON.parse(json).data.settings.dailyWage).toEqual(WAGE);

    const dst = new MemoryRepo();
    await restoreBackupPayload(dst, parseAndValidateBackup(json));
    expect((await dst.getSettings()).dailyWage).toEqual(WAGE);
  });

  it('imports an older backup with no wage field as unset', async () => {
    const parsed = parseAndValidateBackup(await backupWith(undefined));
    expect(parsed.data.settings.dailyWage).toBeNull();
    const dst = new MemoryRepo();
    await dst.setSetting('dailyWage', WAGE);
    await restoreBackupPayload(dst, parsed);
    expect((await dst.getSettings()).dailyWage).toBeNull();
  });

  it('never exports the last-wage pointer, and an import cannot set it from the file', async () => {
    const src = new MemoryRepo();
    await src.setSetting('dailyWageLast', { ids: ['w1'], day: '2026-11-17' });
    const json = await exportBackupJson(src, '2026-11-17T10:00:00.000Z');
    expect(JSON.parse(json).data.settings.dailyWageLast).toBeNull();

    // Even a hand-edited backup that carries a pointer cannot set it: nothing here is live today.
    const edited = JSON.parse(json);
    edited.data.settings.dailyWageLast = { ids: ['w1'], day: '2026-11-17' };
    const dst = new MemoryRepo();
    await dst.setSetting('dailyWageLast', { ids: ['old'], day: '2026-11-17' });
    await restoreBackupPayload(dst, parseAndValidateBackup(JSON.stringify(edited)), '2026-11-17');
    expect((await dst.getSettings()).dailyWageLast).toBeNull();
  });

  describe('the local worked-today pointer across a restore', () => {
    const TODAY = '2026-11-17';
    const wageEntry = (id: string, day = TODAY) => ({
      id,
      type: 'income' as const,
      amountMinor: 80_000,
      currency: 'BDT' as const,
      categoryId: 'business',
      description: 'Business / Freelance',
      occurredOn: day,
      source: 'quick' as const,
    });

    it('keeps the ids that exist as live entries dated today in the restored data', async () => {
      const src = new MemoryRepo();
      await src.insertTransaction(wageEntry('w1'));
      const json = await exportBackupJson(src, '2026-11-17T10:00:00.000Z');

      const dst = new MemoryRepo();
      await dst.insertTransaction(wageEntry('w1'));
      await dst.insertTransaction(wageEntry('w2'));
      await dst.setSetting('dailyWageLast', { ids: ['w1', 'w2'], day: TODAY });
      await restoreBackupPayload(dst, parseAndValidateBackup(json), TODAY);

      // w2 is not in the backup, so it is gone; w1 is restored and still counts.
      expect((await dst.getSettings()).dailyWageLast).toEqual({ ids: ['w1'], day: TODAY });
    });

    it('resets the pointer to none when the restored data has none of the entries', async () => {
      const src = new MemoryRepo();
      const json = await exportBackupJson(src, '2026-11-17T10:00:00.000Z');

      const dst = new MemoryRepo();
      await dst.insertTransaction(wageEntry('w1'));
      await dst.setSetting('dailyWageLast', { ids: ['w1'], day: TODAY });
      await restoreBackupPayload(dst, parseAndValidateBackup(json), TODAY);

      expect((await dst.getSettings()).dailyWageLast).toBeNull();
    });

    it('drops an id the backup restored with another date, or for another day', async () => {
      const src = new MemoryRepo();
      await src.insertTransaction(wageEntry('w1', '2026-11-10'));
      const json = await exportBackupJson(src, '2026-11-17T10:00:00.000Z');

      const dst = new MemoryRepo();
      await dst.insertTransaction(wageEntry('w1'));
      await dst.setSetting('dailyWageLast', { ids: ['w1'], day: TODAY });
      await restoreBackupPayload(dst, parseAndValidateBackup(json), TODAY);
      expect((await dst.getSettings()).dailyWageLast).toBeNull();
    });
  });

  it('accepts an explicit null wage', async () => {
    expect(parseAndValidateBackup(await backupWith(null)).data.settings.dailyWage).toBeNull();
  });

  it.each([
    ['zero amount', { amountMinor: 0, categoryId: 'salary', accountId: null }],
    ['fractional amount', { amountMinor: 1.5, categoryId: 'salary', accountId: null }],
    ['amount above the maximum', { amountMinor: 100_000_000_000, categoryId: 'salary', accountId: null }],
    ['missing category', { amountMinor: 100, categoryId: '', accountId: null }],
    ['not an object', '800'],
  ])('rejects a backup with an invalid wage: %s', async (_label, bad) => {
    const json = await backupWith(bad);
    expect(() => parseAndValidateBackup(json)).toThrow('invalid dailyWage');
  });
});
