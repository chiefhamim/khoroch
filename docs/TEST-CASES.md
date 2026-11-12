# TEST-CASES — exact expected values

These are the **contract**. Implement tests that assert exactly these values. If your code disagrees, the code is wrong unless you can prove the case itself contradicts SPEC DECISIONS — then log it in `docs/DECISIONS-LOG.md` and keep the DECISIONS rule.

All money is integer minor units (poisha). `৳ 1 = 100`. Currency is `BDT` unless stated.
Category ids: `food_dining, groceries, transportation, shopping, housing_rent, utilities, health, entertainment, education, travel, subscriptions, personal_care, family, gifts, other` (expense) and `salary, business, gift_received, other_income` (income).

---

## §1 Money (`src/domain/money.ts`)

Parsing user input (string → minor units). **Never** use `parseFloat(x) * 100` (0.29 × 100 = 28.999…). Split on `.` and use integers.

| input | result |
|---|---|
| `"1250"` | `125000` |
| `"1,250.5"` | `125050` |
| `"0.29"` | `29` |
| `"1.10"` | `110` |
| `"999999999.99"` | `99999999999` |
| `"1000000000"` | error `too_large` |
| `"0"` / `"0.00"` | error `must_be_positive` |
| `"-5"` | error `invalid` |
| `"0.005"` | error `too_many_decimals` |
| `"abc"` / `"1.2.3"` | error `invalid` |
| `""` / `"   "` | `null` (empty, not an error) |
| `"২৫০"` (Bangla digits) | `25000` |

Formatting (minor → display):

| call | result |
|---|---|
| `formatMoney(125000, 'BDT')` | `৳ 1,250` |
| `formatMoney(125050, 'BDT')` | `৳ 1,250.50` |
| `formatMoney(29, 'BDT')` | `৳ 0.29` |
| `formatMoney(0, 'BDT')` | `৳ 0` |
| `formatMoney(-20000000, 'BDT')` | `-৳ 200,000` |
| `formatMoney(123456789, 'USD')` | `$1,234,567.89` |
| `formatMoney(500000, 'EUR')` | `€5,000` |

## §2 Periods (`src/domain/period.ts`)

| today | monthStartDay | start | endExcl | length | elapsed | remaining |
|---|---|---|---|---|---|---|
| 2026-11-13 | 1 | 2026-11-01 | 2026-12-01 | 30 | 13 | 18 |
| 2026-11-01 | 1 | 2026-11-01 | 2026-12-01 | 30 | 1 | 30 |
| 2026-11-30 | 1 | 2026-11-01 | 2026-12-01 | 30 | 30 | 1 |
| 2028-02-29 | 1 | 2028-02-01 | 2028-03-01 | 29 | 29 | 1 |
| 2026-02-15 | 1 | 2026-02-01 | 2026-03-01 | 28 | 15 | 14 |
| 2026-11-13 | 25 | 2026-10-25 | 2026-11-25 | 31 | 20 | 12 |
| 2026-11-25 | 25 | 2026-11-25 | 2026-12-25 | 30 | 1 | 30 |
| 2026-03-01 | 28 | 2026-02-28 | 2026-03-28 | 28 | 2 | 27 |
| 2027-01-05 | 1 | 2027-01-01 | 2027-02-01 | 31 | 5 | 27 |

Invariant (property test over every day of 2026–2028 × monthStartDay 1..28): `elapsed + remaining === length + 1`, and `start <= today < endExcl`.
`previousPeriod` of `2027-01-01..2027-02-01` (msd 1) is `2026-12-01..2027-01-01`.
`monthStartDay` outside 1..28 → throws.

## §3 Calculation service (`src/domain/calc.ts`)

### Scenario A — the dashboard example from SPEC §6.2
today `2026-11-13`, msd 1, overall budget `4000000` (৳40,000).
Expenses in Nov 1–13 totalling `1645000` (৳16,450): use these rows

