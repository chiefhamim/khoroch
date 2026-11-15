import type { Locale } from './index';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Converts ASCII digits 0-9 into Bengali digits. */
export function toBnDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/**
 * Built-in English labels that come from seed data (default categories, default wallets)
 * or English-only formatters. In Bangla mode they are shown in Bangla; user-typed text is
 * only touched when it exactly matches one of these whole words/phrases.
 * Longest phrases first so "Cash out" wins over "Cash".
 */
const BN_PHRASES: readonly (readonly [string, string])[] = [
  ['Business / Freelance', 'ব্যবসা / ফ্রিল্যান্স'],
  ['Freelance project', 'ফ্রিল্যান্স প্রজেক্ট'],
  ['Office lunch', 'অফিসের দুপুরের খাবার'],
  ['Client payment', 'ক্লায়েন্ট পেমেন্ট'],
  ['Housing & Rent', 'বাসা ও ভাড়া'],
  ['Food & Dining', 'খাবার'],
  ['Fees & charges', 'ফি ও চার্জ'],
  ['Personal Care', 'ব্যক্তিগত যত্ন'],
  ['Gift Received', 'পাওয়া উপহার'],
  ['Other Income', 'অন্যান্য আয়'],
  ['Rent income', 'ভাড়া থেকে আয়'],
  ['Electricity bill', 'বিদ্যুৎ বিল'],
  ['Internet bill', 'ইন্টারনেট বিল'],
  ['Monthly salary', 'মাসিক বেতন'],
  ['Monthly bazar', 'মাসিক বাজার'],
  ['Monthly rent', 'মাসিক ভাড়া'],
  ['Advance rent', 'অগ্রিম ভাড়া'],
  ['Doctor visit', 'ডাক্তার দেখানো'],
  ['Project fee', 'প্রজেক্ট ফি'],
  ['Transportation', 'যাতায়াত'],
  ['Entertainment', 'বিনোদন'],
  ['Subscriptions', 'সাবস্ক্রিপশন'],
  ['Supermarket', 'সুপারমার্কেট'],
  ['Vegetables', 'শাকসবজি'],
  ['Consulting', 'কনসাল্টিং'],
  ['House rent', 'বাসা ভাড়া'],
  ['Mirpur CNG', 'মিরপুর সিএনজি'],
  ['Breakfast', 'সকালের নাস্তা'],
  ['Groceries', 'বাজার-সদাই'],
  ['Utilities', 'ইউটিলিটি বিল'],
  ['Education', 'শিক্ষা'],
  ['Shopping', 'কেনাকাটা'],
  ['Medicine', 'ওষুধ'],
  ['Cashback', 'ক্যাশব্যাক'],
  ['Bus Fare', 'বাস ভাড়া'],
  ['Bus fare', 'বাস ভাড়া'],
  ['Rickshaw', 'রিকশা'],
  ['Cash out', 'ক্যাশ আউট'],
  ['Cash in', 'ক্যাশ ইন'],
  ['Refund', 'রিফান্ড'],
  ['Dinner', 'রাতের খাবার'],
  ['Hidden', 'লুকানো'],
  ['BDT ৳', 'টাকা ৳'],
  ['Coffee', 'কফি'],
  ['Health', 'স্বাস্থ্য'],
  ['Travel', 'ভ্রমণ'],
  ['Family', 'পরিবার'],
  ['Fruits', 'ফলমূল'],
  ['Salary', 'বেতন'],
  ['Lunch', 'দুপুরের খাবার'],
  ['Bonus', 'বোনাস'],
  ['Gifts', 'উপহার'],
  ['Other', 'অন্যান্য'],
  ['bKash', 'বিকাশ'],
  ['Nagad', 'নগদ'],
  ['Rocket', 'রকেট'],
  ['Uber', 'উবার'],
  ['Fuel', 'জ্বালানি'],
  ['Card', 'কার্ড'],
  ['Bank', 'ব্যাংক'],
  ['Cash', 'ক্যাশ'],
  ['CNG', 'সিএনজি'],
];

const BN_MONTHS: Record<string, string> = {
  Jan: 'জানু',
  Feb: 'ফেব্রু',
  Mar: 'মার্চ',
  Apr: 'এপ্রি',
  May: 'মে',
  Jun: 'জুন',
  Jul: 'জুলা',
  Aug: 'আগ',
  Sep: 'সেপ্টে',
  Oct: 'অক্টো',
  Nov: 'নভে',
  Dec: 'ডিসে',
};

const BN_WEEKDAYS: Record<string, string> = {
  Sun: 'রবি',
  Mon: 'সোম',
  Tue: 'মঙ্গল',
  Wed: 'বুধ',
  Thu: 'বৃহঃ',
  Fri: 'শুক্র',
  Sat: 'শনি',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PHRASE_REGEX = new RegExp(
  `(^|[^A-Za-z])(${BN_PHRASES.map(([en]) => escapeRegExp(en)).join('|')})(?![A-Za-z])`,
  'g'
);
const PHRASE_MAP = new Map(BN_PHRASES);
const MONTH_REGEX = /(^|[^A-Za-z])(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?![A-Za-z])/g;
const WEEKDAY_REGEX = /(^|[^A-Za-z])(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?=,)/g;
const MERIDIEM_REGEX = /(\d)\s?(AM|PM)(?![A-Za-z])/g;

/**
 * Final display pass for on-screen text. English keeps text untouched; Bangla converts
 * digits, AM/PM, short month/weekday names and built-in seed labels so screens read fully
 * in Bangla while the taka sign stays as-is.
 */
export function localizeDisplayText(text: string, locale: Locale): string {
  if (locale !== 'bn' || text.length === 0) return text;
  let out = text.replace(PHRASE_REGEX, (_m, pre: string, word: string) => {
    return `${pre}${PHRASE_MAP.get(word) ?? word}`;
  });
  out = out.replace(MERIDIEM_REGEX, (_m, d: string, mer: string) =>
    `${d} ${mer === 'AM' ? 'এএম' : 'পিএম'}`
  );
  out = out.replace(WEEKDAY_REGEX, (_m, pre: string, w: string) => `${pre}${BN_WEEKDAYS[w]}`);
  out = out.replace(MONTH_REGEX, (_m, pre: string, mo: string) => `${pre}${BN_MONTHS[mo]}`);
  return toBnDigits(out);
}
