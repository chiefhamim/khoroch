import {
  buildReminderMessage,
  checkDueOverpayment,
  computeDuesOverview,
  dueKindForAction,
  computePersonNetMinor,
  findOpenCycleStartDate,
  formatHomeDuesSummaryLine,
  formatInlineMoney,
  getPersonInitials,
  suggestSettleKindAndAmount,
  toBanglaDigits,
} from './dues';
import type { DueEntry, Person } from './types';

describe('dueKindForAction', () => {
  it('maps gave and got based on the current balance direction', () => {
    expect(dueKindForAction('gave', 0)).toBe('lent');
    expect(dueKindForAction('got', 0)).toBe('borrowed');
    expect(dueKindForAction('got', 1000)).toBe('received_back');
    expect(dueKindForAction('gave', -1000)).toBe('paid_back');
  });
});
function makePerson(partial: Partial<Person> & { id: string; name: string }): Person {
  return {
    colorKey: 'blue',
    honorific: 'none',
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...partial,
  };
}

function makeDue(
  partial: Partial<DueEntry> & {
    id: string;
    personId: string;
    kind: DueEntry['kind'];
    amountMinor: number;
  }
): DueEntry {
  return {
    accountId: null,
    occurredOn: '2026-11-09',
    occurredTime: null,
    note: '',
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null,
    ...partial,
  };
}

