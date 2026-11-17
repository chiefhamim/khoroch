import {
  buildReminderMessage,
  checkDueOverpayment,
  computeDuesOverview,
  computeOpenDueEntries,
  computePersonDueSchedule,
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
    dueOn: null,
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

    expect(
      formatHomeDuesSummaryLine(twoPeople, 'BDT', undefined, {
        personOwesYou: (name, amount) => `${name}-এর কাছে পাওনা ${amount}`,
        youOwePerson: (name, amount) => `${name}-কে দেবেন ${amount}`,
        youWillGet: (amount) => `আপনি পাবেন ${amount}`,
        youOwe: (amount) => `আপনার দেনা ${amount}`,
      })
    ).toBe('Rafi-এর কাছে পাওনা ৳1,500 · Shuvo-কে দেবেন ৳300');
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

    const localizedCheck = checkDueOverpayment({
      personName: 'Tanvir',
      currentNetMinor: -80_000,
      entryKind: 'paid_back',
      amountMinor: 100_000,
      currency: 'BDT',
      formatters: {
        moreThanYouOwe: (excess, name) =>
          `আপনি ${name}-কে যতটুকু দেবেন তার চেয়ে ${excess} বেশি হয়েছে`,
      },
    });
    expect(localizedCheck).toEqual({
      isOverpayment: true,
      excessMinor: 20_000,
      warningText: 'আপনি Tanvir-কে যতটুকু দেবেন তার চেয়ে ৳200 বেশি হয়েছে',
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

describe('due dates: overdue, next due, days until or since', () => {
  const lent = (id: string, amountMinor: number, dueOn: string | null, createdAt = 1000) =>
    makeDue({ id, personId: 'p', kind: 'lent', amountMinor, dueOn, createdAt });
  const back = (id: string, amountMinor: number, createdAt = 2000) =>
    makeDue({ id, personId: 'p', kind: 'received_back', amountMinor, createdAt });

  it('one dated entry: due in the future, today and in the past', () => {
    const entries = [lent('a', 100_000, '2026-11-20')];

    expect(computePersonDueSchedule(entries, '2026-11-17')).toMatchObject({
      overdueMinor: 0,
      nextDueOn: '2026-11-20',
      daysUntilNext: 3,
    });
    expect(computePersonDueSchedule(entries, '2026-11-20')).toMatchObject({
      overdueMinor: 0,
      nextDueOn: '2026-11-20',
      daysUntilNext: 0,
    });
    expect(computePersonDueSchedule(entries, '2026-11-21')).toMatchObject({
      overdueMinor: 100_000,
      nextDueOn: '2026-11-20',
      daysUntilNext: -1,
    });
  });

  it('yesterday counts as overdue by 1 day', () => {
    const s = computePersonDueSchedule([lent('a', 50_050, '2026-11-16')], '2026-11-17');
    expect(s.overdueMinor).toBe(50_050);
    expect(s.daysUntilNext).toBe(-1);
  });

  it('days are calendar days across a month and year boundary', () => {
    expect(
      computePersonDueSchedule([lent('a', 100, '2027-01-02')], '2026-12-30').daysUntilNext
    ).toBe(3);
    expect(
      computePersonDueSchedule([lent('a', 100, '2026-02-27')], '2026-03-02').daysUntilNext
    ).toBe(-3);
  });

  it('an entry settled in full is never overdue, and no due date is reported', () => {
    const entries = [lent('a', 100_000, '2026-10-01'), back('r', 100_000)];
    expect(computeOpenDueEntries(entries)).toEqual([]);
    expect(computePersonDueSchedule(entries, '2026-11-17')).toEqual({
      openDatedEntries: [],
      overdueMinor: 0,
      nextDueOn: null,
      daysUntilNext: null,
    });
  });

  it('entries without a due date are never overdue and give no next due date', () => {
    const s = computePersonDueSchedule([lent('a', 100_000, null)], '2026-11-17');
    expect(s).toEqual({
      openDatedEntries: [],
      overdueMinor: 0,
      nextDueOn: null,
      daysUntilNext: null,
    });
  });

  it('repayments reduce the oldest due dates first (partial repayment)', () => {
    const entries = [
      lent('late', 60_000, '2026-11-01'),
      lent('soon', 40_000, '2026-11-25'),
      back('r', 70_000),
    ];
    // 70,000 repaid: clears 'late' (60,000) and 10,000 of 'soon'.
    const open = computeOpenDueEntries(entries);
    expect(open.map((o) => [o.entry.id, o.openMinor])).toEqual([['soon', 30_000]]);

    const s = computePersonDueSchedule(entries, '2026-11-17');
    expect(s.overdueMinor).toBe(0);
    expect(s.nextDueOn).toBe('2026-11-25');
    expect(s.daysUntilNext).toBe(8);
  });

  it('a partial repayment shrinks the overdue amount instead of removing it', () => {
    const entries = [lent('late', 100_000, '2026-11-01'), back('r', 30_000)];
    const s = computePersonDueSchedule(entries, '2026-11-17');
    expect(s.overdueMinor).toBe(70_000);
    expect(s.openDatedEntries.map((o) => o.openMinor)).toEqual([70_000]);
    expect(s.daysUntilNext).toBe(-16);
  });

  it('order is by due date, not by the day the money was lent', () => {
    const entries = [
      lent('lent-first-due-later', 50_000, '2026-12-10', 1000),
      lent('lent-later-due-first', 50_000, '2026-11-10', 2000),
      back('r', 50_000, 3000),
    ];
    const open = computeOpenDueEntries(entries);
    expect(open.map((o) => o.entry.id)).toEqual(['lent-first-due-later']);
    expect(computePersonDueSchedule(entries, '2026-11-17').overdueMinor).toBe(0);
  });

  it('undated entries are repaid after dated ones, and stay open', () => {
    const entries = [
      lent('undated', 40_000, null, 500),
      lent('dated', 60_000, '2026-11-01', 1000),
      back('r', 60_000),
    ];
    const open = computeOpenDueEntries(entries);
    expect(open.map((o) => [o.entry.id, o.openMinor])).toEqual([['undated', 40_000]]);
    expect(computePersonDueSchedule(entries, '2026-11-17').overdueMinor).toBe(0);
  });

  it('deleted entries are ignored', () => {
    const entries = [
      lent('a', 100_000, '2026-11-01'),
      makeDue({
        id: 'gone',
        personId: 'p',
        kind: 'received_back',
        amountMinor: 100_000,
        deletedAt: 5,
      }),
    ];
    expect(computePersonDueSchedule(entries, '2026-11-17').overdueMinor).toBe(100_000);
  });

  it('works for money you borrowed (you owe) with paid_back as the repayment', () => {
    const entries = [
      makeDue({ id: 'b', personId: 'p', kind: 'borrowed', amountMinor: 80_000, dueOn: '2026-11-10' }),
      makeDue({ id: 'pb', personId: 'p', kind: 'paid_back', amountMinor: 30_000, createdAt: 2000 }),
    ];
    const s = computePersonDueSchedule(entries, '2026-11-17');
    expect(s.overdueMinor).toBe(50_000);
    expect(s.daysUntilNext).toBe(-7);
  });

  it('after an overpayment flips the balance, the old lent entries are not open', () => {
    const entries = [lent('a', 100_000, '2026-11-01'), back('r', 150_000)];
    // net is -50,000 and there is no dated borrowed entry to be overdue.
    expect(computePersonDueSchedule(entries, '2026-11-17').overdueMinor).toBe(0);
    expect(computeOpenDueEntries(entries)).toEqual([]);
  });

  it('sums several overdue entries exactly in integer minor units', () => {
    const entries = [
      lent('a', 10_001, '2026-11-01'),
      lent('b', 20_002, '2026-11-05'),
      lent('c', 30_003, '2026-11-30'),
    ];
    const s = computePersonDueSchedule(entries, '2026-11-17');
    expect(s.overdueMinor).toBe(30_003);
    expect(s.nextDueOn).toBe('2026-11-01');
    expect(s.daysUntilNext).toBe(-16);
  });
});
