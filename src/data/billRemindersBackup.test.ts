import { exportBackupJson, parseAndValidateBackup, restoreBackupPayload } from './backup';
import { MemoryRepo } from './memoryRepo';
import { SqliteRepo } from './sqliteRepo';

async function backupWith(billReminders: unknown): Promise<string> {
  const repo = new MemoryRepo();
  const parsed = JSON.parse(await exportBackupJson(repo, '2026-11-17T10:00:00.000Z'));
  if (billReminders === undefined) delete parsed.data.settings.billReminders;
  else parsed.data.settings.billReminders = billReminders;
  return JSON.stringify(parsed);
}

describe('bill reminders in backups', () => {
  it('exports the setting and restores it into another store', async () => {
    const src = new MemoryRepo();
    await src.setSetting('billReminders', { enabled: true, leadDays: 3 });
    const json = await exportBackupJson(src, '2026-11-17T10:00:00.000Z');
    expect(JSON.parse(json).data.settings.billReminders).toEqual({ enabled: true, leadDays: 3 });

    const dst = new MemoryRepo();
    await restoreBackupPayload(dst, parseAndValidateBackup(json));
    expect((await dst.getSettings()).billReminders).toEqual({ enabled: true, leadDays: 3 });
  });

  it('imports an older backup with no field as off with the default lead time', async () => {
    const parsed = parseAndValidateBackup(await backupWith(undefined));
    expect(parsed.data.settings.billReminders).toEqual({ enabled: false, leadDays: 1 });
    const dst = new MemoryRepo();
    await dst.setSetting('billReminders', { enabled: true, leadDays: 0 });
    await restoreBackupPayload(dst, parsed);
    expect((await dst.getSettings()).billReminders).toEqual({ enabled: false, leadDays: 1 });
  });

  it('defaults to off in a fresh store', async () => {
    expect((await new MemoryRepo().getSettings()).billReminders).toEqual({
      enabled: false,
      leadDays: 1,
    });
  });

  it.each([
    ['not an object', 'yes'],
    ['null', null],
    ['enabled not a boolean', { enabled: 'true', leadDays: 1 }],
    ['unknown lead days', { enabled: true, leadDays: 2 }],
    ['missing lead days', { enabled: true }],
    ['fractional lead days', { enabled: true, leadDays: 1.5 }],
  ])('rejects a backup with invalid bill reminders: %s', async (_label, bad) => {
    const json = await backupWith(bad);
    expect(() => parseAndValidateBackup(json)).toThrow('invalid billReminders');
  });

  it('reads the stored value and falls back to off when the stored row is damaged', async () => {
    const rows = [{ key: 'bill_reminders', value: JSON.stringify({ enabled: true, leadDays: 3 }) }];
    const fakeDb = { getAllAsync: jest.fn().mockResolvedValue(rows) };
    const repo = new SqliteRepo(fakeDb as unknown as ConstructorParameters<typeof SqliteRepo>[0]);
    expect((await repo.getSettings()).billReminders).toEqual({ enabled: true, leadDays: 3 });

    fakeDb.getAllAsync.mockResolvedValueOnce([{ key: 'bill_reminders', value: '{"enabled":true,"leadDays":9}' }]);
    expect((await repo.getSettings()).billReminders).toEqual({ enabled: true, leadDays: 1 });
    fakeDb.getAllAsync.mockResolvedValueOnce([{ key: 'bill_reminders', value: 'not json' }]);
    expect((await repo.getSettings()).billReminders).toEqual({ enabled: false, leadDays: 1 });
    fakeDb.getAllAsync.mockResolvedValueOnce([]);
    expect((await repo.getSettings()).billReminders).toEqual({ enabled: false, leadDays: 1 });
  });
});
