# TEST-CASES v1.2: wallets, transfers, fees, dues, backup, parser

These are the contract, the same as `docs/TEST-CASES.md`. Money is in poisha (`৳1 = 100`). "Today" = `2026-11-13`.

## §A Wallet balances (`src/domain/accounts.ts`, pure)

Setup:
| account | kind | opening | opening_date |
|---|---|---|---|
| bkash | mobile_wallet | 1000000 (৳10,000) | 2026-11-10 |
| cash | cash | 0 | 2026-11-10 |
| card | credit_card | −500000 (owed ৳5,000) | 2026-11-01 |
| savings | bank | 3000000 | 2026-11-01, `include_in_total = 0` |

Entries:
| id | what | amount | account | date |
|---|---|---|---|---|
| e1 | expense, food_dining | 35000 | bkash | 11-13 |
| e2 | income, rent_income | 250000 | bkash | 11-12 |
| t1 | transfer bkash → cash, fee 1850 | 100000 | — | 11-12 |
| e3 | expense, subscriptions | 60000 | card | 11-09 |
| e4 | expense, food_dining | 99900 | bkash | **11-09** (before bkash opening date) |
| e5 | expense, groceries | 40000 | bkash | 11-11, **deleted** |
| e6 | expense, other | 2000 | NULL (no wallet) | 11-13 |

Expected:
- `bkash` = 1000000 + 250000 − 35000 − 100000 − 1850 = **1113150** (৳11,131.50). e4 is excluded because it's before the opening date. e5 is excluded because it's deleted.
- `cash` = **100000**
- `card` = −500000 − 60000 = **−560000**, displayed "৳5,600 due"
- `savings` = **3000000**, but not in the total
- **Total** = 1113150 + 100000 − 560000 = **653150**
- **Spending (Nov 1–30, msd 1)** = e1 35000 + fee 1850 + e3 60000 + e4 99900 + e6 2000 = **198750**. The transfer amount 100000 is NOT included; the fee IS included; e4 counts as spending even though it doesn't touch the bkash balance.
- **Income** = 250000 (the transfer is not income)
- Delete t1 → its fee row is deleted too → bkash = 1115000, cash = 0, spending = 196900.
- Edit t1's fee 1850 → 0 → the fee expense row is soft-deleted (not left as a ৳0 row); bkash = 1115000.
- A transfer with from = to → rejected by validation. A negative fee → rejected.
- An archived wallet keeps its history but is hidden from the strip and the total. Unarchiving restores it.

## §B Dues (`src/domain/dues.ts`)
| person | entries | expected balance | label |
|---|---|---|---|
| Rafi | lent 200000 (from bkash) · received_back 50000 (into bkash) | **+150000** | "Rafi owes you ৳1,500" |
| Nafees | borrowed 200000 (into nagad) · paid_back 200000 (from nagad) | **0** | "Settled" (moves to Settled) |
| Sumi | lent 50000 (no wallet) | +50000 | wallet balances unaffected |
| Tareq | borrowed 30000 | **−30000** | "You owe Tareq ৳300" |
- Home dues cards: You'll get = 150000 + 50000 = **200000** (2 people); You owe = **30000** (1 person).
- Effect on wallets: bkash −200000 + 50000; nagad +200000 − 200000. Dues never change spending or income totals.
- received_back greater than the outstanding amount → allowed, but shows a warning ("This is ৳X more than Rafi owes") and the balance flips sign.

## §C Backup round-trip (`src/data/backup.ts`)
- Export from a memoryRepo with every table populated (fixtures §A + §B + budgets + settings + day_reviews), then `deleteAllData()`, then import, then the repo is deep-equal to the original (ids, amounts, deleted_at, archived_at, settings).
- Import of a file with `schema` higher than the app's → rejected ("Made by a newer version"). Lower → migrated forward.
- Import with one bad row (amount `"12.5"`, a missing category FK, or a date `2026-02-30`) → **nothing changes** (transaction rolled back), and the error names the row.
- A file larger than 20 MB → rejected before parsing.
- The exported JSON contains no device paths and no reminder notification ids.