| id | type | amount | category | occurred_on |
|---|---|---|---|---|
| a1 | expense | 650000 | food_dining | 2026-11-02 |
| a2 | expense | 280000 | transportation | 2026-11-04 |
| a3 | expense | 420000 | shopping | 2026-11-07 |
| a4 | expense | 195000 | utilities | 2026-11-10 |
| a5 | expense | 100000 | entertainment | 2026-11-12 |
| a6 | income | 5000000 | salary | 2026-11-01 |
| a7 | expense | 300000 | food_dining | 2026-11-11 | ← `deleted_at` set (must be ignored) |
| a8 | expense | 999900 | shopping | 2026-10-31 | ← previous period (ignored for Nov) |
| a9 | expense | 10000 | food_dining | 2026-11-05 | ← currency `USD` (ignored, counted) |

Expected `summarize(...)`:
- `spentMinor = 1645000`
- `incomeMinor = 5000000`
- `remainingMinor = 2355000`
- `utilizationPct = 41.125` → status `ok`
- `dailyAverageMinor = 126538` (1645000 / 13 = 126538.46 → round half-up)
- `safeToSpendPerDayMinor = 130833` (2355000 / 18 = 130833.33 → floor)
- `expenseCount = 5`, `averageTransactionMinor = 329000`
- `largestExpense.id = 'a1'`, `topCategoryId = 'food_dining'`
- `ignoredOtherCurrencyCount = 1`

`spendByCategory` → `[food_dining 650000, shopping 420000, transportation 280000, utilities 195000, entertainment 100000]` (sorted desc).
`dailySeries` → 30 entries (Nov 1..30), zeros included; `2026-11-02 = 650000`; sum of all = `1645000`.

### Other summarize cases
| case | expected |
|---|---|
| No transactions, budget 4000000 | spent 0, income 0, remaining 4000000, util 0, status ok, dailyAvg 0, avgTx `null`, largest `null`, top `null` |
| Budget `null` | remaining `null`, util `null`, safeToSpend `null`, status `no_budget` |
| Budget `0` | treated as not set: same as `null` row above |
| Budget 1000000, spent 1200000 | remaining `-200000`, util 120, status `over`, safeToSpend `0` |
| Budget 1000000, spent exactly 1000000 | remaining 0, status `reached`, safeToSpend 0 |
| util 69.99 / 70 / 84.99 / 85 / 99.99 / 100 / 100.01 | ok / info / info / attention / attention / reached / over |
| Expense dated 2026-11-20 (future, same period) 100000, today 11-13, plus Scenario A | spent `1745000` (included), dailyAverage still `126538` (only ≤ today counts) |
| Income only (5000000), budget 4000000 | spent 0, remaining 4000000 (income never adds to budget) |
| Edit a1 category food_dining → transportation | spendByCategory: transportation 930000 first, food_dining absent |
| Edit a1 amount 650000 → 50000 | spent 1045000 |
| Two expenses tie for largest (same amount) | the one with later `occurred_on`, then later `created_at` |
| Only types `expense` and `income` exist | constructing/validating a `transfer` or `refund` type is rejected by validation |

### Month comparison
| today, msd | data | expected `compareMonthToDate` |
|---|---|---|
| 2026-03-13, 1 | Mar 1–13: 1000000 total · Feb 1–13: 800000 · Feb 20: 500000 | current 1000000, previous 800000 (Feb 20 excluded), diff 200000, pct 25, daysCompared 13 |
| 2026-03-31, 1 | Mar: 300000 · Feb (whole): 600000 | previous uses all of Feb (28 days): previous 600000, diff -300000, pct -50 |
| 2026-11-13, 1 | Nov: 100000 · Oct 1–13: 0 | previous 0 → pct `null` (UI: "No spending last month to compare") |

`compareFullPeriods` on 2026-11-13: compares Oct 2026 (complete) vs Sep 2026 (complete) — never the current partial month.

## §4 Quick-entry parser (`src/voice/parser.ts`)

