import { parseLocalDate } from './dates';
import {
  compactMoney,
  CURRENCIES,
  groupThousands,
  HIDDEN_AMOUNT_TEXT,
  type FormatMoneyOptions,
} from './money';
import type {
  CategoryColorKey,
  CurrencyCode,
  DueEntry,
  DueKind,
  LocalDate,
  Person,
  PersonHonorific,
} from './types';

export const PERSON_AVATAR_COLOR_KEYS: readonly CategoryColorKey[] = [
  'blue',
  'teal',
  'amber',
  'violet',
  'indigo',
  'orange',
  'pink',
  'green',
];

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

const EN_SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const BN_MONTHS_GENITIVE = [
  'জানুয়ারির',
  'ফেব্রুয়ারির',
  'মার্চের',
  'এপ্রিলের',
  'মে-র',
  'জুনের',
  'জুলাইয়ের',
  'আগস্টের',
  'সেপ্টেম্বরের',
  'অক্টোবরের',
  'নভেম্বরের',
  'ডিসেম্বরের',
] as const;

export function pickPersonColorKey(seedIndex: number): CategoryColorKey {
  const safe = Math.abs(Math.trunc(seedIndex)) % PERSON_AVATAR_COLOR_KEYS.length;
  return PERSON_AVATAR_COLOR_KEYS[safe];
}

export function getPersonInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function toBanglaDigits(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      out += BANGLA_DIGITS[code - 48];
    } else {
      out += input[i];
    }
  }
  return out;
}

/**
 * Compact inline money formatter without space after symbol (e.g. `৳1,500`, `৳500.50`)
 * for natural inline sentences, badges, and reminder messages.
 */
export function formatInlineMoney(
  amountMinor: number,
  currency: CurrencyCode = 'BDT',
  options?: FormatMoneyOptions
): string {
  if (options?.hidden) {
    return HIDDEN_AMOUNT_TEXT;
  }
  if (options?.compact) {
    return compactMoney(amountMinor, currency);
  }
  const safe = Math.trunc(amountMinor);
  const abs = Math.abs(safe);
  const frac = abs % 100;
  const whole = (abs - frac) / 100;
  const wholeFormatted = groupThousands(String(whole));
  const includeDecimals = frac !== 0 || Boolean(options?.showPoisha);
  const numPart = includeDecimals
    ? `${wholeFormatted}.${String(frac).padStart(2, '0')}`
    : wholeFormatted;
  const symbol = (CURRENCIES[currency] ?? CURRENCIES.BDT).symbol;
  return `${safe < 0 ? '-' : ''}${symbol}${numPart}`;
}

/**
 * Signed balance change for a person from their due ledger perspective:
 * - Positive balance means the person owes you.
 * - Negative balance means you owe the person.
 */
export function signedDeltaForDueKind(kind: DueKind, amountMinor: number): number {
  const amt = Math.trunc(amountMinor);
  if (kind === 'lent' || kind === 'paid_back') return amt;
  return -amt;
}

function compareDueAsc(a: DueEntry, b: DueEntry): number {
  if (a.occurredOn !== b.occurredOn) return a.occurredOn.localeCompare(b.occurredOn);
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id.localeCompare(b.id);
}

function compareDueDesc(a: DueEntry, b: DueEntry): number {
  return compareDueAsc(b, a);
}

export function computePersonNetMinor(entries: readonly DueEntry[]): number {
  let net = 0;
  for (const e of entries) {
    if (e.deletedAt != null) continue;
    net += signedDeltaForDueKind(e.kind, e.amountMinor);
  }
  return net;
}

/**
 * Finds the start date of the current open balance cycle (i.e. when the running balance
 * most recently moved from settled / opposite sign onto its final sign).
 */
export function findOpenCycleStartDate(
  entries: readonly DueEntry[],
  finalNetMinor: number
): LocalDate | null {
  if (finalNetMinor === 0) return null;
  const activeAsc = entries.filter((e) => e.deletedAt == null).sort(compareDueAsc);
  if (activeAsc.length === 0) return null;

  const targetPositive = finalNetMinor > 0;
  let running = 0;
  let cycleStart: LocalDate | null = null;

  for (const e of activeAsc) {
    const prev = running;
    running += signedDeltaForDueKind(e.kind, e.amountMinor);
    if (targetPositive) {
      if (prev <= 0 && running > 0) {
        cycleStart = e.occurredOn;
      }
    } else {
      if (prev >= 0 && running < 0) {
        cycleStart = e.occurredOn;
      }
    }
  }

  return cycleStart ?? activeAsc[0].occurredOn;
}

