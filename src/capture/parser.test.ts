import { describe, expect, it } from '@jest/globals';
import type { Account } from '@/domain/types';
import {
  parseCaptureDocument,
  parseCaptureDocumentDetailed,
  parseSingleCaptureMessage,
  parseSingleCaptureMessageDetailed,
  parseStatementCsv,
} from './parser';

const MOCK_ACCOUNTS: Account[] = [
  {
    id: 'acc_bkash',
    name: 'bKash',
    kind: 'mobile_wallet',
    provider: 'bkash',
    colorKey: '#E2136E',
    monogram: 'bK',
    last4: null,
    openingBalanceMinor: 0,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'acc_nagad',
    name: 'Nagad',
    kind: 'mobile_wallet',
    provider: 'nagad',
    colorKey: '#F15A22',
    monogram: 'N',
    last4: null,
    openingBalanceMinor: 0,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 1,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'acc_city',
    name: 'City Bank',
    kind: 'bank',
    provider: null,
    colorKey: '#1E40AF',
    monogram: null,
    last4: '4321',
    openingBalanceMinor: 0,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 2,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'acc_card',
    name: 'Card',
    kind: 'credit_card',
    provider: null,
    colorKey: '#334155',
    monogram: null,
    last4: '3829',
    openingBalanceMinor: 0,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 3,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('Bangladesh finance capture parser', () => {
  it('parses bKash Cash Out notification with TrxID, fee, and balance exclusion', () => {
    const msg =
      'bKash: Cash Out Tk 2,000.00 to Agent 01711000000 successful. Fee Tk 37.00. Balance Tk 8,450.00. TrxID BKA9X21LM4 at 16/11/2026 14:20';
    const draft = parseSingleCaptureMessage(msg, 'notification', { accounts: MOCK_ACCOUNTS });
    expect(draft).not.toBeNull();
    expect(draft?.type).toBe('expense');
    expect(draft?.amountMinor).toBe(200_000);
    expect(draft?.feeMinor).toBe(3_700);
    expect(draft?.trxId).toBe('BKA9X21LM4');
    expect(draft?.fingerprint).toBe('trx:BKA9X21LM4');
    expect(draft?.accountId).toBe('acc_bkash');
    expect(draft?.occurredOn).toBe('2026-11-16');
    expect(draft?.occurredTime).toBe('14:20');
  });

  it('parses bank credit SMS as income matched by card/account last4', () => {
    const msg =
      'City Bank: Your A/C ending 4321 is credited with BDT 45,000.00 on 15 Nov 2026 Salary Credit TrxID CTY88912AB.';
    const draft = parseSingleCaptureMessage(msg, 'share_text', { accounts: MOCK_ACCOUNTS });
    expect(draft).not.toBeNull();
    expect(draft?.type).toBe('income');
    expect(draft?.amountMinor).toBe(4_500_000);
    expect(draft?.accountId).toBe('acc_city');
    expect(draft?.categoryId).toBe('salary');
    expect(draft?.occurredOn).toBe('2026-11-15');
  });

  it('parses bank CSV statements cleanly and skips header', () => {
    const csv = [
      'Date,Description,Debit,Credit,TrxID',
      '2026-11-14,Shwapno Super Shop,1450.50,,SWP110293',
      '2026-11-15,Nagad Cash In,,5000.00,NGD554433',
    ].join('\n');

    const drafts = parseStatementCsv(csv, 'statement_csv', { accounts: MOCK_ACCOUNTS });
    expect(drafts).toHaveLength(2);
    expect(drafts[0].type).toBe('expense');
    expect(drafts[0].amountMinor).toBe(145_050);
    expect(drafts[0].categoryId).toBe('groceries');
    expect(drafts[0].fingerprint).toBe('trx:SWP110293');

    expect(drafts[1].type).toBe('income');
    expect(drafts[1].amountMinor).toBe(500_000);
    expect(drafts[1].accountId).toBe('acc_nagad');
  });

  it('extracts total payable and grocery category from OCR receipt text', () => {
    const ocr = [
      'SHWAPNO SUPER SHOP - DHANMONDI',
      '16/11/2026 11:45 AM',
      'Rice 5kg 420.00',
      'Oil 2L 380.00',
      'VAT 15.00',
      'Net Payable: Tk 815.00',
    ].join('\n');

    const drafts = parseCaptureDocument(ocr, 'ocr_receipt', { accounts: MOCK_ACCOUNTS });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('expense');
    expect(drafts[0].amountMinor).toBe(81_500);
    expect(drafts[0].categoryId).toBe('groceries');
    expect(drafts[0].occurredOn).toBe('2026-11-16');
  });

  it('parses real bKash iBanking deposit and Cash In / Payment formats accurately', () => {
    const ibanking =
      'You have received deposit from iBanking of Tk 10,000.00 from NCC Bank. Fee Tk 0.00. Balance Tk 16,322.87. TrxID DKC2EDGTW8 at 12/11/2026 18:49';
    const d1 = parseSingleCaptureMessage(ibanking, 'notification', {
      accounts: MOCK_ACCOUNTS,
      senderHint: 'bKash',
    });
    expect(d1?.type).toBe('income');
    expect(d1?.amountMinor).toBe(1_000_000);
    expect(d1?.accountId).toBe('acc_bkash');
    expect(d1?.trxId).toBe('DKC2EDGTW8');
    expect(d1?.description).toBe('Deposit from NCC Bank');

    const payment =
      'Payment of Tk 189.00 to Daraz Bangladesh Limited-1-RM32828 is successful. Balance Tk 775.75. TrxID DJH15S0125 at 17/10/2026 22:15';
    const d2 = parseSingleCaptureMessage(payment, 'notification', {
      accounts: MOCK_ACCOUNTS,
      senderHint: 'bKash',
    });
    expect(d2?.type).toBe('expense');
    expect(d2?.amountMinor).toBe(18_900);
    expect(d2?.accountId).toBe('acc_bkash');
    expect(d2?.categoryId).toBe('shopping');
    expect(d2?.description).toContain('Daraz Bangladesh');
  });

  it('parses bKash DotInternet bill payment and ISP receipt as utilities expense with matching TrxID', () => {
    const bkashBill = [
      'Bill successfully paid.',
      'Biller: DotInternet ',
      'MMYYYY/Contact: 112026',
      'A/C: 279291 ',
      'Amount: Tk 2,000.00 ',
      'Fee: Tk 0.00 ',
      'TrxID: DK949JQ24E at 09/11/2026 17:19',
    ].join('\n');
    const [d1] = parseCaptureDocument(bkashBill, 'share_text', { accounts: MOCK_ACCOUNTS });
    expect(d1.type).toBe('expense');
    expect(d1.amountMinor).toBe(200_000);
    expect(d1.accountId).toBe('acc_bkash');
    expect(d1.categoryId).toBe('utilities');
    expect(d1.description).toBe('DotInternet Bill');
    expect(d1.fingerprint).toBe('trx:DK949JQ24E');
    expect(d1.occurredOn).toBe('2026-11-09');
    expect(d1.occurredTime).toBe('17:19');

    const ispReceipt = [
      'We have received 2000 Tk.',
      'Your account will be active until 01/12/26.',
      'dot.bil.pe/279291',
      'Dot Internet. TrxID DK949JQ24E',
    ].join('\n');
    const [d2] = parseCaptureDocument(ispReceipt, 'share_text', { accounts: MOCK_ACCOUNTS });
    expect(d2.type).toBe('expense');
    expect(d2.amountMinor).toBe(200_000);
    expect(d2.categoryId).toBe('utilities');
    expect(d2.fingerprint).toBe('trx:DK949JQ24E');
  });

  it('parses real BRAC Bank card, NPSB/bKash transfer, ATM, and credit alerts', () => {
    const googleOne =
      'TK 600.00 transacted at GOOGLE *GOOGLE ONE on 09-11-26 @05:23 PM using card#***3829. Balance TK 316.32. BRAC Bank.';
    const d1 = parseSingleCaptureMessage(googleOne, 'notification', { accounts: MOCK_ACCOUNTS });
    expect(d1?.type).toBe('expense');
    expect(d1?.amountMinor).toBe(60_000);
    expect(d1?.accountId).toBe('acc_card');
    expect(d1?.categoryId).toBe('subscriptions');
    expect(d1?.description).toBe('Google One');
    expect(d1?.trxId).toBe('Card **3829');
    expect(d1?.occurredOn).toBe('2026-11-09');
    expect(d1?.occurredTime).toBe('17:23');

    const githubUsd =
      '$ 0.90 transacted at GITHUB, INC. +18774484820 US on 09-11-26 @03:19 PM using card#***3829. Balance TK 926.32. BRAC Bank.';
    const dUsd = parseSingleCaptureMessage(githubUsd, 'notification', { accounts: MOCK_ACCOUNTS });
    // No invented exchange rate: a USD-only message makes no draft.
    expect(dUsd).toBeNull();

    const bblToBkash =
      '[2026-10-15 14:25] [BRAC BANK]\nTk 2,000.00 has been transferred from your BBL A/C: 1**0001 to BKASH wallet: 01764995074. Available balance is Tk 144.09. Queries: call 16221.';
    const d2 = parseSingleCaptureMessage(bblToBkash, 'share_text', { accounts: MOCK_ACCOUNTS });
    expect(d2?.type).toBe('expense');
    expect(d2?.amountMinor).toBe(200_000);
    expect(d2?.accountId).toBe('acc_city');
    expect(d2?.occurredOn).toBe('2026-10-15');
    expect(d2?.occurredTime).toBe('14:25');
    expect(d2?.description).toBe('bKash Transfer · 01764995074');

    const bracCredit =
      'TK 2,000.00 has been credited to your A/C# 10576**0001 on 09-11-26. Your A/C balance is TK 2,926.32. For Enquiry call: 16221';
    const d3 = parseSingleCaptureMessage(bracCredit, 'notification', {
      accounts: MOCK_ACCOUNTS,
      senderHint: 'BRAC BANK',
    });
    expect(d3?.type).toBe('income');
    expect(d3?.amountMinor).toBe(200_000);
    expect(d3?.accountId).toBe('acc_city');
    expect(d3?.trxId).toBe('A/C **0001');

    const atm =
      'TK 18,000.00 withdrawn from A/C#10576**0001 on 08-10-26 @09:13 PM from HOSSAIN MARKET ATM DHAKA BD. Balance TK 144.09. BRAC Bank.';
    const d4 = parseSingleCaptureMessage(atm, 'notification', { accounts: MOCK_ACCOUNTS });
    expect(d4?.type).toBe('expense');
    expect(d4?.amountMinor).toBe(1_800_000);
    expect(d4?.accountId).toBe('acc_city');
    expect(d4?.description).toBe('Hossain Market ATM');
  });

  it('parses real NCC Bank debit and deposit SMS and ignores OTP/promo noise', () => {
    const nccDebit =
      'NCC Bank-Dear A/H TK.10000.00 has been debited from 0068****60529 by TRANSFER.Current A/C Balance:TK1255.00 Dated 12/11/2026 18:49';
    const d1 = parseSingleCaptureMessage(nccDebit, 'notification', { accounts: MOCK_ACCOUNTS });
    expect(d1?.type).toBe('expense');
    expect(d1?.amountMinor).toBe(1_000_000);
    expect(d1?.accountId).toBe('acc_city');
    expect(d1?.description).toBe('NCC Bank Transfer');
    expect(d1?.occurredOn).toBe('2026-11-12');
    expect(d1?.occurredTime).toBe('18:49');

    const nccCredit =
      'NCC Bank-Dear A/H TK.23000.00 has been deposited to 0068****60529 by On-Line Transfer Trn.Current A/C Balance:TK23415.00 Dated 09/11/2026 15:11';
    const d2 = parseSingleCaptureMessage(nccCredit, 'notification', { accounts: MOCK_ACCOUNTS });
    expect(d2?.type).toBe('income');
    expect(d2?.amountMinor).toBe(2_300_000);
    expect(d2?.accountId).toBe('acc_city');
    expect(d2?.description).toBe('NCC Bank Online Deposit');

    const noiseSamples = [
      'Use OTP: 624200 to proceed with NPSB Payment-Beneficiary. This OTP will be valid for 3 minutes. Please do not share it with anyone.',
      'Never share your OTP/Password/PIN with anyone. NCC Bank will never ask for these. Your One Time Password (OTP) is 534215.',
      'Do not share the OTP with anyone. Use OTP: 295718 for transaction of USD 0.00 at GITHUB, INC. using Card#**3829.',
      "Dear Customer, your month-end balance of Oct'26 for A/C No:****0529 is BDT 415.00.",
      'MiME Internet Home Packages: 45 Mbps @ 650 Tk. Connection Fee : 1 Taka Only',
    ];
    for (const noise of noiseSamples) {
      expect(parseSingleCaptureMessage(noise, 'notification', { accounts: MOCK_ACCOUNTS })).toBeNull();
    }
  });

  it('parses blank-line-separated multi-block SMS paste including multi-line DotInternet without splitting by date lines', () => {
    const pasted = [
      'Bill successfully paid.\nBiller: DotInternet\nA/C: 279291\nAmount: Tk 2,000.00\nTrxID: DK949JQ24E at 09/11/2026 17:19',
      'NCC Bank-Dear A/H TK.10000.00 has been debited from 0068****60529 by TRANSFER.Current A/C Balance:TK1255.00 Dated 12/11/2026 18:49',
      'TK 600.00 transacted at GOOGLE *GOOGLE ONE on 09-11-26 @05:23 PM using card#***3829. Balance TK 316.32. BRAC Bank.',
    ].join('\n\n');

    const drafts = parseCaptureDocument(pasted, 'share_text', { accounts: MOCK_ACCOUNTS });
    expect(drafts).toHaveLength(3);
    expect(drafts[0].description).toBe('DotInternet Bill');
    expect(drafts[0].amountMinor).toBe(200_000);
    expect(drafts[1].description).toBe('NCC Bank Transfer');
    expect(drafts[1].amountMinor).toBe(1_000_000);
    expect(drafts[2].accountId).toBe('acc_card');
    expect(drafts[2].amountMinor).toBe(60_000);
  });
});

describe('foreign-currency messages', () => {
  const usd =
    '$ 0.90 transacted at GITHUB, INC. +18774484820 US on 09-11-26 @03:19 PM using card#***3829. Balance TK 926.32. BRAC Bank.';
  const bdt =
    'TK 600.00 transacted at GOOGLE *GOOGLE ONE on 09-11-26 @05:23 PM using card#***3829. Balance TK 316.32. BRAC Bank.';

  it('reports a skipped foreign-currency message instead of silently returning nothing', () => {
    const res = parseSingleCaptureMessageDetailed(usd, 'notification', { accounts: MOCK_ACCOUNTS });
    expect(res.draft).toBeNull();
    expect(res.skippedForeign).toBe(true);
    expect(parseSingleCaptureMessageDetailed(bdt, 'notification', { accounts: MOCK_ACCOUNTS }).skippedForeign).toBe(
      false
    );
  });

  it('does not count noise or empty text as foreign', () => {
    const noise = 'Use OTP: 295718 for transaction of USD 0.00 at GITHUB, INC. using Card#**3829.';
    expect(parseSingleCaptureMessageDetailed(noise, 'notification').skippedForeign).toBe(false);
    expect(parseSingleCaptureMessageDetailed('hello there', 'notification').skippedForeign).toBe(false);
  });

  it('counts foreign messages in a pasted document, alongside the drafts it made', () => {
    const pasted = [usd, bdt, usd.replace('0.90', '12.00')].join('\n\n');
    const res = parseCaptureDocumentDetailed(pasted, 'share_text', { accounts: MOCK_ACCOUNTS });
    expect(res.drafts).toHaveLength(1);
    expect(res.skippedForeign).toBe(2);
  });

  it('counts a single pasted foreign message', () => {
    const res = parseCaptureDocumentDetailed(usd, 'share_text', { accounts: MOCK_ACCOUNTS });
    expect(res.drafts).toHaveLength(0);
    expect(res.skippedForeign).toBe(1);
  });
});