`parse(text, today = '2026-11-13')` returns an array of drafts:
`{ type, amountMinor | null, categoryId | null, description, occurredOn, needsAmount, needsCategory, requiresConfirmation: true }`

| input | expected drafts |
|---|---|
| `I spent 350 taka on lunch today` | expense · 35000 · food_dining · "Lunch" · 2026-11-13 |
| `Paid 1200 taka for electricity` | expense · 120000 · utilities · "Electricity bill" |
| `I received 25 thousand taka salary` | **income** · 2500000 · salary · "Salary" |
| `Spent 500 on Uber and 200 on coffee` | **2 drafts**: expense 50000 transportation "Uber" · expense 20000 food_dining "Coffee" |
| `350 taka lunch` | expense · 35000 · food_dining · "Lunch" |
| `1200 electricity` | expense · 120000 · utilities · "Electricity bill" |
| `spent 1.5k on groceries` | expense · 150000 · groceries · "Groceries" |
| `৳250 dinner yesterday` | expense · 25000 · food_dining · "Dinner" · **2026-11-12** |
| `Three hundred taka for lunch` | expense · 30000 · food_dining · "Lunch" |
| `spent 25,000 on rent` | expense · 2500000 · housing_rent · "Rent" |
| `got 2 lakh from business` | income · 20000000 · business · "Business" |
| `rickshaw 60 tk` | expense · 6000 · transportation · "Rickshaw" |
| `bought medicine for 450.50` | expense · 45050 · health · "Medicine" |
| `২০০ টাকা` | expense · 20000 · `null` · needsCategory **true** |
| `lunch` | expense · amount `null` · food_dining · needsAmount **true** |
| `spent 300 on blah` | expense · 30000 · `null` · needsCategory true |
| `` (empty) / `hello` | `[]` (nothing to confirm; UI says "Couldn't find an amount") |

Every draft has `requiresConfirmation: true`. The parser never returns a guessed amount.
Number words to support: zero–nineteen, tens, `hundred`, `thousand`, `k`, `lakh`/`lac`. Income verbs: received, got, earned, salary. Currency words: `taka`, `tk`, `৳`, `টাকা`, `bdt`.

Keyword → category map lives in `src/domain/categories.ts` (e.g. lunch/dinner/breakfast/coffee/tea/snacks/restaurant → food_dining; grocery/groceries/bazar/bazaar → groceries; uber/pathao/rickshaw/cng/bus/taxi/fuel/petrol → transportation; electricity/gas bill/water bill/internet/wifi/recharge → utilities; rent → housing_rent; medicine/doctor/pharmacy → health; netflix/spotify/subscription → subscriptions; movie/cinema → entertainment; tuition/books/course → education; salary → salary; business/freelance → business). Description = the matched keyword's label (electricity → "Electricity bill"), capitalised.

## §5 Insights (`src/domain/insights.ts`)

- Pattern sentences only when **both** periods have ≥ 5 expense transactions **and** ≥ 7 elapsed days. Otherwise return no sentences (UI shows "Keep logging — insights appear after a week of data").
- Category change sentence: "You spent 18% more on Food & Dining than the same point last month." — uses the MTD window, pct rounded to whole number.
- Most expensive day: the local date with the highest expense sum; tie → later date.
- Most frequent category: highest count; tie → higher amount.
- Monthly average over N months: sum of complete periods ÷ N (never include the current partial period).

## §6 Repository (memoryRepo tests; sqliteRepo must behave identically)

- Insert the same `id` twice → exactly 1 row.
- Soft-deleted rows don't appear in `listTransactionsInRange` or search, but `getTransaction(id)` still returns them with `deletedAt`.
- Archiving a category keeps old transactions pointing at it; `listCategories()` hides it; `listCategories({ includeArchived: true })` shows it.
- `setBudget` for Nov doesn't change Oct.
- `ensureBudgetsForPeriod(Dec, Nov)` copies Nov's rows once; calling it again (or after the user edits Dec) does nothing.
- `deleteAllData()` → no transactions, no budgets, settings reset (`onboarding_done` false).
