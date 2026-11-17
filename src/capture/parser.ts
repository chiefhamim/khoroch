import { CATEGORY_KEYWORDS } from '@/domain/categories';
import { currentLocalTime, formatLocalDate, isValidLocalDate, todayLocalDate } from '@/domain/dates';
import { normalizeDigits, parseMoneyInput } from '@/domain/money';
import type {
  Account,
  CaptureSource,
  LocalDate,
  LocalTime,
  NewPendingDraft,
  TransactionType,
} from '@/domain/types';

export interface CaptureParserContext {
  accounts?: readonly Account[];
  defaultDate?: LocalDate;
  senderHint?: string;
}

const MONTHS_BY_NAME: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const SORTED_KEYWORDS = [...CATEGORY_KEYWORDS].sort(
  (a, b) => b.keyword.length - a.keyword.length
);

const NON_TRANSACTION_NOISE_RE =
  /\b(?:otp|one\s*time\s*password|verification\s*code|pass\s*code|pin\s*code|valid\s*for\s*\d+\s*min|account\s*binding|month-end\s*balance|your\s+tq\s+limit|successfully\s+enrolled|successfully\s+registered|endorse\s+up\s+to|home\s+packages|will\s+be\s+delivered|you\s+are\s+enlisted|us\$\s*200\s*খরচ|get\s+tk\.?\s*\d+\s+bonus|win\s+tk\.?\s*\d+)\b|অবশিষ্ট\s*ভলিউম|বিশেষ\s*অফার|লোনের\s*যোগ্য|জিতে\s*নিন\s*[০-৯0-9,]+\s*(?:বোনাস|টাকা|রিওয়ার্ড)|বোনাস\s*রিওয়ার্ড/i;

const ISP_PAYMENT_RECEIPT_RE =
  /\bwe\s+have\s+received\b[\s\S]*\byour\s+account\s+will\s+be\s+active\b/i;

const EXPENSE_HINT_RE =
  /\b(cash\s*out|send\s*money|payment|paid|purchase|transacted|transferred|debited|debit|withdrawn|withdrawal|mobile\s*recharge|received\s+airtime\s+request|airtime|recharge|bill\s*(?:successfully\s*)?paid|bill\s*pay|pay\s*bill|biller\s*:|transfer\s*out|spent|emi|pos|atm|charge|fee)\b/i;

const INCOME_HINT_RE =
  /\b(cash\s*in|received|credit(?:ed)?|deposit(?:ed)?|add\s*money|refund|cashback|salary|reversal)\b/i;

