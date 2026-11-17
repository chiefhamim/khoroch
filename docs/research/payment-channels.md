# Payment and savings channels in Bangladesh (Phase 1 research)

Research date: November 2026. Every figure carries a URL and year. "Assumption" marks anything unsourced. Fee and limit pages change often, so the app should let users edit fees and never hard-code them.

## 1. Cash

- Bangladesh Bank data, as reported by the press, shows digital payments fell from 51% to 47% of total payment transactions between Dec 2023 and Dec 2024 (403.1 million digital transactions in Dec 2024). Same report is cited elsewhere as cash being more than 72% of "monetary transactions" in 2024; the two figures use different bases and should not be mixed. Source: https://thefinancialexpress.com.bd/views/columns/whats-holding-back-growth-of-cashless-transactions and https://dailynewnation.com/?p=771180
- By value, one outlet says cash was 67.2% of total transaction value in 2025 (single secondary source). https://meatechwatch.com/?p=42594
- Cash-in-hand habits: a participatory study says only about 10% of Bangladeshi adults who save do so in formal institutions; the rest save in cash at home or in kind (older academic source, undated in the snippet). https://jnu.ac.bd/journal/assets/pdf/1_1_201.pdf
- Rural experiment: cash preference persists even among mobile-money account holders. https://cgspace.cgiar.org/server/api/core/bitstreams/c5d789fb-a92f-433a-bf6b-5430bd9c56e0/content
- Assumption: most daily spending (bazar, transport, tea, rickshaw) is cash and is never recorded by a receipt, so the app must make typing a cash entry a 2-tap action.

## 2. Mobile financial services (MFS)

**Size.** Bangladesh Bank reported 146.46 million registered MFS accounts in Aug 2025 (69.87m urban, 76.60m rural). Other outlets quote far higher totals (239.3m in Jan 2025; GSMA 238.68m for Dec 2024), so definitions differ. Nagad stopped submitting data from March 2025, so later monthly totals understate the market. Value was Tk 1.54 trillion and 644.47 million transactions in Sept 2025. Sources: https://thefinancialexpress.com.bd/economy/bangladesh/mfs-growth-slows-amid-data-gaps-dip-in-remittances ; https://thefinancialexpress.com.bd/economy/bangladesh-mfs-accounts-surge-by-20-million-in-a-year-transactions-up-32pc ; https://futurestartup.com/2025/05/06/the-state-of-mobile-financial-services-mfs-industry-in-bangladesh/

**Registered vs active.** Company claims only (not Bangladesh Bank): bKash 4.20 crore active, Nagad 2.82 crore. Same Financial Express article as above. Findex 2024: 21% of adults hold a mobile money account, 43% any financial account, 8% debit card, 2% credit card. https://www.thedailystar.net/news/towards-cashless-economy-new-lifeline-financial-inclusion-4086361 (Findex 2021 for comparison: 29% mobile money; https://www.tbsnews.net/economy/growth-financial-account-ownership-has-slowed-down-bangladesh-findings-569290). Market shares by provider: no reliable current Bangladesh Bank figure found (gap).

**Transaction types:** cash in, cash out, send money, payment, mobile recharge, pay bill, salary disbursement, remittance, bank transfer, loans. bKash's statement lists recharge, cash in, cash out, send money and payment lines with a Charge/Fee column and running balance. https://www.scribd.com/document/877199347/Computer-Generated-Statement (user-uploaded example, unofficial)

**Fees (check each in app before use):**
- bKash agent cash out: Tk 18.50 per 1,000 (1.85%); Priyo Agent Tk 13.95 per 1,000 up to Tk 50,000 per month. https://www.bkash.com/en/products-services/cashout-from-agent ; https://unb.com.bd/category/Press%20Releases/bkash-reduces-cash-out-charge-to-tk-1395/190921 (the 2021 UNB release; current rate unverified)
- bKash limits: send money Tk 50,000/day, Tk 300,000/month (raised March 2025); cash out Tk 30,000/day, Tk 200,000/month. https://www.dhakatribune.com/business/377554/bkash-raises-daily-monthly-account-transaction ; https://www.bkash.com/en/help/limits (official page blocked to my fetch; limits came via search snippet)
- bKash to bKash send money: free per most sources; a per-recipient Tk 5 rule appears in one calculator and is unverified. https://tool.teamzlab.com/bd/bkash-charge-calculator/
- Rocket: agent cash out 1.67%, DBBL ATM 0.9%, app transfer free, USSD transfer Tk 5 (aggregator tables, one source says 1.80%). https://www.nsave.com/bangladesh/rocket
- Nagad: reported Tk 5 fee on app send money and 1.50% to banks (Daily Star); agent cash out 1.49% only from aggregator calculators. https://www.thedailystar.net/node/3416651 ; https://tool.teamzlab.com/bd/nagad-charge-calculator/ (no official tariff found)
- Upay: a cash-out cut to Tk 11.99 per 1,000 was announced (date not verified). https://thefinancialexpress.com.bd/trade/upay-reduces-cash-out-charge-to-tk-1199-per-thousand
- Balance checks by USSD carried a charge (2019 article). https://images.thedailystar.net/node/1758325

**Over the counter (OTC) use.** Assumption: many low-income users transact through an agent using the agent's or a relative's wallet; the person's own ledger then has no SMS.

**SMS.** No official bKash SMS template found. A community gist shows English text with fields: counterparty number, amount ("Tk"), reference, Fee, Balance, TrxID, timestamp. https://gist.github.com/fmtarif/c28690b90de7e3ff902612ca7c241b36 (unofficial, may be outdated). Whether SMS arrives in Bangla: not found; Nagad, Rocket and Upay formats: not found.

