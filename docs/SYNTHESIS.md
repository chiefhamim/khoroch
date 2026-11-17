# Khoroch Synthesis (Phase 2)

Date: 2026-11-17. Basis: docs/research/ plus a code check of branch dev. The research has few hard numbers. Every habit and "top 3 entries" claim is a **hypothesis** unless marked sourced. No new statistics here.

## 1. Persona matrix

| Persona | Income rhythm | Flows in / out | Channels | Fastest input, top 3 (hypotheses) | Confidence |
|---|---|---|---|---|---|
| 1. Daily earner (labourer, rickshaw, CNG) | Daily, uneven | In: day's cash. Out: joma, charging, repairs, food, rent, money home | Cash, bKash home, shop baki | Day total on big keypad; saved joma preset; repair by voice | Pay figures sourced (anecdotal); habits hypothesis |
| 2. Garment worker | Monthly plus overtime, Eid bonus | In: bank, bKash, cash. Out: rent, food, remittance, loans | Cash-out after pay | Payday prompt; repeat last remittance; rent/grocery presets | Remittance habit sourced (small surveys); rest hypothesis |
| 3. Farmer | Lumpy, harvest | In: crop sale. Out: inputs, labour, NGO instalments | Cash, dealer baki, NGO passbook | Credit input purchase; crop sale (maund x rate); instalment tick | Debt pattern sourced; habits hypothesis |
| 4. Remittance household | Monthly, Eid spikes | In: remittance. Out: household, loan, land/DPS/gold | bKash, bank | Remittance received; loan instalment; household chip | Inflows sourced; habits hypothesis |
| 5. Salaried (teacher, govt, executive) | Monthly, bonuses, tuition | In: salary, tuition. Out: rent, EMI, DPS, fees, parents, cards | Bank SMS, bKash, cash bazar | Bank SMS capture; recurring EMI/DPS/rent; bazar quick-add | Pay structure sourced; habits hypothesis |
| 6. Freelancer | Irregular USD | In: USD. Out: fees, internet, household | Payoneer, bank, bKash | Client payment (USD, fee, rate, net BDT); recurring expense | Channels sourced; habits hypothesis |
| 7. Shop owner (grocery, tea, pharmacy, tailor) | Daily cash; tailor seasonal | In: sales, baki collected. Out: stock, rent, wages, drawings | Cash, bKash, QR | Credit sale to named customer; baki received; day total | Baki pain sourced (one 2020 story); rest hypothesis |
| 8. Trader, transport, online seller, workshop | Lumpy; receivables 2 to 60 days | In: party and COD payouts. Out: stock, fuel, ads, wages | Cash, cheque, bKash, courier | Party baki sale; collection with cheque date; per-vehicle cost | Mostly hypothesis |

Personas 1 to 6 are personal-use targets. 7 and 8 mostly wait for v2.

## 2. What every persona shares

1. Cash entry in two taps, no setup (a design goal to test, not a proven habit).
2. Per-person baki and dena-pawna balance with dates and settle-up.
3. Fixed recurring outflows first (rent, joma, EMI, DPS, samity, instalments).
4. A "what is left" number after fixed outflows, since income is lumpy.
5. Editable fees and rates; never hard-coded.
6. Money sent home or received from abroad as a first-class flow (personas 2, 4, 6).
7. Bangla, big targets, offline, light on a weak phone (constraints, not facts).
8. Private by default: lock and backup.

## 3. MVP cut for personal use

Checked against dev branch code.

| # | Capability | Tag | Evidence / gap |
|---|---|---|---|
| 1 | Fast cash entry, category chips, description suggestions | EXISTS | src/app/transaction/new.tsx, src/ui/FastTransactionEntry.tsx, Keypad.tsx |
| 2 | Repeat last entry, preset amounts, income template | MISSING | Only frequent categories and descriptions are suggested |
| 3 | Wallets and balances | EXISTS | src/app/wallets/, src/domain/accounts.ts |
| 4 | Transfers with a fee | EXISTS | src/app/transfer/[id].tsx |
| 5 | Default fee rate per wallet | MISSING | Only per-transfer feeMinor |
| 6 | People, lent/borrowed balance, polite reminder | EXISTS | src/app/people/[id].tsx, src/domain/dues.ts |
| 7 | Due date and overdue on dues | MISSING | DueEntry has no due date |
| 8 | Recurring bills, EMI, salary; mark paid | EXISTS | recurring_bills table, Plan bills section |
| 9 | Notification before a bill is due | MISSING | reminders.ts has only the daily check-in |
| 10 | Safe-to-spend, budget, daily average | EXISTS | src/domain/calc.ts, Home, Plan |
| 11 | "Left after bills" on Home | PARTIAL | billsCommitment exists; not confirmed on Home |
| 12 | SMS and notification capture to inbox | PARTIAL | src/capture/, src/app/inbox.tsx; needs dev build; non-bKash formats and Play SMS policy unverified |
| 13 | Voice or typed quick entry | EXISTS | src/app/quick-entry.tsx, src/voice/; English only by SPEC |
| 14 | Bangla UI | EXISTS | src/i18n/bn.ts; completeness not checked |
| 15 | Backup, import, share | EXISTS | src/data/backup.ts |
| 16 | App lock | MISSING | Setting field exists; expo-local-authentication installed; no code uses either |
| 17 | Weekly or custom period | PARTIAL | monthStartDay 1 to 28 only |
| 18 | Loan view (instalments left, payoff) | PARTIAL | emi bills track counts; no payoff view |
| 19 | USD income with rate and fee | MISSING | One currency per install |
| 20 | Savings instruments with maturity | MISSING | Only as bills |