describe('dues domain helpers (TEST-CASES-v1.2 §B)', () => {
  const rafi = makePerson({ id: 'p-rafi', name: 'Rafi', honorific: 'bhai', colorKey: 'blue' });
  const nafees = makePerson({ id: 'p-nafees', name: 'Nafees', colorKey: 'teal' });
  const sumi = makePerson({ id: 'p-sumi', name: 'Sumi', honorific: 'apu', colorKey: 'pink' });
  const tareq = makePerson({ id: 'p-tareq', name: 'Tareq', colorKey: 'amber' });

  const fixtureEntries: DueEntry[] = [
    // Rafi: lent 2000 from bKash, received_back 500 -> +1500
    makeDue({
      id: 'd-rafi-1',
      personId: 'p-rafi',
      kind: 'lent',
      amountMinor: 200_000,
      accountId: 'bkash',
      occurredOn: '2026-11-09',
      createdAt: 1000,
    }),
    makeDue({
      id: 'd-rafi-2',
      personId: 'p-rafi',
      kind: 'received_back',
      amountMinor: 50_000,
      accountId: 'bkash',
      occurredOn: '2026-11-11',
      createdAt: 2000,
    }),
    // Nafees: borrowed 2000, paid_back 2000 -> settled (0)
    makeDue({
      id: 'd-nafees-1',
      personId: 'p-nafees',
      kind: 'borrowed',
      amountMinor: 200_000,
      accountId: 'cash',
      occurredOn: '2026-11-08',
      createdAt: 1000,
    }),
    makeDue({
      id: 'd-nafees-2',
      personId: 'p-nafees',
      kind: 'paid_back',
      amountMinor: 200_000,
      accountId: 'cash',
      occurredOn: '2026-11-12',
      createdAt: 2000,
    }),
    // Sumi: lent 500 (no wallet) -> +500
    makeDue({
      id: 'd-sumi-1',
      personId: 'p-sumi',
      kind: 'lent',
      amountMinor: 50_000,
      accountId: null,
      occurredOn: '2026-11-10',
      createdAt: 1500,
    }),
    // Tareq: borrowed 300 -> -300
    makeDue({
      id: 'd-tareq-1',
      personId: 'p-tareq',
      kind: 'borrowed',
      amountMinor: 30_000,
      accountId: 'cash',
      occurredOn: '2026-11-10',
      createdAt: 1600,
    }),
    // Soft-deleted entry must be ignored everywhere
    makeDue({
      id: 'd-rafi-deleted',
      personId: 'p-rafi',
      kind: 'lent',
      amountMinor: 999_900,
      occurredOn: '2026-11-13',
      deletedAt: 5000,
    }),
  ];

  it('computes net balances and Home totals matching every §B assertion', () => {
    const overview = computeDuesOverview([rafi, nafees, sumi, tareq], fixtureEntries);

    expect(overview.youWillGetMinor).toBe(200_000); // Rafi 1500 + Sumi 500 = ৳2,000
    expect(overview.youOweMinor).toBe(30_000); // Tareq ৳300
    expect(overview.openReceivableCount).toBe(2);
    expect(overview.openPayableCount).toBe(1);

    const byId = new Map(overview.allActivePeople.map((s) => [s.person.id, s]));
    expect(byId.get('p-rafi')?.netMinor).toBe(150_000);
    expect(byId.get('p-rafi')?.sinceDate).toBe('2026-11-09');
    expect(byId.get('p-nafees')?.netMinor).toBe(0);
    expect(byId.get('p-nafees')?.sinceDate).toBeNull();
    expect(byId.get('p-sumi')?.netMinor).toBe(50_000);
    expect(byId.get('p-tareq')?.netMinor).toBe(-30_000);

    expect(overview.openPeople.map((s) => s.person.id).sort()).toEqual([
      'p-rafi',
      'p-sumi',
      'p-tareq',
    ]);
    expect(overview.settledPeople.map((s) => s.person.id)).toEqual(['p-nafees']);
    expect(formatHomeDuesSummaryLine(overview, 'BDT')).toBe(
      "You'll get ৳2,000 · You owe ৳300"
    );
  });

  it('formats Home dues line crisply for 1 receivable + 1 payable and single-person states', () => {
    const shuvo = makePerson({ id: 'p-shuvo', name: 'Shuvo' });
    const twoPeople = computeDuesOverview(
      [rafi, shuvo],
      [
        makeDue({ id: 'd1', personId: 'p-rafi', kind: 'lent', amountMinor: 150_000 }),
        makeDue({ id: 'd2', personId: 'p-shuvo', kind: 'borrowed', amountMinor: 30_000 }),
      ]
    );
    expect(formatHomeDuesSummaryLine(twoPeople, 'BDT')).toBe(
      'Rafi owes you ৳1,500 · You owe Shuvo ৳300'
    );

    const onlyRafi = computeDuesOverview(
      [rafi],
      [makeDue({ id: 'd1', personId: 'p-rafi', kind: 'lent', amountMinor: 150_000 })]
    );
    expect(formatHomeDuesSummaryLine(onlyRafi, 'BDT')).toBe('Rafi owes you ৳1,500');
  });

  it('detects overpayment gently without blocking and flips balance sign when applied', () => {
    const check = checkDueOverpayment({
      personName: 'Rafi',
      currentNetMinor: 150_000,
      entryKind: 'received_back',
      amountMinor: 200_000,
      currency: 'BDT',
    });
    expect(check).toEqual({
      isOverpayment: true,
      excessMinor: 50_000,
      warningText: 'This is ৳500 more than Rafi owes',
    });

    const flippedNet = computePersonNetMinor([
      makeDue({ id: '1', personId: 'p-rafi', kind: 'lent', amountMinor: 150_000 }),
      makeDue({ id: '2', personId: 'p-rafi', kind: 'received_back', amountMinor: 200_000 }),
    ]);
    expect(flippedNet).toBe(-50_000);

    expect(suggestSettleKindAndAmount(150_000)).toEqual({
      kind: 'received_back',
      amountMinor: 150_000,
    });
    expect(suggestSettleKindAndAmount(-30_000)).toEqual({
      kind: 'paid_back',
      amountMinor: 30_000,
    });
  });

  it('tracks open cycle start date across prior settlements', () => {
    const entries: DueEntry[] = [
      makeDue({ id: '1', personId: 'p-rafi', kind: 'lent', amountMinor: 50_000, occurredOn: '2026-10-01', createdAt: 1 }),
      makeDue({ id: '2', personId: 'p-rafi', kind: 'received_back', amountMinor: 50_000, occurredOn: '2026-10-05', createdAt: 2 }),
      makeDue({ id: '3', personId: 'p-rafi', kind: 'lent', amountMinor: 200_000, occurredOn: '2026-11-09', createdAt: 3 }),
      makeDue({ id: '4', personId: 'p-rafi', kind: 'received_back', amountMinor: 50_000, occurredOn: '2026-11-11', createdAt: 4 }),
    ];
    expect(findOpenCycleStartDate(entries, 150_000)).toBe('2026-11-09');
  });

  it('builds English and Bangla reminders with Bangla digits and honorifics (PLAN §8.4)', () => {
    expect(toBanglaDigits('৳1,500 on 9 Nov')).toBe('৳১,৫০০ on ৯ Nov');
    expect(formatInlineMoney(150_000, 'BDT')).toBe('৳1,500');
    expect(getPersonInitials('Rafi Ahmed')).toBe('RA');

    const enMsg = buildReminderMessage({
      personName: 'Rafi',
      honorific: 'none',
      amountMinor: 150_000,
      sinceDate: '2026-11-09',
      currency: 'BDT',
      language: 'en',
      referenceYear: 2026,
    });
    expect(enMsg).toBe(
      'Hi Rafi, quick reminder about the ৳1,500 from 9 Nov. Whenever works for you.'
    );

    const bnMsg = buildReminderMessage({
      personName: 'রাফি',
      honorific: 'bhai',
      amountMinor: 150_000,
      sinceDate: '2026-11-09',
      currency: 'BDT',
      language: 'bn',
      referenceYear: 2026,
    });
    expect(bnMsg).toBe(
      'রাফি ভাই, সালাম। ৯ নভেম্বরের ৳১,৫০০ টাকার কথা মনে করিয়ে দিলাম। তাড়া নেই, সুবিধামতো দিও।'
    );

    const bnApu = buildReminderMessage({
      personName: 'সুমি',
      honorific: 'apu',
      amountMinor: 50_000,
      sinceDate: '2026-11-10',
      currency: 'BDT',
      language: 'bn',
      referenceYear: 2026,
    });
    expect(bnApu).toBe(
      'সুমি আপু, সালাম। ১০ নভেম্বরের ৳৫০০ টাকার কথা মনে করিয়ে দিলাম। তাড়া নেই, সুবিধামতো দিও।'
    );
  });
});