export interface PersonSummary {
  person: Person;
  netMinor: number;
  activeEntryCount: number;
  lastActivityOn: LocalDate | null;
  sinceDate: LocalDate | null;
  entries: DueEntry[];
}

export interface DuesOverview {
  youWillGetMinor: number;
  youOweMinor: number;
  openReceivableCount: number;
  openPayableCount: number;
  openPeople: PersonSummary[];
  settledPeople: PersonSummary[];
  allActivePeople: PersonSummary[];
}

export function computeDuesOverview(
  people: readonly Person[],
  dueEntries: readonly DueEntry[]
): DuesOverview {
  const byPerson = new Map<string, DueEntry[]>();
  for (const entry of dueEntries) {
    if (entry.deletedAt != null) continue;
    const list = byPerson.get(entry.personId);
    if (list) list.push(entry);
    else byPerson.set(entry.personId, [entry]);
  }

  let youWillGetMinor = 0;
  let youOweMinor = 0;
  let openReceivableCount = 0;
  let openPayableCount = 0;
  const openPeople: PersonSummary[] = [];
  const settledPeople: PersonSummary[] = [];
  const allActivePeople: PersonSummary[] = [];

  for (const person of people) {
    if (person.archivedAt != null) continue;
    const rawEntries = byPerson.get(person.id) ?? [];
    const sortedDesc = [...rawEntries].sort(compareDueDesc);
    const netMinor = computePersonNetMinor(sortedDesc);
    const sinceDate = findOpenCycleStartDate(sortedDesc, netMinor);
    const lastActivityOn = sortedDesc.length > 0 ? sortedDesc[0].occurredOn : null;

    const summary: PersonSummary = {
      person,
      netMinor,
      activeEntryCount: sortedDesc.length,
      lastActivityOn,
      sinceDate,
      entries: sortedDesc,
    };
    allActivePeople.push(summary);

    if (netMinor > 0) {
      youWillGetMinor += netMinor;
      openReceivableCount += 1;
      openPeople.push(summary);
    } else if (netMinor < 0) {
      youOweMinor += -netMinor;
      openPayableCount += 1;
      openPeople.push(summary);
    } else {
      settledPeople.push(summary);
    }
  }

  const comparePeopleList = (a: PersonSummary, b: PersonSummary): number => {
    const aDate = a.lastActivityOn ?? '';
    const bDate = b.lastActivityOn ?? '';
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    const diffMag = Math.abs(b.netMinor) - Math.abs(a.netMinor);
    if (diffMag !== 0) return diffMag;
    return a.person.name.localeCompare(b.person.name);
  };

  openPeople.sort(comparePeopleList);
  settledPeople.sort(comparePeopleList);
  allActivePeople.sort(comparePeopleList);

  return {
    youWillGetMinor,
    youOweMinor,
    openReceivableCount,
    openPayableCount,
    openPeople,
    settledPeople,
    allActivePeople,
  };
}

export interface OverpaymentCheckResult {
  isOverpayment: boolean;
  excessMinor: number;
  warningText: string | null;
}

export function checkDueOverpayment(params: {
  personName: string;
  currentNetMinor: number;
  entryKind: DueKind;
  amountMinor: number;
  currency: CurrencyCode;
}): OverpaymentCheckResult {
  const { personName, currentNetMinor, entryKind, amountMinor, currency } = params;
  const cleanName = personName.trim() || 'this person';

  if (currentNetMinor > 0 && entryKind === 'received_back' && amountMinor > currentNetMinor) {
    const excessMinor = amountMinor - currentNetMinor;
    return {
      isOverpayment: true,
      excessMinor,
      warningText: `This is ${formatInlineMoney(excessMinor, currency)} more than ${cleanName} owes`,
    };
  }

  if (currentNetMinor < 0 && entryKind === 'paid_back' && amountMinor > -currentNetMinor) {
    const excessMinor = amountMinor - -currentNetMinor;
    return {
      isOverpayment: true,
      excessMinor,
      warningText: `This is ${formatInlineMoney(excessMinor, currency)} more than you owe ${cleanName}`,
    };
  }

  return { isOverpayment: false, excessMinor: 0, warningText: null };
}

export function suggestSettleKindAndAmount(netMinor: number): {
  kind: DueKind;
  amountMinor: number;
} {
  if (netMinor > 0) {
    return { kind: 'received_back', amountMinor: netMinor };
  }
  if (netMinor < 0) {
    return { kind: 'paid_back', amountMinor: -netMinor };
  }
  return { kind: 'lent', amountMinor: 0 };
}

export type ReminderLanguage = 'en' | 'bn';