## 4. Parked for v2

- **Party ledgers:** need invoice lines, statements and party SMS; People covers only informal lending.
- **Per-vehicle tags:** a new tag dimension on every entry and report.
- **Order tracking:** an order lifecycle (advance, balance, delivery) is a separate model.
- **Courier settlement:** needs payout-to-order matching; no sourced data format.
- **Owner drawings:** needs a business flag per wallet and entry, which changes every total.
- **Cheque register:** evidence only for wholesale.

## 5. Build backlog

1. **Repeat last entry chip.** One tap refills the last amount, category, wallet.
   Files: src/ui/FastTransactionEntry.tsx, src/app/transaction/new.tsx, i18n.
   Done when: after saving "350 lunch", Add shows a repeat chip that saves a matching entry; unit test covers it.
2. **Preset amount buttons.** Up to 4 pinned amounts (for example daily joma).
   Files: FastTransactionEntry.tsx, Keypad.tsx, settings repo.
   Done when: pinning 500 shows a 500 button that fills the amount and survives restart.
3. **App lock.** PIN or biometric on open and after timeout, using appLockEnabled and appLockTimeoutSec.
   Files: src/app/_layout.tsx, new lock screen, settings screen.
   Done when: on dev app, cold start and 5 minutes in background show the lock; wrong PIN is refused; turning it off needs auth.
4. **Due date on dues.** Optional pay-back date and an Overdue badge.
   Files: migrations.ts (additive), types.ts, dues.ts, DueEntrySheet.tsx, people tab.
   Done when: migration test keeps data; yesterday's date shows Overdue; dues.test.ts has overdue cases.
5. **Bill due reminders.** Local notification the day before, no amount in text.
   Files: reminders.ts, useBudgets.ts.
   Done when: reminders.test.ts shows a schedule for a bill due on the 5th; marking paid cancels it.
6. **"Left after bills" on Home.** Subtract unpaid bills from the left number.
   Files: src/app/(tabs)/index.tsx, calc.ts.
   Done when: budget 20,000 with unpaid bills 6,000 shows 14,000 left; calc test added.
7. **Default fee per wallet.** Editable percent pre-fills the transfer fee.
   Files: types.ts, migrations.ts, WalletEditorSheet.tsx, transfer/[id].tsx.
   Done when: 1.85 percent on 1,000 pre-fills 18.50 in integer poisha; user can overwrite; rounding test passes.
8. **Weekly period option.** For daily earners.
   Files: period.ts, settings screen, calc.ts.
   Done when: weekly mode shows current 7-day totals on Home and Plan; monthly users unchanged; period tests pass.
9. **Payoff view on EMI bills.** Instalments left and finish month.
   Files: plan.tsx, types.ts.
   Done when: 12 total with 4 paid shows "8 left" and an end month.
10. **"Worked today" income button.** One tap adds a stored default amount.
    Files: Home tab, FastTransactionEntry.tsx, settings.
    Done when: default 800 gives a button that adds 800 income today; a second tap that day asks first.

Left out: SMS formats beyond bKash (need real samples), USD income and savings instruments (need a schema decision), Bangla voice (excluded by SPEC).

## 6. Open questions for real users

1. Where do you write money down today, and what do you forget most?
2. Would you tap a saved amount or type each time?
3. Who else sees your money, and do you want a lock?
4. How do you track baki and dena-pawna, and what starts a dispute?
5. Would you let the app read payment SMS, or paste them yourself?
6. Which number do you check first each day: cash on hand, owed to you, or left this month?
