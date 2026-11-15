import { CATEGORY_KEYWORDS, type CategoryKeywordRule } from '@/domain/categories';
import { addDays, isValidLocalDate, todayLocalDate } from '@/domain/dates';
import { normalizeDigits, parseMoneyInput } from '@/domain/money';
import type {
  Account,
  Category,
  DueKind,
  LocalDate,
  Person,
  TransactionType,
} from '@/domain/types';

export type ParsedDraftKind = 'transaction' | 'transfer' | 'due';

export interface ParserContext {
  accounts?: readonly Account[];
  people?: readonly Person[];
}

export interface ParsedTransactionDraft {
  id: string;
  draftKind?: ParsedDraftKind;
  type: TransactionType;
  amountMinor: number | null;
  categoryId: string | null;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  feeMinor?: number;
  asksFee?: boolean;
  dueKind?: DueKind;
  personId?: string | null;
  personName?: string | null;
  missingWalletName?: string | null;
  missingWalletHint?: string | null;
  description: string;
  occurredOn: LocalDate;
  needsAmount: boolean;
  needsCategory: boolean;
  requiresConfirmation: true;
}

const UNIT_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS_WORDS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const LARGE_SCALE_WORDS: Record<string, number> = {
  thousand: 1000,
  k: 1000,
  lakh: 100000,
  lac: 100000,
};

const SORTED_KEYWORDS: readonly CategoryKeywordRule[] = [...CATEGORY_KEYWORDS].sort(
  (a, b) => b.keyword.length - a.keyword.length
);

const STOP_WORDS = new Set([
  'i',
  'me',
  'my',
  'we',
  'spent',
  'spend',
  'paid',
  'pay',
  'bought',
  'buy',
  'purchase',
  'purchased',
  'received',
  'receive',
  'got',
  'get',
  'earned',
  'earn',
  'on',
  'for',
  'from',
  'at',
  'in',
  'to',
  'of',
  'with',
  'a',
  'an',
  'the',
  'today',
  'yesterday',
  'taka',
  'tk',
  'bdt',
  'টাকা',
  'usd',
  'eur',
  'dollar',
  'dollars',
  'euro',
  'euros',
  'খরচ',
  'হয়েছে',
  'দিয়েছি',
  'কিনেছি',
  'পেয়েছি',
  'লেগেছে',
  'আজ',
  'গতকাল',
  'আমার',
  'আমি',
  'থেকে',
  'জন্য',
  'দিয়ে',
]);

const INCOME_VERB_RE =
  /(?:\b(received|receive|got|earned|earn|paycheck|salary|income)\b|(?:পেয়েছি|বেতন|আয়|ইনকাম|বোনাস))/i;
const EXPENSE_VERB_RE =
  /(?:\b(spent|spend|paid|pay|bought|buy|purchased|purchase)\b|(?:খরচ|দিয়েছি|কিনেছি|লেগেছে))/i;
const NUMBER_LITERAL_RE = /\b\d+(?:\.\d+)?\b/;

interface WalletAliasRule {
  label: string;
  providerKey: string;
  aliases: readonly string[];
}

const KNOWN_WALLET_RULES: readonly WalletAliasRule[] = [
  { label: 'City Bank', providerKey: 'city_bank', aliases: ['city bank', 'citybank'] },
  { label: 'BRAC Bank', providerKey: 'brac_bank', aliases: ['brac bank', 'brac'] },
  { label: 'DBBL', providerKey: 'dbbl', aliases: ['dbbl', 'dutch bangla', 'dutch-bangla'] },
  { label: 'EBL', providerKey: 'ebl', aliases: ['ebl', 'eastern bank'] },
  { label: 'bKash', providerKey: 'bkash', aliases: ['bkash', 'b-kash'] },
  { label: 'Nagad', providerKey: 'nagad', aliases: ['nagad'] },
  { label: 'Rocket', providerKey: 'rocket', aliases: ['rocket'] },
  { label: 'Upay', providerKey: 'upay', aliases: ['upay'] },
];

interface WalletDetectionResult {
  accountId: string | null;
  missingWalletName: string | null;
  missingWalletHint: string | null;
  strippedClause: string;
}