function formatReminderDateEn(date: LocalDate, referenceYear?: number): string {
  const { year, month, day } = parseLocalDate(date);
  const mon = EN_SHORT_MONTHS[month - 1] ?? String(month);
  if (referenceYear !== undefined && year !== referenceYear) {
    return `${day} ${mon} ${year}`;
  }
  return `${day} ${mon}`;
}

function formatReminderDateBnGenitive(date: LocalDate, referenceYear?: number): string {
  const { year, month, day } = parseLocalDate(date);
  const dayBn = toBanglaDigits(String(day));
  const monGenitive = BN_MONTHS_GENITIVE[month - 1] ?? toBanglaDigits(String(month));
  if (referenceYear !== undefined && year !== referenceYear) {
    return `${dayBn} ${monGenitive.replace(/ের$/, '')} ${toBanglaDigits(String(year))}-এর`;
  }
  return `${dayBn} ${monGenitive}`;
}

export function buildReminderMessage(params: {
  personName: string;
  honorific?: PersonHonorific;
  amountMinor: number;
  sinceDate: LocalDate | null;
  currency: CurrencyCode;
  language: ReminderLanguage;
  netMinor?: number;
  referenceYear?: number;
}): string {
  const {
    personName,
    honorific = 'none',
    amountMinor,
    sinceDate,
    currency,
    language,
    netMinor = amountMinor,
    referenceYear,
  } = params;

  const cleanName = personName.trim() || (language === 'bn' ? 'বন্ধু' : 'there');
  const absMinor = Math.abs(Math.trunc(amountMinor));

  if (language === 'bn') {
    const suffix = honorific === 'bhai' ? ' ভাই' : honorific === 'apu' ? ' আপু' : '';
    const addressed = `${cleanName}${suffix}`;
    const amountBn = toBanglaDigits(formatInlineMoney(absMinor, currency));
    const amountPhrase = currency === 'BDT' ? `${amountBn} টাকার` : `${amountBn}-এর`;
    const datePart = sinceDate
      ? `${formatReminderDateBnGenitive(sinceDate, referenceYear)} `
      : '';

    if (netMinor < 0) {
      return `${addressed}, সালাম। ${datePart}${amountPhrase} হিসাবটা আমার মনে আছে। সুবিধামতো পরিশোধ করে দেবো।`;
    }
    return `${addressed}, সালাম। ${datePart}${amountPhrase} কথা মনে করিয়ে দিলাম। তাড়া নেই, সুবিধামতো দিও।`;
  }

  const suffixEn = honorific === 'bhai' ? ' Bhai' : honorific === 'apu' ? ' Apu' : '';
  const addressedEn = `${cleanName}${suffixEn}`;
  const amountStr = formatInlineMoney(absMinor, currency);
  const dateClause = sinceDate ? ` from ${formatReminderDateEn(sinceDate, referenceYear)}` : '';

  if (netMinor < 0) {
    return `Hi ${addressedEn}, just noting the ${amountStr}${dateClause} that I owe you. Will settle soon.`;
  }
  return `Hi ${addressedEn}, quick reminder about the ${amountStr}${dateClause}. Whenever works for you.`;
}

export function formatHomeDuesSummaryLine(
  overview: DuesOverview,
  currency: CurrencyCode,
  options?: FormatMoneyOptions
): string | null {
  if (overview.openPeople.length === 0) return null;
  if (options?.hidden) return HIDDEN_AMOUNT_TEXT;

  if (overview.openPeople.length === 1) {
    const only = overview.openPeople[0];
    const amt = formatInlineMoney(Math.abs(only.netMinor), currency, options);
    return only.netMinor > 0
      ? `${only.person.name} owes you ${amt}`
      : `You owe ${only.person.name} ${amt}`;
  }

  if (overview.openReceivableCount === 1 && overview.openPayableCount === 1) {
    const rec = overview.openPeople.find((p) => p.netMinor > 0);
    const pay = overview.openPeople.find((p) => p.netMinor < 0);
    if (rec && pay) {
      return `${rec.person.name} owes you ${formatInlineMoney(rec.netMinor, currency, options)} · You owe ${pay.person.name} ${formatInlineMoney(-pay.netMinor, currency, options)}`;
    }
  }

  const parts: string[] = [];
  if (overview.youWillGetMinor > 0) {
    parts.push(`You'll get ${formatInlineMoney(overview.youWillGetMinor, currency, options)}`);
  }
  if (overview.youOweMinor > 0) {
    parts.push(`You owe ${formatInlineMoney(overview.youOweMinor, currency, options)}`);
  }
  return parts.join(' · ');
}