## §D Parser additions (`src/voice/parser.ts`)
| input | expected |
|---|---|
| `350 lunch bkash` | expense 35000 food_dining · account = bKash wallet (matched by provider/name, case-insensitive) |
| `paid 1200 electricity from nagad` | expense 120000 utilities · account nagad |
| `got 25000 salary in city bank` | income 2500000 salary · account "City Bank" (by name) |
| `cash out 1000 bkash` | **transfer** bkash → Cash, amount 100000, fee `null` (asks for the fee, prefilled 0) |
| `sent 500 to rafi bkash` | **due** lent 50000 to person "Rafi" (created if new, confirmed in review) · account bkash |
| `rafi paid me back 500` | due received_back 50000 · person Rafi |
| `350 lunch upay` when no Upay wallet exists | expense 35000 · account `null` + hint "No Upay wallet yet: add it?" |
Every draft still needs confirmation. A wallet is never guessed from nothing.

## §E Formatting
| call | result |
|---|---|
| average ৳2,487.69 display | `৳2,488` |
| `compact(4835000)` | `৳48.4k` (cards only) |
| `compact(1250000000)` | `৳12.5M` (v1.2 uses `k`/`M` only; lakh/crore is a later setting) |
| hidden amounts on | `Hidden` everywhere (no dots), including notification-free screens; share card respects the toggle |
| card balance −560000 | `৳5,600 due` |

## §F Day-to-day features (PLAN §8)
**Cash count** (`src/domain/cashCount.ts`): notes {500:1, 200:1, 100:1, 50:1, 20:2, 10:2} + coins 500 → counted **91500**. Expected 96500 → difference **−5000**, outcome short; "lost track" creates expense 5000 `untracked` from Cash and the Cash balance becomes 91500. Same notes with expected 91500 → match, no entry. Expected 90000 → over 1500, "found" creates income 1500. Coins only (0 notes, coins 0) → counted 0, allowed.

**Bazar list** (`src/domain/shopping.ts`): checked prices 38000, 22000, 15000, 15000, 27000; unchecked 3000, 14000 → saved amount **117000**, planned **134000**, "2 left". A checked item with no price blocks saving with "Add a price for Onion". Price memory: last week "Onion 2 kg ৳210", now "Onion 2 kg ৳220" → "up ৳5 a kg" (per-unit: 21000/2 → 22000/2); "Onion 1 bunch" vs "2 kg" → no comparison (different unit).

**Bills** (`src/domain/bills.ts`): November bills: maid 300000 (paid), rent 900000 (paid), internet 200000 (paid), AI Pro 60000 (paid), DESCO variable with last payments 140000/132000/151000 (usual = median **140000**, unpaid), gas 108000 (unpaid), recharge 50000 (unpaid) → "4 of 7 paid", still to pay **298000**. Due day 31 in February 2027 → due 28 Feb. Paying twice in one month is refused (UNIQUE bill_id+period). Undo removes payment + expense together.

**Payday split** (`src/domain/payday.ts`): income 2300000; lines spend Rent 900000 (`housing_rent`), spend Bazar 500000 (`groceries`), spend Bills 300000 (`utilities`), send Ammu 300000, save 200000, spend Free 100000 (no category) → placed 2300000 = income, can start. Budgets written: total **1800000** (Σ spend), per-category rent 900000, groceries 500000, utilities 300000. Placed 2250000 → cannot start until "Leave ৳500 unplaced".

**Occasions** (`src/domain/occasions.ts` + calc): occasion budget 1200000, tagged expenses 500000 + 320000 + 140000 → spent **960000**, left **240000**. With exclude on, a cycle with 400000 normal spending + those 960000 reports monthly spending **400000**; wallet balances still drop by 1360000. With exclude off → monthly spending 1360000.
