import { CATEGORY_KEYWORDS, type CategoryKeywordRule } from '@/domain/categories';
import { addDays, isValidLocalDate, todayLocalDate } from '@/domain/dates';
import { normalizeDigits, parseMoneyInput } from '@/domain/money';
import type { Category, LocalDate, TransactionType } from '@/domain/types';

export interface ParsedTransactionDraft {
  id: string;
  type: TransactionType;
  amountMinor: number | null;
  categoryId: string | null;
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
]);

const INCOME_VERB_RE = /\b(received|receive|got|earned|earn|paycheck|salary|income)\b/i;
const EXPENSE_VERB_RE = /\b(spent|spend|paid|pay|bought|buy|purchased|purchase)\b/i;
const NUMBER_LITERAL_RE = /\b\d+(?:\.\d+)?\b/;

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
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(keyword)}(?:$|[^a-z0-9])`, 'i');
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
      .split(/\s*(?:,|\band\b|\s+&\s+)\s*/i)
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
  categories?: readonly Category[]
): { draft: ParsedTransactionDraft; hasExplicitDateWord: boolean } | null {
  let working = clause;
  let occurredOn: LocalDate = today;
  let hasExplicitDateWord = false;

  const isoMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(working);
  if (isoMatch && isValidLocalDate(isoMatch[1])) {
    occurredOn = isoMatch[1];
    hasExplicitDateWord = true;
    working = working.replace(isoMatch[0], ' ');
  } else if (/\byesterday\b/i.test(working)) {
    occurredOn = addDays(today, -1);
    hasExplicitDateWord = true;
  } else if (/\btoday\b/i.test(working)) {
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

  const match = findCategoryMatch(working, categories);
  const hasIncomeVerb = INCOME_VERB_RE.test(working);
  const hasExpenseVerb = EXPENSE_VERB_RE.test(working);

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

  const description = match ? match.rule.label : buildFallbackDescription(working);

  return {
    hasExplicitDateWord,
    draft: {
      id: `draft-${index}`,
      type,
      amountMinor,
      categoryId,
      description,
      occurredOn,
      needsAmount: amountMinor === null,
      needsCategory: categoryId === null,
      requiresConfirmation: true,
    },
  };
}

/**
 * Parses natural-language English / Bangla-numeral transaction text into editable drafts.
 * Every returned draft requires explicit user confirmation and never guesses missing amounts.
 */
export function parse(
  text: string,
  today: LocalDate = todayLocalDate(),
  categories?: readonly Category[]
): ParsedTransactionDraft[] {
  if (!text || !text.trim()) return [];

  const preprocessed = preprocessText(text);
  const withNumbers = replaceNumberPhrases(preprocessed);
  const clauses = splitClauses(withNumbers, categories);

  const parsedEntries: { draft: ParsedTransactionDraft; hasExplicitDateWord: boolean }[] = [];
  for (const clause of clauses) {
    const entry = parseSingleClause(clause, parsedEntries.length, today, categories);
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