function stripMatchedPhrase(clause: string, phrase: string): string {
  const withPrepRe = new RegExp(
    `(?:\\b(?:from|in|into|via|using|by|on|at|to)\\s+)?(?:^|(?<=\\s))${escapeRegExp(phrase)}(?:$|(?=\\s|[.,!?]))`,
    'gi'
  );
  return clause.replace(withPrepRe, ' ').replace(/\s+/g, ' ').trim();
}

function detectWalletInClause(
  clause: string,
  accounts?: readonly Account[]
): WalletDetectionResult {
  if (!accounts) {
    return {
      accountId: null,
      missingWalletName: null,
      missingWalletHint: null,
      strippedClause: clause,
    };
  }

  const activeAccounts = accounts.filter((a) => a.archivedAt == null);
  // Prevent "cash out" / "cash in" from matching a Cash wallet as source phrase
  const sanitized = clause.replace(/\bcash\s*(?:out|in)\b/gi, ' ');

  // 1. Try matching user's active wallets by longest name or provider first
  const candidates: { account: Account; token: string }[] = [];
  for (const acc of activeAccounts) {
    const trimmedName = acc.name.trim().toLowerCase();
    if (trimmedName.length >= 2) {
      candidates.push({ account: acc, token: trimmedName });
    }
    if (acc.provider) {
      const prov = acc.provider.trim().toLowerCase().replace(/_/g, ' ');
      if (prov.length >= 2 && prov !== trimmedName) {
        candidates.push({ account: acc, token: prov });
      }
      // Also support known aliases for that provider
      const known = KNOWN_WALLET_RULES.find(
        (r) => r.providerKey === acc.provider?.trim().toLowerCase()
      );
      if (known) {
        for (const alias of known.aliases) {
          candidates.push({ account: acc, token: alias });
        }
      }
    }
  }

  candidates.sort((a, b) => b.token.length - a.token.length);
  for (const cand of candidates) {
    if (hasKeywordMatch(sanitized, cand.token)) {
      return {
        accountId: cand.account.id,
        missingWalletName: null,
        missingWalletHint: null,
        strippedClause: stripMatchedPhrase(clause, cand.token),
      };
    }
  }

  // 2. Check known BD wallet / bank names so missing wallets surface helpful hint
  for (const rule of KNOWN_WALLET_RULES) {
    for (const alias of rule.aliases) {
      if (hasKeywordMatch(sanitized, alias)) {
        return {
          accountId: null,
          missingWalletName: rule.label,
          missingWalletHint: `No ${rule.label} wallet yet: add it?`,
          strippedClause: stripMatchedPhrase(clause, alias),
        };
      }
    }
  }

  return {
    accountId: null,
    missingWalletName: null,
    missingWalletHint: null,
    strippedClause: clause,
  };
}