const TRX_ID_ONLY_RE =
  /\b(?:trx\s*id|txn\s*id|txnid|transaction\s*id|tx\s*id)\s*[:#-]?\s*([A-Z0-9]{5,24})\b/i;

const EXPLICIT_REF_RE =
  /\bref(?:erence)?(?:\s*(?:id|no|#))?\s*[:#-]?\s*([A-Z0-9_-]{3,20})\b/i;

const CARD_LAST4_REF_RE = /\bcard#\*{1,4}(\d{3,4})\b/i;
const ACCOUNT_MASK_REF_RE = /\ba\/c#?\s*:?\s*([0-9*]{4,16})\b/i;

const TRX_ID_RE =
  /\b(?:trx\s*id|txn\s*id|txnid|transaction\s*id|tx\s*id|ref(?:\.|erence)?\s*(?:id|no)?)\s*[:#-]?\s*([A-Z0-9]{5,24})\b/i;

const FEE_RE = /\bfee\s*[:=-]?\s*(?:tk\.?|bdt|৳)?\s*([\d,]+(?:\.\d{1,2})?)/i;

const PRIORITY_AMOUNT_PATTERNS: readonly RegExp[] = [
  /\b(?:cash\s*out|cash\s*in|send\s*money|add\s*money|payment\s*(?:of)?|purchase\s*(?:of)?|debited\s*(?:with|by|for)?|credited\s*(?:with|by|for)?|withdrawn|mobile\s*recharge|received|transferred|amount\s*[:=-]?|net\s*payable|grand\s*total|total\s*payable|amount\s*paid|total)\s*[:=-]?\s*(?:of\s*)?(?:tk\.?|bdt|৳)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /\b(?:tk\.?|bdt|৳)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /([\d,]+(?:\.\d{1,2})?)\s*(?:tk\.?|bdt|taka|৳)\b/i,
];

function stripBalanceTail(text: string): string {
  return text
    .replace(/\b(?:new\s*|current\s*a\/c\s*|available\s*|your\s*a\/c\s*)?bal(?:ance)?\b[\s\S]*$/i, '')
    .trim();
}

interface ExtractedAmountResult {
  amountMinor: number;
  foreignLabel: string | null;
}

function extractMoneyWithMeta(rawText: string, source: CaptureSource): ExtractedAmountResult | null {
  const normalized = normalizeDigits(rawText);
  const candidateText = source === 'ocr_receipt' ? normalized : stripBalanceTail(normalized);
  const searchPool = candidateText.length > 0 ? candidateText : normalized;

  if (source === 'ocr_receipt') {
    const totalMatches = [
      ...normalized.matchAll(
        /\b(?:grand\s*total|net\s*payable|total\s*payable|total\s*amount|total|paid)\b[^\d\n]{0,16}(?:tk\.?|bdt|৳)?\s*([\d,]+(?:\.\d{1,2})?)/gi
      ),
    ];
    for (let i = totalMatches.length - 1; i >= 0; i -= 1) {
      const parsed = parseMoneyInput(totalMatches[i][1]);
      if (parsed.ok && parsed.minor !== null && parsed.minor > 0) {
        return { amountMinor: parsed.minor, foreignLabel: null };
      }
    }
  }

  for (const pattern of PRIORITY_AMOUNT_PATTERNS) {
    const match = pattern.exec(searchPool);
    if (!match) continue;
    const parsed = parseMoneyInput(match[1]);
    if (parsed.ok && parsed.minor !== null && parsed.minor > 0) {
      return { amountMinor: parsed.minor, foreignLabel: null };
    }
  }

  // A foreign-currency amount (USD) is never converted: no rate is invented, so no draft is made.
  return null;
}

export function extractMoneyMinorFromText(rawText: string, source: CaptureSource): number | null {
  return extractMoneyWithMeta(rawText, source)?.amountMinor ?? null;
}

export function extractDateFromText(rawText: string, fallback: LocalDate): LocalDate {
  const norm = normalizeDigits(rawText).replace(
    /\b(?:active\s+until|valid\s+(?:till|until|thru)|until|till|expir(?:es|y))\s+(?:\d{1,2}[/-]\d{1,2}[/-](?:20\d{2}|\d{2})|20\d{2}[-/]\d{1,2}[-/]\d{1,2})/gi,
    ' '
  );

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/.exec(norm);
  if (isoMatch) {
    const candidate = formatLocalDate(
      Number.parseInt(isoMatch[1], 10),
      Number.parseInt(isoMatch[2], 10),
      Number.parseInt(isoMatch[3], 10)
    );
    if (isValidLocalDate(candidate)) return candidate;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YY
  const dmyMatch = /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b/.exec(norm);
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1], 10);
    const month = Number.parseInt(dmyMatch[2], 10);
    const rawYear = Number.parseInt(dmyMatch[3], 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const candidate = formatLocalDate(year, month, day);
    if (isValidLocalDate(candidate)) return candidate;
  }

  // DD MMM YYYY (e.g. 15 Nov 2026 or 15-Nov-26)
  const textMonthMatch = /\b(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,-]+(20\d{2}|\d{2})\b/.exec(norm);
  if (textMonthMatch) {
    const day = Number.parseInt(textMonthMatch[1], 10);
    const month = MONTHS_BY_NAME[textMonthMatch[2].toLowerCase()];
    const rawYear = Number.parseInt(textMonthMatch[3], 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (month) {
      const candidate = formatLocalDate(year, month, day);
      if (isValidLocalDate(candidate)) return candidate;
    }
  }

  return fallback;
}

export function extractTimeFromText(rawText: string): LocalTime | null {
  const norm = normalizeDigits(rawText);
  const match = /\b(\d{1,2}):(\d{2})(?:\s*(AM|PM))?\b/i.exec(norm);
  if (!match) return null;
  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  const mer = match[3]?.toUpperCase();
  if (mer === 'PM' && hour < 12) hour += 12;
  if (mer === 'AM' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function matchAccountFromText(
  rawText: string,
  accounts: readonly Account[],
  senderHint?: string
): Account | null {
  const combined = senderHint ? `${senderHint} ${rawText}` : rawText;
  const lower = combined.toLowerCase();
  const bodyLower = rawText.toLowerCase();
  const active = accounts.filter((a) => a.archivedAt == null);
  const findBkash = () => active.find((a) => a.provider === 'bkash' || /bkash/i.test(a.name)) ?? null;
  const findBank = () => active.find((a) => a.kind === 'bank') ?? null;
  const findCard = () => active.find((a) => a.kind === 'credit_card') ?? null;

  // 1. Exact card last4 / card# pattern takes precedence over issuing bank name (e.g. BRAC Bank card#***3829)
  for (const acc of active) {
    if (acc.last4 && lower.includes(acc.last4)) {
      return acc;
    }
  }
  if (/\busing\s+card#|card#\*{1,4}\d{3,4}|\bcredit\s*card\b|\bvisa\b|\bmastercard\b/i.test(lower)) {
    const cardAcc = findCard();
    if (cardAcc) return cardAcc;
  }

  // 2. bKash iBanking Add Money & bKash Multi-line Pay Bill SMS templates
  if (
    /\byou\s+have\s+received\s+deposit\s+from\s+ibanking\b/i.test(bodyLower) ||
    (/\bbiller\s*:/i.test(bodyLower) && TRX_ID_RE.test(rawText)) ||
    /\bbka\.sh\b/i.test(lower)
  ) {
    const bk = findBkash();
    if (bk) return bk;
  }

  // 3. Explicit source before destination on transfers ("transferred from your BBL A/C ... to BKASH wallet")
  const sourceClauseMatch =
    /\b(?:transferred|debited)\s+from\s+(?:your\s+)?([^\n.]{3,50}?)\s+to\b/i.exec(bodyLower);
  if (sourceClauseMatch) {
    const srcLower = sourceClauseMatch[1];
    if (/\b(?:bbl|brac|ncc|city|ebl|dbbl|a\/c|bank)\b/i.test(srcLower)) {
      const bankAcc = findBank();
      if (bankAcc) return bankAcc;
    }
  }

  // 4. Direct wallet name/provider match (excluding "Cash Out / Cash In" against physical Cash wallet)
  const normalizedWithoutCashMfs = lower.replace(/\bcash\s*(?:out|in|back)\b/g, ' ');
  for (const acc of active) {
    const nameLower = acc.name.trim().toLowerCase();
    const haystack = acc.kind === 'cash' ? normalizedWithoutCashMfs : lower;
    if (
      nameLower.length >= 3 &&
      new RegExp(`\\b${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack)
    ) {
      return acc;
    }
    if (acc.provider && lower.includes(acc.provider.toLowerCase())) {
      return acc;
    }
  }

  if (lower.includes('bkash') || /\b(?:trxid|txn\s*id)\s*[:#-]?\s*(?:bk|d[ijk])/i.test(lower)) {
    return findBkash();
  }
  if (lower.includes('nagad')) {
    return active.find((a) => a.provider === 'nagad' || /nagad/i.test(a.name)) ?? null;
  }
  if (lower.includes('rocket') || lower.includes('dbbl')) {
    return active.find((a) => a.provider === 'rocket' || /rocket|dbbl/i.test(a.name)) ?? null;
  }
  if (lower.includes('upay')) {
    return active.find((a) => a.provider === 'upay' || /upay/i.test(a.name)) ?? null;
  }
  if (
    /\b(?:brac|bbl|ncc|nccbank|city|ebl|islami\s*bank|pubali|prime\s*bank|bank|a\/c#?)\b/i.test(
      lower
    )
  ) {
    return findBank();
  }
  if (/\b(?:cash\s*(?:out|in)|received\s+tk|fee\s*tk)\b/i.test(bodyLower) && TRX_ID_RE.test(rawText)) {
    return active.find((a) => a.kind === 'mobile_wallet') ?? null;
  }
  return null;
}

export function matchCategoryIdFromText(rawText: string, type: TransactionType): string | null {
  const lower = rawText.toLowerCase();
  for (const rule of SORTED_KEYWORDS) {
    if (rule.kind && rule.kind !== type) continue;
    if (lower.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId;
    }
  }
  if (type === 'expense') {
    if (/\b(shwapno|unimart|agora|meena\s*bazar|chaldal|super\s*shop|grocery)\b/i.test(lower)) {
      return 'groceries';
    }
    if (/\b(foodpanda|pathao\s*food|kfc|restaurant|cafe|coffee|hotel|dine|tea|lunch|dinner)\b/i.test(lower)) {
      return 'food_dining';
    }
    if (/\b(uber|pathao|cng|metro|bus|fuel|octane|petrol|toll|airline|ticket)\b/i.test(lower)) {
      return 'transportation';
    }
    if (
      /\b(desco|dpdc|titas|wasa|nesco|reb|electric|electricity|gas|dotinternet|dot\s*internet|dot\.bil\.pe|link3|carnival|amber|internet|broadband|isp|biller|airtime|recharge|topup|airtel|gp|grameenphone|robi|banglalink|teletalk)\b/i.test(
        lower
      )
    ) {
      return 'utilities';
    }
    if (/\b(google\s*one|google\s*\*|github|openai|chatgpt|netflix|spotify|youtube|icloud|subscription)\b/i.test(lower)) {
      return 'subscriptions';
    }
    if (/\b(daraz|rokomari|pickaboo|startech|aarong|chaldal|shopping)\b/i.test(lower)) {
      return 'shopping';
    }
    if (/\b(pharma|lazz|hospital|clinic|diagnostic|doctor|medicine)\b/i.test(lower)) {
      return 'health';
    }
    if (/\b(cash\s*out|fee|charge)\b/i.test(lower) && !/\bnpsb\b/i.test(lower)) {
      return 'fees';
    }
  } else {
    if (/\b(salary|payroll)\b/i.test(lower)) return 'salary';
    if (/\b(cashback|reward)\b/i.test(lower)) return 'gift_received';
    if (/\b(freelance|client|invoice|upwork|fiverr)\b/i.test(lower)) return 'business';
  }
  return null;
}

function stripPromoFooter(text: string): string {
  return text
    .replace(
      /\s*(?:\b(?:Refer\s+bKash|Download\s+(?:the\s+)?(?:bKash|App)|Click\s+bKa\.sh\S*|Get\s+\d+%?\s*bonus|Win\s+TK|Visit\s+https?:|Dial\s+\*|Queries:\s*call|For\s+Enquiry\s+call|Helpline\s*:|Use\s+bKash\s+App|for\s+bKash\s+App)\b|https?:\/\/\S+)[\s\S]*$/i,
      ''
    )
    .trim();
}

function extractSmsHeaderMeta(raw: string): {
  cleanBody: string;
  metaDate: LocalDate | null;
  metaTime: LocalTime | null;
  metaSender: string | null;
} {
  let rest = raw.trim();
  let metaDate: LocalDate | null = null;
  let metaTime: LocalTime | null = null;
  let metaSender: string | null = null;

  const dtHeader = /^\[(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\]\s*/.exec(rest);
  if (dtHeader) {
    if (isValidLocalDate(dtHeader[1] as LocalDate)) {
      metaDate = dtHeader[1] as LocalDate;
    }
    if (dtHeader[2]) {
      metaTime = dtHeader[2] as LocalTime;
    }
    rest = rest.slice(dtHeader[0].length);
  }

  const senderHeader = /^\[([^\]]{2,32})\]\s*/.exec(rest);
  if (senderHeader) {
    metaSender = senderHeader[1].trim();
    rest = rest.slice(senderHeader[0].length);
  }

  return { cleanBody: rest.trim(), metaDate, metaTime, metaSender };
}

function extractReferenceDisplay(rawText: string): {
  uniqueTrxId: string | null;
  displayRef: string | null;
} {
  const trxMatch = TRX_ID_ONLY_RE.exec(rawText);
  if (trxMatch) {
    const id = trxMatch[1].toUpperCase();
    return { uniqueTrxId: id, displayRef: id };
  }
  const refMatch = EXPLICIT_REF_RE.exec(rawText);
  if (refMatch) {
    const refVal = refMatch[1].trim();
    if (!/^(?:id|no|uiop|1)$/i.test(refVal) && refVal.length >= 4) {
      return { uniqueTrxId: refVal.length >= 6 ? refVal.toUpperCase() : null, displayRef: `Ref ${refVal}` };
    }
    return { uniqueTrxId: null, displayRef: `Ref ${refVal}` };
  }
  const cardMatch = CARD_LAST4_REF_RE.exec(rawText);
  if (cardMatch) {
    return { uniqueTrxId: null, displayRef: `Card **${cardMatch[1]}` };
  }
  const acMatch = ACCOUNT_MASK_REF_RE.exec(rawText);
  if (acMatch) {
    const tail = acMatch[1].slice(-4);
    return { uniqueTrxId: null, displayRef: `A/C **${tail}` };
  }
  return { uniqueTrxId: null, displayRef: null };
}

function polishMerchantTitle(name: string): string {
  const upper = name.toUpperCase();
  if (/GOOGLE\s*\*\s*GOOGLE\s*ONE/i.test(upper)) return 'Google One';
  if (/GOOGLE\s*\*/i.test(upper)) return 'Google Services';
  if (/^GITHUB\b/i.test(upper)) return 'GitHub';
  if (/^NETFLIX\.COM\b/i.test(upper)) return 'Netflix';
  if (/^APPSUMO\.COM\b/i.test(upper)) return 'AppSumo';
  if (/^DARAZ\s+BANGLADESH/i.test(upper)) return 'Daraz Bangladesh';
  if (/HOSSAIN\s+MARKET\s+ATM/i.test(upper)) return 'Hossain Market ATM';
  if (/^OTHER\s+BANK$/i.test(upper)) return 'Other Bank Deposit';
  if (/^DOT\s*INTERNET(?:\s+BILL)?$/i.test(upper)) return 'DotInternet Bill';
  return name.trim();
}

function cleanMerchantDescription(
  rawText: string,
  matchedAccount: Account | null,
  foreignLabel: string | null = null
): string {
  const suffix = foreignLabel ? ` (${foreignLabel})` : '';
  const withSuffix = (base: string) => `${polishMerchantTitle(base)}${suffix}`;
  const cleanText = stripPromoFooter(rawText);

  const billerMatch = /\bBiller\s*:\s*([^\r\n]+)/i.exec(cleanText);
  if (billerMatch) {
    const biller = billerMatch[1].trim();
    if (biller.length >= 2) return withSuffix(`${biller} bill`);
  }

  if (ISP_PAYMENT_RECEIPT_RE.test(cleanText)) {
    const ispMatch = /\b([A-Za-z0-9\s]{3,28}?)\s*(?:\.\s*TrxID|\r?\n|$)/i.exec(
      cleanText.split(/\r?\n/).pop() ?? ''
    );
    if (ispMatch && !/\bwe\s+have\b/i.test(ispMatch[1])) {
      return withSuffix(ispMatch[1].trim());
    }
  }

  const rechargeMatch =
    /\b(?:mobile\s+recharge|airtime)\s+request\s+of\b[\s\S]*?\bfor\s+(01\d{9})\b/i.exec(cleanText);
  if (rechargeMatch) {
    return withSuffix(`Mobile Recharge · ${rechargeMatch[1]}`);
  }

  const iBankingMatch =
    /\bdeposit\s+from\s+ibanking\b[\s\S]*?\bfrom\s+([A-Za-z0-9\s.&'-]{3,36}?)(?=\s*\.|\s+fee\b|$)/i.exec(
      cleanText
    );
  if (iBankingMatch) {
    const src = iBankingMatch[1].replace(/\s+Internet\s+Banking$/i, '').trim();
    return withSuffix(`Deposit from ${src}`);
  }

  const transferToWalletMatch =
    /\btransferred\s+from\b[\s\S]*?\bto\s+([A-Za-z0-9\s:._-]{3,42}?)(?=\s*\.|\s+available\b|$)/i.exec(
      cleanText
    );
  if (transferToWalletMatch) {
    const rawDest = transferToWalletMatch[1].trim();
    const walletNum = /\b(01\d{8,9})\b/.exec(rawDest);
    if (/bkash/i.test(rawDest) && walletNum) {
      return withSuffix(`bKash Transfer · ${walletNum[1]}`);
    }
    return withSuffix(`Transfer to ${rawDest.replace(/:\s*$/, '')}`);
  }

  if (/\bnpsb\s+transfer\b/i.test(cleanText)) {
    return withSuffix('NPSB Transfer');
  }

  if (/\bncc\s*bank\b/i.test(cleanText)) {
    if (/\bon-?line\s*transfer\b/i.test(cleanText)) return withSuffix('NCC Bank Online Deposit');
    if (/\bdebited\b[\s\S]*?\bby\s+transfer\b/i.test(cleanText)) return withSuffix('NCC Bank Transfer');
  }

  const cashOutPhone = /\bcash\s*out\b[\s\S]*?\bto\s+(?:agent\s+)?(01\d{9})\b/i.exec(cleanText);
  if (cashOutPhone) return withSuffix(`bKash Cash Out · ${cashOutPhone[1]}`);

  const cashInPhone = /\bcash\s*in\b[\s\S]*?\bfrom\s+(01\d{9})\b/i.exec(cleanText);
  if (cashInPhone) return withSuffix(`bKash Cash In · ${cashInPhone[1]}`);

  const p2pInPhone = /\byou\s+have\s+received\s+tk\b[\s\S]*?\bfrom\s+(01\d{9})\b/i.exec(cleanText);
  if (p2pInPhone) return withSuffix(`bKash From · ${p2pInPhone[1]}`);

  const merchantCandidates = [
    ...cleanText.matchAll(
      /\b(?:to|at|from|merchant|payee|for)\s+([A-Za-z0-9\s.,*+/'&-]{3,40}?)(?=\s+(?:(?:was\s+|is\s+)?successful|completed|done|on\s+\d|at\s+\d|using\s+|trx|txn|ref|fee|available\s+bal|bal|tk|bdt|৳|$)|\.(?:\s|$)|$)/gi
    ),
  ];
  for (let i = merchantCandidates.length - 1; i >= 0; i -= 1) {
    const candidate = merchantCandidates[i][1]
      .replace(/\s*\+\d{7,}.*$/, '')
      .replace(/\b(?:was\s+|is\s+)?(?:successful|completed|done)\b\.?$/i, '')
      .trim();
    if (!candidate) continue;
    if (/^(?:your\s+)?a\/c\b|^a\/c#|^0\d{3}\*{2,}|\bwallet:/i.test(candidate)) continue;
    if (candidate.length >= 2 && !/^\d+$/.test(candidate)) {
      return withSuffix(candidate);
    }
    if (candidate.length >= 6 && matchedAccount) {
      return withSuffix(`${matchedAccount.name} (${candidate})`);
    }
  }

  const firstLine = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && !/^\d{2,4}[-/]/.test(l));
  if (firstLine && firstLine.length <= 42) return withSuffix(firstLine);

  if (matchedAccount) return withSuffix(`${matchedAccount.name} entry`);
  return withSuffix('Captured transaction');
}

export function buildCaptureFingerprint(params: {
  trxId: string | null;
  occurredOn: LocalDate;
  type: TransactionType;
  amountMinor: number;
  description: string;
  accountId: string | null;
}): string {
  if (params.trxId) {
    return `trx:${params.trxId.toUpperCase()}`;
  }
  const slug = params.description
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  return `fp:${params.occurredOn}:${params.type}:${params.amountMinor}:${params.accountId ?? 'none'}:${slug || 'tx'}`;
}

export function parseSingleCaptureMessage(
  rawText: string,
  source: CaptureSource,
  context: CaptureParserContext = {},
  idSeed: string = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
): NewPendingDraft | null {
  const { cleanBody, metaDate, metaTime, metaSender } = extractSmsHeaderMeta(rawText);
  const trimmed = cleanBody;
  if (!trimmed) return null;
  if (NON_TRANSACTION_NOISE_RE.test(trimmed)) return null;

  const extracted = extractMoneyWithMeta(trimmed, source);
  if (!extracted || extracted.amountMinor <= 0) return null;
  const { amountMinor, foreignLabel } = extracted;

  const accounts = context.accounts ?? [];
  const defaultDate = metaDate ?? context.defaultDate ?? todayLocalDate();
  const effectiveSender = [context.senderHint, metaSender].filter(Boolean).join(' ') || undefined;

  const textWithoutFeeField = trimmed.replace(
    /\bfee\s*[:=-]?\s*(?:tk\.?|bdt|৳)?\s*[\d,]+(?:\.\d{1,2})?/gi,
    ''
  );

  let type: TransactionType = 'expense';
  if (ISP_PAYMENT_RECEIPT_RE.test(trimmed)) {
    type = 'expense';
  } else if (INCOME_HINT_RE.test(textWithoutFeeField) && !EXPENSE_HINT_RE.test(textWithoutFeeField)) {
    type = 'income';
  } else if (
    /\bcredited\b|\bcr\b|\bcash\s*in\b|\bdeposited\b|\breceived\s+(?:deposit|tk|bdt|৳)|\bsalary\b|\brefund\b|\bcashback\b/i.test(
      textWithoutFeeField
    ) &&
    !/\bdebited\b|\bcash\s*out\b/i.test(textWithoutFeeField)
  ) {
    type = 'income';
  }

  const feeMatch = FEE_RE.exec(normalizeDigits(trimmed));
  const feeParsed = feeMatch ? parseMoneyInput(feeMatch[1]) : null;
  const feeMinor = feeParsed?.ok && feeParsed.minor ? feeParsed.minor : 0;

  const { uniqueTrxId, displayRef } = extractReferenceDisplay(trimmed);

  const occurredOn = extractDateFromText(trimmed, defaultDate);
  const occurredTime = extractTimeFromText(trimmed) ?? metaTime ?? currentLocalTime();
  const matchedAccount = matchAccountFromText(trimmed, accounts, effectiveSender);
  const categoryId = matchCategoryIdFromText(trimmed, type);
  const description = cleanMerchantDescription(trimmed, matchedAccount, foreignLabel);

  const fingerprint = buildCaptureFingerprint({
    trxId: uniqueTrxId,
    occurredOn,
    type,
    amountMinor,
    description,
    accountId: matchedAccount?.id ?? null,
  });

  return {
    id: idSeed,
    source,
    fingerprint,
    draftKind: 'transaction',
    type,
    amountMinor,
    feeMinor,
    categoryId,
    accountId: matchedAccount?.id ?? null,
    description,
    rawText: trimmed.slice(0, 600),
    trxId: displayRef,
    occurredOn,
    occurredTime,
  };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === ',' || ch === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseStatementCsv(
  csvText: string,
  source: CaptureSource = 'statement_csv',
  context: CaptureParserContext = {}
): NewPendingDraft[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const accounts = context.accounts ?? [];
  const defaultDate = context.defaultDate ?? todayLocalDate();
  const hintAccount = matchAccountFromText(lines.slice(0, 4).join(' '), accounts);

  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(8, lines.length); i += 1) {
    const cols = splitCsvLine(lines[i]).map((c) => c.toLowerCase());
    if (
      cols.some((c) => c.includes('date')) &&
      cols.some((c) => c.includes('debit') || c.includes('credit') || c.includes('amount') || c.includes('withdrawal'))
    ) {
      headerIdx = i;
      headers = cols;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const dateCol = headers.findIndex((h) => h.includes('date'));
  const descCol = headers.findIndex(
    (h) =>
      h.includes('desc') ||
      h.includes('particular') ||
      h.includes('narration') ||
      h.includes('detail') ||
      h.includes('remark') ||
      h.includes('type')
  );
  const debitCol = headers.findIndex(
    (h) => h.includes('debit') || h.includes('withdraw') || h === 'dr' || h === 'out'
  );
  const creditCol = headers.findIndex(
    (h) => h.includes('credit') || h.includes('deposit') || h === 'cr' || h === 'in'
  );
  const amountCol = headers.findIndex((h) => h.includes('amount') && !h.includes('fee'));
  const trxCol = headers.findIndex(
    (h) => h.includes('trx') || h.includes('txn') || h.includes('ref') || h === 'id'
  );

  const drafts: NewPendingDraft[] = [];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 2) continue;

    const dateText = dateCol >= 0 ? cols[dateCol] ?? '' : '';
    const occurredOn = extractDateFromText(dateText, defaultDate);
    if (dateCol >= 0 && !dateText) continue;

    const desc = (descCol >= 0 ? cols[descCol] : '')?.trim() || 'Statement entry';
    const trxRaw = trxCol >= 0 ? cols[trxCol]?.trim() : '';
    const trxId = trxRaw && /^[A-Z0-9-]{6,22}$/i.test(trxRaw) ? trxRaw.toUpperCase() : null;

    let type: TransactionType = 'expense';
    let amountMinor: number | null = null;

    if (debitCol >= 0 || creditCol >= 0) {
      const deb = debitCol >= 0 ? parseMoneyInput(normalizeDigits((cols[debitCol] ?? '').replace(/[^\d.,]/g, ''))) : null;
      const cre = creditCol >= 0 ? parseMoneyInput(normalizeDigits((cols[creditCol] ?? '').replace(/[^\d.,]/g, ''))) : null;
      if (deb?.ok && deb.minor && deb.minor > 0) {
        type = 'expense';
        amountMinor = deb.minor;
      } else if (cre?.ok && cre.minor && cre.minor > 0) {
        type = 'income';
        amountMinor = cre.minor;
      }
    } else if (amountCol >= 0) {
      const rawAmt = normalizeDigits(cols[amountCol] ?? '');
      const isCredit = /\bcr\b|\+|credit|cash\s*in/i.test(rawAmt) || INCOME_HINT_RE.test(desc);
      const isNeg = rawAmt.trim().startsWith('-');
      const parsed = parseMoneyInput(rawAmt.replace(/[^\d.]/g, ''));
      if (parsed.ok && parsed.minor && parsed.minor > 0) {
        type = isCredit && !isNeg ? 'income' : 'expense';
        amountMinor = parsed.minor;
      }
    }

    if (!amountMinor || amountMinor <= 0) continue;

    const matchedAcc = matchAccountFromText(`${desc} ${lines[i]}`, accounts) ?? hintAccount;
    const categoryId = matchCategoryIdFromText(desc, type);
    const fingerprint = buildCaptureFingerprint({
      trxId,
      occurredOn,
      type,
      amountMinor,
      description: desc,
      accountId: matchedAcc?.id ?? null,
    });

    drafts.push({
      id: `cap_csv_${i}_${fingerprint.slice(-8)}`,
      source,
      fingerprint,
      draftKind: 'transaction',
      type,
      amountMinor,
      feeMinor: 0,
      categoryId,
      accountId: matchedAcc?.id ?? null,
      description: desc.slice(0, 80),
      rawText: lines[i].slice(0, 600),
      trxId,
      occurredOn,
      occurredTime: null,
    });
  }

  return drafts;
}

/**
 * Parses either a delimited CSV statement, a multi-line PDF bank/MFS statement,
 * OCR receipt text, or pasted/shared notification messages into deduplicated drafts.
 */
export function parseCaptureDocument(
  rawInput: string,
  source: CaptureSource,
  context: CaptureParserContext = {}
): NewPendingDraft[] {
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  if (source === 'statement_csv' || (trimmed.includes(',') && /date/i.test(trimmed.split(/\r?\n/)[0] ?? ''))) {
    const csvDrafts = parseStatementCsv(trimmed, source, context);
    if (csvDrafts.length > 0) return csvDrafts;
  }

  if (source === 'ocr_receipt') {
    const single = parseSingleCaptureMessage(trimmed, source, context);
    return single ? [single] : [];
  }

  const datedLineRegex =
    /(\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}[/-](?:20)?\d{2}\b|\b\d{1,2}[\s-]+[A-Za-z]{3,9}[\s,-]+(?:20)?\d{2}\b)/;

  const blocks = trimmed.split(/\r?\n\s*\r?\n+/).filter((b) => b.trim().length > 0);
  if (blocks.length > 1) {
    const looksLikeMultiBlockMessages = blocks.every((blk) => {
      const blkDatedLines = blk
        .split(/\r?\n/)
        .filter((l) => datedLineRegex.test(normalizeDigits(l)));
      return blkDatedLines.length <= 2;
    });
    if (looksLikeMultiBlockMessages) {
      const out: NewPendingDraft[] = [];
      for (let i = 0; i < blocks.length; i += 1) {
        const item = parseSingleCaptureMessage(blocks[i], source, context, `cap_blk_${Date.now()}_${i}`);
        if (item) out.push(item);
      }
      if (out.length > 0) return out;
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const accounts = context.accounts ?? [];
  const docAccountHint = matchAccountFromText(lines.slice(0, 6).join(' '), accounts);

  const datedRows = lines.filter((l) => datedLineRegex.test(normalizeDigits(l)));
  if (datedRows.length >= 2) {
    const results: NewPendingDraft[] = [];
    for (let i = 0; i < datedRows.length; i += 1) {
      const row = datedRows[i];
      const parsed = parseSingleCaptureMessage(
        row,
        source,
        {
          ...context,
          accounts: docAccountHint && !matchAccountFromText(row, accounts) ? [docAccountHint, ...accounts] : accounts,
        },
        `cap_doc_${Date.now()}_${i}`
      );
      if (parsed) {
        if (!parsed.accountId && docAccountHint) {
          parsed.accountId = docAccountHint.id;
        }
        results.push(parsed);
      }
    }
    if (results.length > 0) return results;
  }

  if (blocks.length > 1) {
    const out: NewPendingDraft[] = [];
    for (let i = 0; i < blocks.length; i += 1) {
      const item = parseSingleCaptureMessage(blocks[i], source, context, `cap_blk_${Date.now()}_${i}`);
      if (item) out.push(item);
    }
    if (out.length > 0) return out;
  }

  const single = parseSingleCaptureMessage(trimmed, source, context);
  return single ? [single] : [];
}
