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

  it('never exports the last-wage pointer, and an import resets it to none', async () => {
    const src = new MemoryRepo();
    await src.setSetting('dailyWageLast', { id: 'w1', day: '2026-11-17' });
    const json = await exportBackupJson(src, '2026-11-17T10:00:00.000Z');
    expect(JSON.parse(json).data.settings.dailyWageLast).toBeNull();

    // Even a hand-edited backup that carries a pointer cannot set it.
    const edited = JSON.parse(json);
    edited.data.settings.dailyWageLast = { id: 'w1', day: '2026-11-17' };
    const dst = new MemoryRepo();
    await dst.setSetting('dailyWageLast', { id: 'old', day: '2026-11-17' });
    await restoreBackupPayload(dst, parseAndValidateBackup(JSON.stringify(edited)));
    expect((await dst.getSettings()).dailyWageLast).toBeNull();
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