function findPersonByName(
  rawName: string,
  people?: readonly Person[]
): { personId: string | null; personName: string } {
  const cleaned = capitalize(
    rawName
      .replace(/[.,!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
  if (people && cleaned) {
    const lower = cleaned.toLowerCase();
    const matched = people.find(
      (p) => p.archivedAt == null && p.name.trim().toLowerCase() === lower
    );
    if (matched) {
      return { personId: matched.id, personName: matched.name };
    }
  }
  return { personId: null, personName: cleaned };
}

function isWalletOrStopWord(candidate: string): boolean {
  const lower = candidate.trim().toLowerCase();
  if (!lower || STOP_WORDS.has(lower)) return true;
  if (lower === 'me' || lower === 'my' || lower === 'cash' || lower === 'card') return true;
  return KNOWN_WALLET_RULES.some((r) => r.aliases.includes(lower));
}

function detectDueIntent(
  clauseWithoutWallet: string,
  people?: readonly Person[]
): { dueKind: DueKind; personId: string | null; personName: string } | null {
  const cleaned = clauseWithoutWallet
    .replace(/\b(?:today|yesterday|\d{4}-\d{2}-\d{2})\b/gi, ' ')
    .replace(/[৳$€]/g, ' ')
    .replace(/\b(?:taka|tk|bdt|টাকা)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. "<name> paid me back <amt>" / "<name> returned me <amt>"
  const revMatch =
    /^([a-z\u0980-\u09ff][a-z\u0980-\u09ff\s'-]{0,28}?)\s+(?:paid|gave|sent|returned)\s+(?:me\s+)?back(?:\s+\d+(?:\.\d+)?)?$/i.exec(
      cleaned
    );
  if (revMatch && !isWalletOrStopWord(revMatch[1])) {
    const person = findPersonByName(revMatch[1], people);
    if (person.personName) {
      return { dueKind: 'received_back', ...person };
    }
  }

  // Also "got back 500 from rafi" / "received 500 back from rafi"
  const gotBackMatch =
    /\b(?:got|received)\b.*?\bback\b.*?\bfrom\s+([a-z\u0980-\u09ff][a-z\u0980-\u09ff\s'-]{0,28}?)$/i.exec(
      cleaned
    );
  if (gotBackMatch && !isWalletOrStopWord(gotBackMatch[1])) {
    const person = findPersonByName(gotBackMatch[1], people);
    if (person.personName) {
      return { dueKind: 'received_back', ...person };
    }
  }

  // 2. "paid <name> back <amt>" / "paid back <amt> to <name>"
  const paidBackNameMatch =
    /\b(?:paid|returned)\s+([a-z\u0980-\u09ff][a-z\u0980-\u09ff\s'-]{0,28}?)\s+back\b/i.exec(
      cleaned
    );
  if (
    paidBackNameMatch &&
    paidBackNameMatch[1].trim().toLowerCase() !== 'me' &&
    !isWalletOrStopWord(paidBackNameMatch[1])
  ) {
    const person = findPersonByName(paidBackNameMatch[1], people);
    if (person.personName) {
      return { dueKind: 'paid_back', ...person };
    }
  }

  const paidBackToMatch =
    /\b(?:paid|returned)\s+back(?:\s+\d+(?:\.\d+)?)?\s+(?:to\s+)?([a-z\u0980-\u09ff][a-z\u0980-\u09ff\s'-]{0,28}?)$/i.exec(
      cleaned
    );
  if (paidBackToMatch && !isWalletOrStopWord(paidBackToMatch[1])) {
    const person = findPersonByName(paidBackToMatch[1], people);
    if (person.personName) {
      return { dueKind: 'paid_back', ...person };
    }
  }

  // 3. "borrowed <amt> from <name>" / "took <amt> from <name>"
  const borrowedMatch =
    /\b(?:borrowed|took)\b(?:\s+\d+(?:\.\d+)?)?\s+from\s+([a-z\u0980-\u09ff][a-z\u0980-\u09ff\s'-]{0,28}?)$/i.exec(
      cleaned
    );
  if (borrowedMatch && !isWalletOrStopWord(borrowedMatch[1])) {
    const person = findPersonByName(borrowedMatch[1], people);
    if (person.personName) {
      return { dueKind: 'borrowed', ...person };
    }
  }

  // 4. "sent 500 to rafi" / "lent 500 to rafi" / "gave 500 to rafi"
  const sentMatch =
    /\b(?:sent|send|lent|lend|gave|give|loaned|loan)\b(?:\s+\d+(?:\.\d+)?)?\s+to\s+([a-z\u0980-\u09ff][a-z\u0980-\u09ff\s'-]{0,28}?)$/i.exec(
      cleaned
    );
  if (sentMatch && !isWalletOrStopWord(sentMatch[1])) {
    const person = findPersonByName(sentMatch[1], people);
    if (person.personName) {
      return { dueKind: 'lent', ...person };
    }
  }

  return null;
}

function isNumberWordToken(tok: string): boolean {
  return (
    tok in UNIT_WORDS ||
    tok in TENS_WORDS ||
    tok === 'hundred' ||
    tok in LARGE_SCALE_WORDS
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasKeywordMatch(text: string, keyword: string): boolean {
  const normalizedText = text.replace(/\bwi-fi\b/gi, 'wifi');
  const hasBengali = /[\u0980-\u09ff]/.test(keyword);
  const pattern = hasBengali
    ? new RegExp(
        `(?:^|[^a-z0-9\\u0980-\\u09ff])${escapeRegExp(keyword)}(?:ে|তে|য়|র|ের|টা|টি)?(?:$|[^a-z0-9\\u0980-\\u09ff])`,
        'i'
      )
    : new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(keyword)}(?:$|[^a-z0-9])`, 'i');
  return pattern.test(normalizedText);
}

function capitalize(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function preprocessText(raw: string): string {
  let s = normalizeDigits(raw);
  // Remove digit grouping commas (e.g. 25,000 -> 25000, 1,25,000 -> 125000)
  while (/(\d),(\d)/.test(s)) {
    s = s.replace(/(\d),(\d)/g, '$1$2');
  }
  // Separate currency symbols and trailing currency/scale suffixes attached to digits
  s = s.replace(/([৳$€])/g, ' $1 ');
  s = s.replace(/(\d+(?:\.\d+)?)k(?![a-z0-9])/gi, '$1 k');
  s = s.replace(/(\d+(?:\.\d+)?)(taka|tk|bdt|টাকা)(?![a-z\u0980-\u09ff])/gi, '$1 $2');
  // Convert hyphenated compound numbers like twenty-five -> twenty five without altering wi-fi
  s = s.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)\b/gi,
    '$1 $2'
  );
  return s.toLowerCase();
}

/**
 * Replaces English number words and digit+multiplier pairs (e.g. "three hundred",
 * "25 thousand", "1.5 k", "2 lakh") with plain decimal strings while avoiding
 * consuming conjunctions unless joining number-word terms (e.g. "two hundred and fifty").
 */
function replaceNumberPhrases(input: string): string {
  const rawTokens = input.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;

  while (i < rawTokens.length) {
    const cleanTok = rawTokens[i].replace(/^[,;!?]+|[.,;!?]+$/g, '');
    const isDigit = /^\d+(?:\.\d+)?$/.test(cleanTok);
    const isWordStart = cleanTok in UNIT_WORDS || cleanTok in TENS_WORDS;

    if (!isDigit && !isWordStart) {
      out.push(rawTokens[i]);
      i += 1;
      continue;
    }

    // Plain numeric literal only consumes a multiplier if immediately followed by a scale word
    if (isDigit) {
      const nextClean = (rawTokens[i + 1] ?? '').replace(/^[,;!?]+|[.,;!?]+$/g, '');
      const baseVal = Number.parseFloat(cleanTok);
      if (nextClean === 'hundred') {
        out.push(String(Math.round(baseVal * 100 * 100) / 100));
        i += 2;
        continue;
      }
      if (nextClean in LARGE_SCALE_WORDS) {
        out.push(String(Math.round(baseVal * LARGE_SCALE_WORDS[nextClean] * 100) / 100));
        i += 2;
        continue;
      }
      out.push(cleanTok);
      i += 1;
      continue;
    }

    // Number-word sequence (e.g. "three hundred", "two hundred and fifty", "twenty five")
    let total = 0;
    let current = 0;
    let consumed = false;

    while (i < rawTokens.length) {
      const tok = rawTokens[i].replace(/^[,;!?]+|[.,;!?]+$/g, '');
      if (tok in UNIT_WORDS) {
        current += UNIT_WORDS[tok];
        consumed = true;
        i += 1;
      } else if (tok in TENS_WORDS) {
        current += TENS_WORDS[tok];
        consumed = true;
        i += 1;
      } else if (tok === 'hundred') {
        current = (current === 0 ? 1 : current) * 100;
        consumed = true;
        i += 1;
      } else if (tok in LARGE_SCALE_WORDS) {
        total += (current === 0 ? 1 : current) * LARGE_SCALE_WORDS[tok];
        current = 0;
        consumed = true;
        i += 1;
      } else if (
        tok === 'and' &&
        consumed &&
        i + 1 < rawTokens.length &&
        isNumberWordToken(rawTokens[i + 1].replace(/^[,;!?]+|[.,;!?]+$/g, ''))
      ) {
        // Consume "and" inside phrases like "two hundred and fifty"
        i += 1;
      } else {
        break;
      }
    }

    out.push(String(Math.round((total + current) * 100) / 100));
  }

  return out.join(' ');
}

function findCategoryMatch(
  clause: string,
  categories?: readonly Category[]
): { rule: CategoryKeywordRule; fromCustomCategory: boolean } | null {
  for (const rule of SORTED_KEYWORDS) {
    if (hasKeywordMatch(clause, rule.keyword)) {
      return { rule, fromCustomCategory: false };
    }
  }

  if (categories && categories.length > 0) {
    const sortedCats = [...categories]
      .filter((c) => !c.archivedAt)
      .sort((a, b) => b.name.length - a.name.length);
    for (const cat of sortedCats) {
      if (hasKeywordMatch(clause, cat.name.toLowerCase())) {
        return {
          rule: {
            keyword: cat.name.toLowerCase(),
            categoryId: cat.id,
            label: cat.name,
            kind: cat.kind,
          },
          fromCustomCategory: true,
        };
      }
    }
  }

  return null;
}

function splitClauses(normalizedText: string, categories?: readonly Category[]): string[] {
  const masked = normalizedText.replace(/food\s*&\s*dining/gi, 'food_and_dining_kw');
  const hardChunks = masked
    .split(/[;\n]+|\bthen\b/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const clauses: string[] = [];
  for (const chunk of hardChunks) {
    const parts = chunk
      .split(/\s*(?:,|\band\b|\s+&\s+)\s*|\s+(?:আর|এবং|ও)\s+/i)
      .map((p) => p.replace(/food_and_dining_kw/g, 'food & dining').trim())
      .filter(Boolean);

    if (parts.length > 1) {
      const allHaveNumber = parts.every((p) => NUMBER_LITERAL_RE.test(p));
      const noneHaveNumberAndAllHaveCategory =
        parts.every((p) => !NUMBER_LITERAL_RE.test(p)) &&
        parts.every((p) => findCategoryMatch(p, categories) !== null);

      if (allHaveNumber || noneHaveNumberAndAllHaveCategory) {
        clauses.push(...parts);
        continue;
      }
    }

    clauses.push(chunk.replace(/food_and_dining_kw/g, 'food & dining'));
  }

  return clauses;
}

function buildFallbackDescription(clauseWithoutIso: string): string {
  const cleaned = clauseWithoutIso
    .replace(/[৳$€]/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(/[.,!?]+/g, ' ');

  const words = cleaned
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));

  if (words.length === 0) return '';
  return capitalize(words.join(' '));
}

function parseSingleClause(
  clause: string,
  index: number,
  today: LocalDate,
  categories?: readonly Category[],
  context?: ParserContext
): { draft: ParsedTransactionDraft; hasExplicitDateWord: boolean } | null {
  let working = clause;
  let occurredOn: LocalDate = today;
  let hasExplicitDateWord = false;

  const isoMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(working);
  if (isoMatch && isValidLocalDate(isoMatch[1])) {
    occurredOn = isoMatch[1];
    hasExplicitDateWord = true;
    working = working.replace(isoMatch[0], ' ');
  } else if (/\byesterday\b/i.test(working) || /(?:^|\s)গতকাল(?=$|\s)/.test(working)) {
    occurredOn = addDays(today, -1);
    hasExplicitDateWord = true;
  } else if (/\btoday\b/i.test(working) || /(?:^|\s)আজ(?=$|\s)/.test(working)) {
    occurredOn = today;
    hasExplicitDateWord = true;
  }

  const numMatch = NUMBER_LITERAL_RE.exec(working);
  let amountMinor: number | null = null;
  if (numMatch) {
    const parsedMoney = parseMoneyInput(numMatch[0]);
    if (parsedMoney.ok && parsedMoney.minor && parsedMoney.minor > 0) {
      amountMinor = parsedMoney.minor;
    }
  }

  const walletInfo = detectWalletInClause(working, context?.accounts);
  const semanticClause = walletInfo.strippedClause;

  // 1. Transfer pattern: "cash out 1000 bkash"
  if (/\bcash\s*out\b/i.test(working) && amountMinor !== null) {
    const cashAcc = context?.accounts?.find(
      (a) =>
        a.archivedAt == null &&
        (a.kind === 'cash' || a.name.trim().toLowerCase() === 'cash')
    );
    return {
      hasExplicitDateWord,
      draft: {
        id: `draft-${index}`,
        draftKind: 'transfer',
        type: 'expense',
        amountMinor,
        categoryId: null,
        fromAccountId: walletInfo.accountId,
        toAccountId: cashAcc?.id ?? null,
        feeMinor: 0,
        asksFee: true,
        ...(walletInfo.missingWalletName ? { missingWalletName: walletInfo.missingWalletName } : {}),
        ...(walletInfo.missingWalletHint ? { missingWalletHint: walletInfo.missingWalletHint } : {}),
        description: 'Cash out',
        occurredOn,
        needsAmount: false,
        needsCategory: false,
        requiresConfirmation: true,
      },
    };
  }

  // 2. Due pattern: "sent 500 to rafi bkash" / "rafi paid me back 500"
  const dueIntent = detectDueIntent(semanticClause, context?.people);
  if (dueIntent) {
    const descByKind: Record<DueKind, string> = {
      lent: `Lent to ${dueIntent.personName}`,
      borrowed: `Borrowed from ${dueIntent.personName}`,
      received_back: `${dueIntent.personName} paid back`,
      paid_back: `Paid back ${dueIntent.personName}`,
    };
    return {
      hasExplicitDateWord,
      draft: {
        id: `draft-${index}`,
        draftKind: 'due',
        type:
          dueIntent.dueKind === 'received_back' || dueIntent.dueKind === 'borrowed'
            ? 'income'
            : 'expense',
        amountMinor,
        categoryId: null,
        accountId: walletInfo.accountId,
        dueKind: dueIntent.dueKind,
        personId: dueIntent.personId,
        personName: dueIntent.personName,
        ...(walletInfo.missingWalletName ? { missingWalletName: walletInfo.missingWalletName } : {}),
        ...(walletInfo.missingWalletHint ? { missingWalletHint: walletInfo.missingWalletHint } : {}),
        description: descByKind[dueIntent.dueKind],
        occurredOn,
        needsAmount: amountMinor === null,
        needsCategory: false,
        requiresConfirmation: true,
      },
    };
  }

  // 3. Standard transaction parsing
  const match = findCategoryMatch(semanticClause, categories);
  const hasIncomeVerb = INCOME_VERB_RE.test(semanticClause);
  const hasExpenseVerb = EXPENSE_VERB_RE.test(semanticClause);

  if (amountMinor === null && match === null) {
    return null;
  }

  let type: TransactionType = 'expense';
  let categoryId: string | null = match ? match.rule.categoryId : null;

  if (match?.rule.kind === 'income') {
    type = 'income';
  } else if (hasIncomeVerb && !hasExpenseVerb) {
    type = 'income';
    if (categoryId === 'gifts') {
      categoryId = 'gift_received';
    }
  }

  // If caller supplied active categories list, verify categoryId isn't archived
  if (categoryId && categories && categories.length > 0) {
    const found = categories.find((c) => c.id === categoryId && !c.archivedAt);
    if (!found) {
      categoryId = null;
    }
  }

  const description = match ? match.rule.label : buildFallbackDescription(semanticClause);

  const draft: ParsedTransactionDraft = {
    id: `draft-${index}`,
    type,
    amountMinor,
    categoryId,
    description,
    occurredOn,
    needsAmount: amountMinor === null,
    needsCategory: categoryId === null,
    requiresConfirmation: true,
  };

  if (walletInfo.accountId) {
    draft.accountId = walletInfo.accountId;
  }
  if (walletInfo.missingWalletName) {
    draft.missingWalletName = walletInfo.missingWalletName;
  }
  if (walletInfo.missingWalletHint) {
    draft.missingWalletHint = walletInfo.missingWalletHint;
  }

  return {
    hasExplicitDateWord,
    draft,
  };
}

/**
 * Parses natural-language English / Bangla-numeral transaction text into editable drafts.
 * Every returned draft requires explicit user confirmation and never guesses missing amounts.
 */
export function parse(
  text: string,
  today: LocalDate = todayLocalDate(),
  categories?: readonly Category[],
  context?: ParserContext
): ParsedTransactionDraft[] {
  if (!text || !text.trim()) return [];

  const preprocessed = preprocessText(text);
  const withNumbers = replaceNumberPhrases(preprocessed);
  const clauses = splitClauses(withNumbers, categories);

  const parsedEntries: { draft: ParsedTransactionDraft; hasExplicitDateWord: boolean }[] = [];
  for (const clause of clauses) {
    const entry = parseSingleClause(clause, parsedEntries.length, today, categories, context);
    if (entry) {
      parsedEntries.push(entry);
    }
  }

  // If a sentence ends with "yesterday" ("500 on Uber and 200 on coffee yesterday"),
  // apply that relative date only to earlier clauses that didn't specify a date word.
  if (
    parsedEntries.length > 1 &&
    parsedEntries[parsedEntries.length - 1].hasExplicitDateWord &&
    parsedEntries.slice(0, -1).every((e) => !e.hasExplicitDateWord)
  ) {
    const trailingDate = parsedEntries[parsedEntries.length - 1].draft.occurredOn;
    for (let i = 0; i < parsedEntries.length - 1; i++) {
      parsedEntries[i].draft.occurredOn = trailingDate;
    }
  }

  return parsedEntries.map((e) => e.draft);
}