## 3. Banks

- Findex 2024: 43% of adults hold an account; 8% debit card; 2% credit card (Daily Star link above).
- Agent banking (Bangladesh Bank, via press), Dec 2025: 25.83 million accounts, 20,501 outlets (17,528 rural), deposits about Tk 49,356 crore. https://thefinancialexpress.com.bd/economy/agent-banking-deposits-in-bangladesh-makes-a-big-jump
- Bank SMS: banks send per-transaction alerts for cards (HSBC terms) and threshold alerts (Dutch-Bangla). No standard format or sample found. https://www.apps.asiapacific.hsbc.com/1/PA_ES_Content_Mgmt/content/bangladesh60/attachments/debit_card_terms_con.pdf ; https://www.dutchbanglabank.com/forms/account_options/SMS_application.pdf
- NPSB (shared ATM/POS switch, per HSBC terms above). BEFTN and Bangla QR: no 2023+ source retrieved (gap).

## 4. Savings instruments

- Sanchayapatra: July-Dec 2025 cap 12% and floor 9.74% for NSCs; 5-year certificate up to about 12.4% for up to Tk 7.5 lakh; rate locked at purchase; source tax reported as 5%/10%, sources conflict. https://unb.com.bd/category/Bangladesh/govt-slashes-interest-rates-on-saving-tools-for-2025-second-half/163192 ; https://unb.com.bd/news/tag/134867
- DPS and FDR: no reliable source retrieved (gap). Assumption: monthly DPS instalment is a fixed outflow that needs a reminder.
- Samity/ROSCA: described as regular contributions to a pool distributed by lottery or need. https://www.sdgfund.org/node/1847 . No national prevalence figure found.
- NGO-MFI savings: about 32.3 million microcredit members (mid-2024), savings about Tk 670 billion, 91% women. https://en.prothomalo.com/amp/story/business/local/0s9anl3omc . Savings types: compulsory, voluntary, term (MRA discussion, https://www.tbsnews.net/thoughts/digitising-microfinance-next-frontier-financial-inclusion-bangladesh-1257221).
- Gold and land: no source retrieved. Assumption: tracked as a value at purchase, not monthly.

## 5. Dena-pawna

- Major informal lenders: relatives, neighbours, mahajans; mahajan rates are much higher. https://en.banglapedia.org/index.php/Informal_Credit
- Urban study: average informal rate 24%, range 0% to 250%; about 45% of borrowers used well-off relatives, neighbours or friends at zero or minimal interest. https://www.thedailystar.net/node/3808941
- Rural survey (2,643 families, 33 districts): about 30% borrow informally. https://www.thedailystar.net/opinion/views/news/banks-should-open-their-doors-the-urban-poor-3894631 (reported summary)
- Recording: no source. Assumption: verbal memory or a notebook; disputes arise over amounts and dates, so a dated entry with counterparty and a settle-up flag is needed.

## 6. Formal loans

- Microcredit: outstanding about Tk 1.56 trillion (mid-2024), prior Prothom Alo link. Weekly repayments over 40 to 50 instalments in an older study (undated, indicative). https://sites.google.com/site/hrishiparadailydiaries/home/mfi-loans
- bKash-City Bank Digital Nano Loan (2021 launch): 9% a year, three instalments, Tk 500 to 20,000, no early-settlement charge, late penalty 1.5% p.a. https://en.prothomalo.com/corporate/local/city-bank-bkash-introduce-digital-nano-loan ; https://www.bkash.com/en/page/bkash-loan-faq
- Nagad and Upay loan terms: not found. Bank personal loans and credit card EMI: not researched (gap).

## 7. Baki

- A shopkeeper's case: customers buy groceries on credit and repay in instalments; baki near Tk 100,000, some unrecoverable. https://gojo.co/wp-content/uploads/2026/04/IM_DiaristStory_Shopkeeper_202604.pdf
- Shop ledgers are handwritten and customers often do not know exactly what they owe; TallyKhata sends an SMS per credit sale. https://www.tbsnews.net/node/154465
- Household side: no source. Assumption: the grocer's khata is the only record, so a household mirror of the balance helps.

## What this means for capture

| Channel | Automatic | Typed | Ledger fields |
|---|---|---|---|
| Cash | none | everything | amount, category, date, wallet=cash |
| MFS | SMS (if permitted) | OTC, fee if missing | amount, fee, balance, TrxID, counterparty, type, provider |
| Bank | SMS/alerts (format unknown) | cash withdrawals, card spend | amount, balance, account, ref |
| Savings | none | instalment, maturity | instrument, amount, due date, rate |
| Dena-pawna | none | all | counterparty, direction, principal, rate, date, settled |
| Formal loan | none | schedule | lender, instalment, day, balance |
| Baki | none | purchase, payment | shop, amount, running balance |

Fee is a separate expense line linked to the cash-out entry (assumption).

**Google Play SMS policy.** READ_SMS, RECEIVE_SMS and related permissions are allowed only for a default SMS, Phone or Assistant handler, or under a listed temporary exception requiring critical core functionality with no alternative, and approval via the Permissions Declaration Form in Play Console. Expense tracking is not named, but "SMS-based money management" (apps that track and manage budgets) is a listed exception covering READ_SMS, RECEIVE_SMS, RECEIVE_MMS and RECEIVE_WAP_PUSH; non-financial SMS must not be shared. Approval is not guaranteed; apps may be removed without it. Source: https://support.google.com/googleplay/android-developer/answer/10208820 (also https://support.google.com/googleplay/android-developer/answer/9214102). Fallback: paste-in SMS parsing or share-sheet import, needing no permission (assumption).
