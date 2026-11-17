# Khoroch Insights spec (PLAN phase 4)

Date: 2026-11-17. Status: DRAFT for owner approval. Written against branch `dev`.
Governing documents: `docs/UI-FOUNDATION.md` (all visual choices), `AGENTS.md` (no ellipsis, integer poisha, strings through `t()` in English and Bangla, tabular numerals, contrast), `docs/PLAN.md` (performance budget).

Rule for this file: a claim about what people want rests on `docs/SYNTHESIS.md` and `docs/research/*.md`, which are mostly hypotheses. Where a persona question below is my wording of that assumption, it is marked (assumption). No user research was done for this spec.

## 1. Purpose

Insights is the screen a person opens to understand money they have already recorded, and to decide one small thing next. It is not Home. Home answers "what is left today". Insights answers "why, and what is coming".

Test for every figure: if the person reads it, what can they do next? If the answer is "nothing", the figure does not ship.

| Persona (SYNTHESIS) | Question in their words (assumption) | What they can do next |
|---|---|---|
| 1. Daily earner | "Did I earn enough this week? Do I owe the shop? Who has my money?" | Send a reminder to the person who owes; cut a category; log a missing day |
| 2. Garment worker | "Where did my pay go? Can I reach payday after rent and the loan?" | Mark a bill paid; change a category budget; see the cash-out fees |
| 3. Farmer | "How much do I have left until the next sale? What instalment is next?" | Plan the instalment; chase a dealer's baki |
| 4. Remittance household | "Is what came in covering what went out? How many loan instalments are left?" | Check the loan payoff; adjust the household budget |
| 5. Salaried | "Am I spending faster than last month? What bills are still unpaid?" | Mark bills paid; look at the category that grew |
| 6. Freelancer | Not served: one currency per install (SYNTHESIS item 19). Entries in another currency are ignored and counted. | None in this phase |
| 7, 8. Shop, trade | Parked for v2 (SYNTHESIS section 4). | None |

Out of scope: forecasts, net-worth charts (Home hero already has net worth), per-person statements, budgets by voice, any cloud or AI advice. The advice in section 6 is fixed rules, on device.

## 2. Current state and gaps

Everything below was read in the code on 2026-11-17.

### 2.1 What exists

| Thing | File | What it computes |
|---|---|---|
| Insights screen | `src/screens/InsightsScreen.tsx` (1,260 lines), routed from `src/app/plan/insights.tsx` (with back button) and `src/app/(tabs)/insights.tsx` (legacy redirect) | Period dropdown pill with a Sheet of 7 presets (this week, this cycle, last cycle, 3 months, 6 months, this year, custom). Cards: month-to-date versus last cycle, last complete cycle, pattern sentences, averages (per day, per week, per transaction, monthly average), biggest (top category, largest expense, busiest day, most frequent), category changes, a 6-cycle history chart |
| Data hook | `src/state/useInsights.ts` | Loads every transaction from the earliest of: 6 cycles back, 1 January, and a custom start, through the end of the current cycle (up to about 12 months). Builds one `InsightsReport` in a `useMemo` |
| Report builder | `src/domain/insights.ts` (`buildInsightsReport`, `resolveInsightsWindow`, `computeCategoryMtdChanges`, `computeMonthlyAverageOverCompleteMonths`, `buildPatternSentences`) | Per window: total expense, count, per-day average (total / elapsed days, rounded), per-transaction, per-week (total x 7 / elapsed days), top category, largest expense, busiest day, most frequent category, category changes versus the same days last cycle, monthly average over complete cycles |
| Calc helpers | `src/domain/calc.ts` | `summarize` (spent, income, remaining, safe per day = floor(remaining / days left)), `compareMonthToDate`, `compareFullPeriods`, `monthlySeries`, `dailySeries`, `weeklySeries`, `recentPeriodsSeries`, `buildCategoryBreakdown` (top 5 plus Other), `computeAfterBills` (left after unpaid bills and safe per day after bills), `summarizeUnpaidBills`, `summarizeUnpaidBillsDueInPeriod` |
| Fees | `src/domain/netWorth.ts` `computePeriodFeeTotal` | Sum of expense entries in the period with category `fees` or a `transferId` (transfer fees are stored as linked expense entries) |
| Dues | `src/domain/dues.ts` `computeDuesOverview`, `computePersonDueSchedule`, `computeOpenDueEntries` | Per person net, total owed to you and by you; per person overdue amount, next due date, days until or since. Overdue means open amount whose `dueOn` is before the as-of date. Due dates exist only on lent and borrowed entries |
| Loans | `src/domain/emiPayoff.ts` `computeEmiPayoff` | Paid, left, percent, end month, `behindPeriods` for one EMI bill. Always the monthly bill period |
| Bills due date | `src/domain/billReminders.ts` `dueDateInPeriod` | The date a bill falls due inside a bill period, clamped to month length |
| Periods | `src/domain/period.ts` | `getSpendingPeriod` (week or month), `getBillPeriod` (always month), `previousSpendingPeriod`, `buildRecentSpendingWindows`, `getEffectiveWeekStart`, `PeriodConfig` |
| Spending chart | `src/ui/SpendingChart.tsx` | Used on Home. `react-native-svg` bars, daily (one period), weekly, monthly. Reference line (budget limit or average), tooltip on tap, per-bar invisible `Pressable` overlay, a text summary on the Svg (`accessibilityLabel`). Bars start at zero |
| Ring | `src/ui/ProgressRing.tsx` | Svg ring, two circles, `accessibilityRole="progressbar"`. Used on Plan |
| Home | `src/app/(tabs)/index.tsx`, `src/state/useDashboard.ts` | Hero with three tabs (budget, net worth, wallets); safe today and after-bills line; chart; top categories linking to Insights. Fully weekly-aware through `getSpendingPeriod` |
| Plan | `src/app/(tabs)/plan.tsx` | Budget ring, bills with EMI payoff, past weeks, "Insights" row |

### 2.2 Gaps (what Insights does not do today)

1. Insights is monthly-only. `useInsights` and `insights.ts` call `getPeriod` and `previousPeriod` with `monthStartDay`; the screen shows "Insights use monthly cycles, even when your budget is weekly" (`insights.monthlyCyclesNote`). Home, Plan and Ledger are weekly in weekly mode, so a weekly person sees two different worlds.
2. No safe-to-spend, no bills due, no dues, no loan progress, no fees, no income view on Insights. All of these exist in the domain and on other screens.
3. Pattern sentences are hard-coded English strings built in `insights.ts` (`buildPatternSentences`), not `t()` keys. They break the Bangla rule.
4. Percent changes have no minimum base. `computeCategoryMtdChanges` returns a percent for any previous amount above zero, so Tk 20 to Tk 60 reads "200 percent more".
5. Several figures are vanity: per transaction, monthly average beside a per-week figure, busiest day, most frequent category. None leads to an action.
6. Per-week average is `total x 7 / elapsed days`, an extrapolation from as little as one day.
7. Cost: `buildInsightsReport` and the helpers it calls walk the whole transaction list about ten times (totals, MTD, full period, monthly average, one pass per month in `monthlySeries`). With 5,000 entries and up to 12 months loaded this is avoidable work on a weak phone.
8. Charts are not summarised for TalkBack on the history chart beyond one label; the history chart overlays one `Pressable` per bar. Bars do not mark the current partial period except by colour.
9. No dismissable advice. No goal model exists (no target amount anywhere in `types.ts`); DPS and FDR are wallets with no target date.
10. Compact amounts are `k` and `M` only (`compactMoney`), and digit grouping is Western (`groupThousands`: "Western 3-digit grouping in v1"). Bangladesh reads lakh and crore. See open question 5.

## 3. Insight catalogue

Conventions used below.
- All money is integer poisha. Percent values are integers computed with integer arithmetic, rounded half up: `pct = floor((2 * part * 100 + whole) / (2 * whole))`.
- "Period" means the spending period from `getSpendingPeriod(today, periodConfig)`: a month cycle or a 7-day week (section 5).
- "Entry day" means a local date with at least one live expense entry in the active currency.
- New pure functions go in two new files: `src/domain/insightCards.ts` (cards) and `src/domain/advice.ts` (rules). Both take plain data and a `today` string; neither reads a clock.
- Bangla sentences are formal register and NEED A NATIVE CHECK before release. Amounts and counts are filled by `t()` params and converted by `toBnDigits`.

### I0. Shared building blocks (no screen of its own)

`buildDayBuckets(transactions, currency): Map<LocalDate, DayBucket>` where
`DayBucket = { expenseMinor, incomeMinor, expenseCount, incomeCount, byCategory: Map<string, {spentMinor, count}> }`.
One pass over the entries; every later figure is derived from the buckets (at most about 400 per year, not 5,000 entries).

`describeDepth(buckets, today, periodConfig): DataDepth` where
`DataDepth = { entryDays, firstEntryOn | null, closedPeriodsWithData, currentPeriodEntryDays, spanDays }`.
`closedPeriodsWithData` counts finished spending periods that contain at least one entry day. This one value drives every small-data state in section 4.

`changeOrNull(current, previous, minBaseMinor): { diffMinor, pct | null, bigWord: boolean }`. Returns `pct = null` when `previous < minBaseMinor`. `minBaseMinor` is the constant `MIN_BASE_MINOR = 50_000` (Tk 500) in monthly mode and `20_000` (Tk 200) in weekly mode. When `current >= 2 * previous` it sets `bigWord` and the sentence says "more than double" instead of a percent.

### I1. Where the money went

- Question: "What did I spend most on?"
- Definition: `spendByCategory` (exists in `calc.ts`) over the selected window, rolled into `buildCategoryBreakdown(items, totalMinor, 6)` (exists; the default is 5, pass 6). Any category under 3 percent joins "Other". Share for each row: `sharePct` by the integer formula above. Rows are sorted by `spentMinor` descending, ties by name.
- Change column: for the current period only, each row also shows the difference versus the same number of elapsed days in the previous period, from `computeCategoryMtdChanges` generalised to `periodConfig` (task 1). The difference is shown as a signed amount ("+Tk 600"). A percent is shown only when `changeOrNull` returns one.
- Figure: horizontal bars, one row per category: tile, name, bar, amount, share. Why this type and not a donut: bars compare by length on a common zero, labels never collide, 360 dp holds 7 rows, and plain `View` rows cost far less to render than Svg arcs on an old phone. Donuts hide small slices and need a legend.
- Plain sentence (headline of the card), shown only when the top category share is at least 30 percent:
  - English: `{name} took {share}% of what you spent this {period}.` `{period}` is "month" or "week".
  - Bangla (needs native check): `এই {period} আপনার খরচের {share}% গেছে {name}-এ।` with `{period}` = "মাসে" or "সপ্তাহে"
  - Below 30 percent: `Your spending is spread out. The biggest part is {name}, {share}%.` Bangla: `আপনার খরচ ছড়িয়ে আছে। সবচেয়ে বড় অংশ {name}, {share}%।`
- Minimum data to show at all: at least 5 expense entries on at least 3 entry days inside the window. Below that, show only the total and the rows without a sentence or a change column (section 4).
- Taps: a row opens Ledger filtered to that category and window (existing `applyExternalFilters`), or `/category/[id]`. The "Other" row opens the Ledger filtered to the window only.
- Replaces: top category, most frequent, busiest day, per-transaction average, category-changes list.

### I2. Trend over time

- Question: "Am I spending more or less than before?"
- Definition: `buildRecentSpendingWindows(today, periodConfig, N)` (exists) feeds `monthlySeries` (exists) computed from day buckets. N is 6 by default and at most 12. Output per period: `{ period, spentMinor, incomeMinor, isCurrent, isPartial }`. The current period is partial until it ends. Periods with no entries at all and older than the first entry day are not drawn (no fake zero bars before the app was used).
- Comparison (the delta line): current period so far versus the same number of elapsed days in the previous period (`compareMonthToDate`, generalised to `periodConfig`). Never current partial versus previous full.
- Figure: vertical bars, one per period, all starting at zero, values printed above each bar in compact form, period label below. The partial current bar is drawn as an outline with the label "so far" (not colour alone). One tap on a bar shows its exact amount, income and the difference to the bar before in a caption row under the chart. Why bars: periods are separate totals, not a continuous signal, and bars on a zero base cannot mislead. No line, no area, no smoothing.
- Plain sentence:
  - English: `You have spent {diff} {more|less} than the same {days} days last {period}.` With `bigWord`: `You have spent more than double the same {days} days last {period}.` When `pct` exists it may follow: `That is {pct}% {more|less}.`
  - Bangla (needs native check): `গত {period} একই {days} দিনের তুলনায় আপনি {diff} {বেশি|কম} খরচ করেছেন।`
- Thresholds: the delta sentence appears only when both sides have at least 7 elapsed days (monthly) or at least 3 elapsed days (weekly) and at least 5 entries each, as `TEST-CASES.md` section 5 already requires for months. Advice from this insight is rule A6 only.
- Minimum data: two periods that each have at least one entry day (the previous one may be partial because the app was installed mid-period; then the chart marks it "from {date}" and no delta is shown).
- Taps: a bar opens the Ledger for that period.

### I3. Safe to spend (pace)

- Question: "At the speed I am going, will the money last until the end of this period?"
- Definition, using only functions that exist so Home and Insights agree:
  - `summarize` gives `remainingMinor`, `dailyAverageMinor`, `utilizationPct`.
  - Unpaid bills: monthly mode `summarizeUnpaidBills`; weekly mode `summarizeUnpaidBillsDueInPeriod` with the current bill period, exactly as Home does through `computeUpcomingBillsCommitment`.
  - `computeAfterBills` gives `leftAfterBillsMinor` and `safePerDayAfterBillsMinor`.
  - New pure `buildPace(summary, afterBills, daysLeft, spendDays)` returns `{ leftAfterBillsMinor, safePerDayMinor, averagePerDayMinor, gapPerDayMinor | null, daysLeft, spendDays }`. `gapPerDayMinor = max(0, averagePerDayMinor - safePerDayMinor)` and is null when `spendDays < 4`. No projection to the end of the period is computed (no extrapolation).
- Figure: this is the one HeroCard on the screen. Hero value: `safePerDayMinor` ("Safe each day"), context line `Tk {left} left after bills, {days} days to go`. Under it one progress bar (the existing `ProgressBar`) for money used, with one tick for time elapsed. Why: two positions on one track (money used versus time used) show pace at a glance; a ring cannot show two values.
- Plain sentence (under the bar, only when `gapPerDayMinor` is not null and above zero):
  - English: `Your average so far is {avg} a day. {gap} a day less keeps you inside the budget.`
  - Bangla (needs native check): `এ পর্যন্ত আপনার গড় দিনে {avg}। দিনে {gap} কম খরচ করলে বাজেটের মধ্যে থাকবে।`
  - When `gapPerDayMinor` is zero: `You are on track.` Bangla: `আপনি ঠিক পথে আছেন।`
- No budget set: hero shows spent so far, context `No budget set`, and one secondary button "Set a budget" (opens Plan budget). No pace sentence. Weekly mode with no weekly amount behaves the same.
- Minimum data: a budget, and `spendDays >= 4` for the pace sentence. The value and bar need only a budget.
- This card ignores the period selector: it is always "now". It is therefore placed above the selector (section 7).

### I4. Who owes me and whom I owe, with overdue

- Question: "Who has my money, and who is late?"
- Definition: `computeDuesOverview(people, entries)` (exists) gives `youWillGetMinor`, `youOweMinor` and per-person nets. `computePersonDueSchedule(entries, today)` (exists) gives per person `overdueMinor`, `nextDueOn`, `daysUntilNext`. New pure `buildDuesInsight(people, entries, today)` returns `{ getMinor, oweMinor, overdueGetMinor, overdueOweMinor, rows: DuesRow[] }` where `DuesRow = { personId, name, netMinor, overdueMinor, daysOverdue | null, openSinceDays | null }`. `daysOverdue` is `today - earliest overdue dueOn`. `openSinceDays` comes from `PersonSummary.sinceDate` and is used for undated balances. Rows: people with a non-zero net, sorted by overdue first (largest `overdueMinor`), then by `abs(netMinor)`, at most 4 shown.
- Figure: two KPI values side by side (To get, To give) in one Surface per UI-FOUNDATION section 6 (two tiles at 360 dp), then up to 4 plain rows (ListRow: avatar, name, caption, amount). No chart: this is about named people, and a chart would hide the names. Overdue is shown by the word "late" plus days, never colour alone.
- Plain sentence (caption of the first row, or under the KPIs when there are no overdue rows):
  - English, overdue: `{name} owes you {amount}, {days} days past the date you set.` Owing the other way: `You owe {name} {amount}, {days} days past the date.`
  - English, undated: `{name} has owed you {amount} for {days} days. No date is set.`
  - Bangla (needs native check): `{name} আপনাকে {amount} দেবেন; নির্ধারিত তারিখ থেকে {days} দিন পার হয়েছে।` / `আপনি {name}-কে {amount} দেবেন; নির্ধারিত তারিখ থেকে {days} দিন পার হয়েছে।` / `{name}-এর কাছে আপনার {amount} {days} দিন ধরে পাওনা। কোনো তারিখ ঠিক করা নেই।`
- Thresholds: advice rule A4 at 7 or more days overdue, or 30 or more days open with no date.
- Minimum data: at least one person with a non-zero net. Otherwise the section is not rendered at all (no empty card).
- Taps: a row opens `/people/[id]` (where the polite reminder already exists through `buildReminderMessage`). A ghost button "All people" opens the People tab.
- Not period-bound; weekly mode changes nothing.

### I5. Bills and instalments due

- Question: "What do I have to pay soon, and how long is each loan?"
- Definition: new pure `buildUpcomingBills(bills, today, monthStartDay, horizonDays = 14)` returns items `{ billId, name, kind, amountMinor, dueOn, daysUntil, paidThisPeriod, emi: EmiPayoff | null }`. It takes active `bill`, `subscription` and `emi` kinds (via `isExpenseBillOutstanding`), computes `dueOn` with `dueDateInPeriod` for the current and the next bill period, drops items that are paid (`isBillPaidInPeriod`) or due beyond `horizonDays`, and sorts by `dueOn`. For EMI items it attaches `computeEmiPayoff(bill, billPeriod)`. A late unpaid bill (due date before today, not paid) stays at the top with `daysUntil < 0`. Salary kind is excluded. Total: `sum(amountMinor)` of the listed items.
- Figure: a plain list, not a chart (a timeline of a few dated items reads better as rows). Row: name, date ("5 Dec" with "in 3 days" or "2 days late"), amount. EMI rows add a thin `ProgressBar` and the text "8 of 12 paid, ends Mar 2027". At most 4 rows, then a ghost button "All bills" to Plan. A total line above the rows.
- Plain sentence (the total line):
  - English: `{count} bills, {total}, due in the next {days} days.` Single: `{name}, {amount}, due {date}.`
  - Bangla (needs native check): `আগামী {days} দিনে {count}টি বিল বাবদ {total} দিতে হবে।`
- Bills stay monthly in every mode (DECISIONS-LOG, weekly decision D). The horizon is days, not the spending period, so weekly mode shows the same list.
- Minimum data: at least one active bill that is unpaid and due inside the horizon, or a late one. Otherwise not rendered.
- Taps: a row opens Plan at the bills section; "Mark paid" stays on Plan (Insights never writes data).

### I6. Cash-out and transfer fees paid

- Question: "How much do I lose to fees?"
- Definition: new pure `buildFeeInsight(transfers, accounts, window, currency)` returns `{ feeMinor, transferCount, movedMinor, rateBp | null, smallRateBp | null, largeRateBp | null }`. It takes live transfers whose `occurredOn` is in the window and whose `feeMinor > 0`. `feeMinor` is the sum of `feeMinor` (the same money `computePeriodFeeTotal` sums from the linked fee entries; the Ledger does not double count them). `movedMinor` is the sum of `amountMinor` of those same transfers. `rateBp = round(feeMinor * 10000 / movedMinor)`. `smallRateBp` and `largeRateBp` are the rates over transfers under and at or above Tk 1,000 (`100_000` poisha), null when either group has fewer than 2 transfers. `isCashOutTransfer` (exists in `fees.ts`) is used only for the wording ("cash-out" versus "transfer") when every counted transfer is a cash-out. Requires `repo.listTransfers` for the window (exists).
  Also include fee entries with category `fees` that have no `transferId`: add `computePeriodFeeTotal` minus the linked ones only if they differ; the simple rule is to take `feeMinor` from transfers and ignore loose `fees` entries, and show them in the Ledger link. Decision recorded in DECISIONS-LOG when built.
- Figure: one KPI tile (value = fee total, context = `{count} transfers, about {rate}% of {moved}`). No chart: one number and a ratio is the whole story, and a chart of three bars would be decoration.
- Plain sentence:
  - English: `You paid {fee} in fees on {count} transfers, about {rate}% of the {moved} moved.`
  - Bangla (needs native check): `{count}টি লেনদেনে আপনি {fee} ফি দিয়েছেন, যা স্থানান্তরিত {moved}-এর প্রায় {rate}%।`
- Thresholds: advice A8 (section 6).
- Minimum data: at least 2 transfers with a fee in the window. With 1, show the fee as a plain row with no rate. With 0, the section is not rendered.
- Taps: opens Ledger filtered to category `fees` and the window.

### I7. Income steadiness (daily earners)

- Question: "How many days did I earn, and how uneven are my weeks?" (assumption: persona 1 and 3 have uneven income; SYNTHESIS marks it a hypothesis).
- Definition: new pure `buildIncomeRhythm(buckets, today, weekStart)` over the last 4 complete weeks (Saturday to Friday or the user's `getEffectiveWeekStart`) plus the current partial week. Output `{ weeks: {start, incomeMinor, earnDays}[4], currentWeek, earnDays28, lowestMinor, highestMinor, medianMinor }`. `earnDays` is the number of local dates in the week with at least one income entry. `medianMinor` of the 4 complete weeks is the mean of the two middle values, rounded half up.
- Figure: vertical bars, one per complete week (4) plus the current week as an outline bar, a zero base, week label below, "{n} of 7 days" printed under each bar. Why bars: weekly totals are separate amounts; the days count is the thing a daily earner cares about, so it is printed as text rather than encoded in a second axis.
- Plain sentence:
  - English: `You earned on {days} of the last 28 days. Your best week was {high} and your lowest {low}.`
  - Bangla (needs native check): `গত ২৮ দিনের {days} দিন আপনার আয় হয়েছে। সবচেয়ে ভালো সপ্তাহে {high}, সবচেয়ে কম সপ্তাহে {low}।`
- Gate (shows only when the person looks like a daily earner): income entries on at least 8 distinct days in the last 28 days and at least 3 of the last 4 weeks have an income entry. A salaried person with one entry a month never sees it. Because this guesses at the person, section 10 question 4 offers a setting to force it on or off.
- Minimum data: the gate above implies at least 3 weeks of use. Before that, the section is not rendered.
- Taps: none (information only; no dead button).

### I8. Goals

Not built. There is no goal model, no target amount and no target date anywhere in `types.ts`. DPS and FDR wallets have balances only. The only "progress to done" figure the app can compute honestly is the EMI payoff, which appears under I5. A goals card would need new data entry and a schema decision, and nobody in `docs/research` is recorded asking for it. Revisit only after the owner decides to add savings targets (not in this phase).

### I9. Figures retired from the current screen

| Retired | Reason |
|---|---|
| Average per transaction | No decision follows from it |
| Average per week (total x 7 / elapsed days) | Extrapolates from as little as one day |
| Monthly average over complete cycles | Replaced by the trend bars, which show the same periods |
| Busiest day, most frequent category | Vanity: no action |
| Largest expense | Kept only as the Ledger link from the Where-it-went card ("Largest: {description}, {amount}" caption, when the largest entry is at least 25 percent of the total) |
| Per-day average | Moves into the pace card (I3) |
| "Last complete cycle" card | Replaced by selecting "Last period" in the selector |

## 4. Honest small-data states

Definitions. "No data": no live expense entry in the active currency in the window (all-time for trend). "One day": exactly one entry day. "Less than one full period": entries exist but the current period is the first one with data and no closed period has data (`closedPeriodsWithData = 0`). "One period": exactly one closed period with data (`closedPeriodsWithData = 1`). Wording is shown through `t()`; Bangla needs a native check.

| Insight | No data | One day | Less than one full period | One period |
|---|---|---|---|---|
| Whole screen | Existing `EmptyState` (icon, one line, one button "Add an entry") with `Nothing to show yet. Add your first entry and this page fills in.` Bangla: `এখনও কিছু দেখানোর নেই। প্রথম এন্ট্রি যোগ করলে এই পাতা ভরে উঠবে।` | Everything below applies | Everything below applies | Everything below applies |
| I3 Pace | Not rendered if no budget; with a budget: value and bar from zero spent, no sentence | Value and bar; no pace sentence (`spendDays < 4`) | Value and bar; pace sentence after 4 entry days | Same as full |
| I1 Where it went | Total `0`, caption `No entries yet`, no rows | Total and rows, caption `First entry`; no sentence, no change column | Rows; sentence only at 5 entries on 3 days; no change column (no previous period) | Rows and sentence; change column only if previous period has at least 7 elapsed days of data |
| I2 Trend | Not rendered | Not rendered. Instead a one-line text `One day of spending so far: {amount}.` | Not rendered. One line: `{n} days of spending so far: {amount}. A trend needs two periods.` | One bar drawn is a bar with nothing to compare: not drawn. Show the total and `One period of spending so far.` (`overview.chartOnePeriod` exists). Chart appears at 2 periods with data |
| I4 Dues | Not rendered | Same as any day: depends only on people | Same | Same |
| I5 Bills | Not rendered when no bills exist; one line `No bills set up` with a ghost button "Add a bill" only if the person has never added one | Same | Same | Same |
| I6 Fees | Not rendered | Not rendered | A single fee shows as a plain row without a rate | Rate shown from 2 fee transfers |
| I7 Income rhythm | Not rendered | Not rendered | Not rendered until the gate is met (3 of the last 4 weeks) | Same |

Rules against misleading visuals (each is a test or a code review check):

1. Bars always start at zero. No broken axes, no log scales, no dual axes.
2. No percent when the previous amount is under `MIN_BASE_MINOR` (Tk 500 monthly, Tk 200 weekly). Show the amount difference instead. Above double, say "more than double", never "340%".
3. Never compare a partial period with a full one. Compare the same number of elapsed days (as `compareMonthToDate` already does).
4. No average of fewer than 2 periods and no average over days that have no data presented as a daily habit. Averages are over days elapsed, labelled "so far".
5. Never draw a trend line or bar chart from fewer than 2 data points (UI-FOUNDATION section 1, point 6).
6. No projection to the end of a period. Pace compares two real numbers (average so far, safe per day).
7. A bar for a period before the person's first entry is not drawn.
8. A current partial period is marked "so far" and drawn as an outline.
9. Share-of-total uses the same total printed on the screen; "Other" is always labelled; shares are shown to whole percent, and may sum to 99 or 101 (stated in the section 8 accessibility text rather than hidden by adjusting numbers).
10. Hidden-amounts mode (`hideAmounts`) hides every amount and also every figure that would reveal an amount by length (bar lengths stay, since they are relative; chart summary labels say "Hidden").

## 5. Weekly mode

State today: Insights stays monthly while Home, Plan, Ledger presets and the category screen follow the week.

Smallest change that makes Insights consistent with Home (task 1):

1. `useInsights` builds a `PeriodConfig` from settings (`periodKind`, `weekStartDay` via `getEffectiveWeekStart`, `monthStartDay`) and passes it to the domain instead of `monthStartDay`. Monthly config behaves exactly as today (existing tests stay green).
2. In `insights.ts` and the `calc.ts` comparison helpers, replace `getPeriod` and `previousPeriod` with `getSpendingPeriod` and `previousSpendingPeriod`, and `buildRecentPeriodWindows` with `buildRecentSpendingWindows`. Window preset ids stay (no churn in routes or tests): `this_month` means "this spending period", `last_month` means "previous spending period", `last_3_months` and `last_6_months` mean the last 3 or 6 spending periods. Only labels change (`This week`, `Last week`, `6 weeks`). The calendar-week preset `this_week` is hidden in weekly mode because it is now the same thing.
3. `queryRange` in `useInsights` shrinks to what is needed: weekly mode loads 7 weeks back; monthly mode loads 7 cycles back; `this_year` and custom widen it only when selected.
4. Delete the note `insights.monthlyCyclesNote` and its render block.

Behaviour per insight in weekly mode:

| Insight | Weekly behaviour |
|---|---|
| I1 | Period = the week. Change column compares the same elapsed days of last week. Minimum base Tk 200 |
| I2 | Last 6 weeks (Home already offers this). Delta needs 3 elapsed days and 5 entries each side |
| I3 | Budget = `weeklyBudgetMinor` (unset means no-budget state). Unpaid bills are only those due inside the week (`summarizeUnpaidBillsDueInPeriod` with the current bill period), exactly the Home number. Days left count inside the week |
| I4 | Unchanged (not period-bound) |
| I5 | Unchanged (bills are monthly; horizon in days) |
| I6 | The week, or the selected window |
| I7 | Already weekly; unchanged. Uses `getEffectiveWeekStart` |
| Advice | Thresholds that count days use the weekly numbers shown in the I2 and I3 rows above. Rule A11 (finished under budget) uses the finished week against `weeklyBudgetMinor` only |

Done when (task 1): in weekly mode with a fixed `today`, the Insights total for "This week" equals the Home hero spent figure, and the history bars equal Home's Week chart values (a test using the same fixture).

## 6. Advice rules

One pure function: `buildAdvice(input: AdviceInput, state: AdviceState, today: LocalDate): AdviceItem[]` in `src/domain/advice.ts`. `AdviceInput` holds already computed values from the cards above (pace, dues insight, upcoming bills, change rows, fee insight, income rhythm, period totals). `AdviceState` holds dismissals. The function returns at most 2 items, sorted by priority (1 is highest), then by the amount involved, then by id. It never reads the clock, a database or a setting itself.

Tone rules: state the number and the fact; never "you should", "too much", "careless", "overspending" as a judgement, never a red alarm word. Advice uses only values the app already has. No advice about income (the app does not know obligations), no advice about specific shops or people other than naming a person who owes.

| Id | Condition (all must hold) | Message (English template; Bangla in `bn.ts`, needs native check) | Priority | Repeat | Dismiss |
|---|---|---|---|---|---|
| A1 | `pace.gapPerDayMinor > 0`, `spendDays >= 4`, budget set | `Your average so far is {avg} a day. {gap} a day less keeps you inside the budget.` | 2 | Once per period; returns next period if the condition holds | "Hide for this period" |
| A2 | `spentMinor > overallBudgetMinor` | `This {period} you are {over} over the budget. Unpaid bills still to come: {bills}.` Omit the bills sentence when zero | 1 | Once per period | "Hide for this period" |
| A3 | `leftAfterBillsMinor < 0` and `unpaidBillsMinor > 0` (not A2) | `Bills still unpaid come to {bills}. That is {short} more than what is left of your budget.` | 1 | Once per period | "Hide for this period" |
| A4 | A person with `overdueMinor > 0` and `daysOverdue >= 7`, or no date and `openSinceDays >= 30`, net owed to you | `{name} owes you {amount}, {days} days past the date you set.` Button "Send reminder" opens `/people/[id]` | 2 | Once per 7 days per person | "Hide for this person" (until the amount or date changes) |
| A5 | An unpaid bill with `0 <= daysUntil <= 3`, or late | `{name}, {amount}, is due {date}.` Button "Open bills" | 2 | Once per bill per period | "Hide" for that bill this period |
| A6 | Category change with both bases at or above `MIN_BASE_MINOR`, elapsed days at or above the I2 threshold, `current >= 130% of previous` and `diffMinor >= MIN_BASE_MINOR / 2` | `{name} is {diff} higher than the same days last {period}.` Button "See entries" | 3 | Once per category per period | "Hide for this period" |
| A7 | Closed period selected or just finished, at least 10 entries, top category share >= 50 percent | `More than half of what you spent last {period} went to {name}.` | 4 | Once per closed period | "Hide" |
| A8 | `transferCount >= 4` and `smallRateBp - largeRateBp >= 50` (half a percentage point), both groups at least 2 transfers | `Transfers under Tk 1,000 cost {small}% in fees; larger ones cost {large}%. Fewer, larger transfers may cost less.` Shown only when the rates differ, because with a flat percentage fee splitting makes no difference | 4 | Once per month | "Hide for good" |
| A9 | Income rhythm gate met, 4 complete weeks, `lowestMinor * 2 < medianMinor` | `Your weekly income varies. Your lowest week was {low}; a usual week is {median}. Putting a little aside in a good week helps in a thin one.` | 4 | Once per month | "Hide for good" |
| A10 | An EMI with `behindPeriods >= 1` and state active | `{name} is {n} {month|months} behind. Next instalment {amount}.` Button "Open bills" | 2 | Once per month per loan | "Hide for this month" |
| A11 | A finished period with a budget and `spent <= budget` and at least 10 entries | `You finished last {period} {under} under budget.` | 5 | Once per closed period | "Hide" |

Implementation notes.
- Dismissals live in one settings key-value entry `insights_dismissed` (JSON, `{ "<ruleId>:<subject>": "<untilDateOrPeriodStart>" | "forever" }`). Additive, no schema change. Backup normalisation must carry or ignore it (task 11 checks both). Pruned of keys older than 400 days on write.
- Presentation: advice rows are plain rows under a SectionHeader `What stands out`, never cards inside the hero or another card. Each row has the sentence, an optional secondary action link, and a ghost button "Hide" (48 dp). No three-dot menu, no swipe-only gesture.
- Nothing here sends a notification. Bill reminders stay in `reminders.ts` / `billReminders.ts`.
- Each rule has a unit test with a firing case, a just-below-threshold case, a repeat-suppressed case and a dismissed case (task 11).

## 7. Layout

Screen: `Screen scroll` with `useTabScrollPadding()` (the Plan-opened route uses `spacing.xxl` instead). Gutters come from the Screen. Blocks are separated by `geometry.sectionGap`. UI-FOUNDATION caps a screen at 3 type sizes. This screen uses `hero` (the pace value only), `headline` (section titles, card totals, row titles) and `label` (sentences, captions, row detail lines). Do not add `body` or `title` sizes beyond the screen title, which counts as the headline size here: the title row uses `headline`. The reviewer checks the count on the first build.

Ordered sections (top to bottom):

| # | Section | Component | Shown when | Taps |
|---|---|---|---|---|
| 1 | Title row: "Insights", back button when opened from Plan | `AppText title`, `IconButton` | Always | Back |
| 2 | Pace hero (I3) | `HeroCard`, `Money` hero, `ProgressBar`, `Button secondary` "Set a budget" (no-budget state only) | Always (state varies) | Set a budget opens Plan budget |
| 3 | What stands out (advice, 0 to 2 rows) | `SectionHeader`, rows on `bg`, `Button ghost` | At least one rule fires | Action link per rule; Hide |
| 4 | Coming up (I5) | `SectionHeader` + `Surface` with `ListRow`s, `ProgressBar` for EMI | Bills due or late | Row to Plan bills; "All bills" |
| 5 | Owed and owing (I4) | `SectionHeader` + one `Surface` with two KPI tiles, then `ListRow`s | A person has an open balance | Row to `/people/[id]`; "All people" |
| 6 | Period selector | `SectionHeader` "Look back" + `SegmentedControl` of 3: "This {period}", "Last {period}", "Last 6" (periods); a ghost button "Other dates" opens the existing `Sheet` for 3 periods, this year, custom | Always (once data exists) | Changes sections 7 to 10 |
| 7 | Where it went (I1) | `Surface` card: total in `headline` `Money`, sentence in `label`, bar rows | Total always when data; rows per I1 | Row to Ledger or category |
| 8 | Over time (I2) | `Surface` card with one `PeriodBars` Svg chart and a caption row | Two or more periods with data | Bar selects; "See entries" |
| 9 | Fees (I6) | KPI tile in a `Surface` | At least 1 fee transfer in the window | Ledger filtered to fees |
| 10 | Earning days (I7) | `Surface` card with `PeriodBars` (income) | Gate met | None |

Above the fold at 360 x 640 dp (after the status bar and tab bar): sections 1, 2 and 3 fully, the top of 4. A person with no advice sees the pace hero and the Coming up list at once.

Period selector. Sections 1 to 5 ignore it (labelled by their own headers: "now"). Sections 7 to 10 follow it; a caption under the segmented control prints the exact range ("1 to 17 Nov" or "14 to 20 Nov"), using `formatSpendingPeriodLabel`. Selecting does not remount the screen: only the section memos keyed on the window recompute. The selection is not persisted (resets to "This {period}"); this matches today.

Themes. Everything reads from `theme.colors`; checked in light, dark and black. In black mode the hero and cards use the black palette's `surface`; bar fills use `accent` and `textSecondary`, never hard-coded values. Contrast: text 4.5:1 and chart marks 3:1 against their surface, enforced by adding the bar fill and outline pairs to `src/theme/tokens.test.ts`.

Bangla. Digits through `toBnDigits`; labels use `bnMinWidth` as the current screen does to stop the Android Fabric clipped-word bug; allow every row title to wrap to 2 lines (no truncation, no ellipsis); the segmented control labels are short ("এই মাস", "গত মাস", "গত ৬") and the control scrolls nothing: if a label does not fit at 360 dp it wraps inside its segment. Bar category names wrap rather than clip.

ASCII sketch at 360 dp (illustrative; not pixel exact).

```
+------------------------------------+
| <  Insights                        |
|                                    |
| +--------------------------------+ |
| | Safe each day                  | |
| | Tk 640                         | |
| | Tk 8,960 left after bills,     | |
| | 14 days to go                  | |
| | [=======|-------]  money / time| |
| | Your average so far is Tk 760  | |
| | a day. Tk 120 a day less keeps | |
| | you inside the budget.         | |
| +--------------------------------+ |
|                                    |
| What stands out                    |
| Rafi owes you Tk 2,000, 12 days    |
| past the date you set.             |
|   Send reminder          Hide      |
| ---------------------------------- |
| Coming up                          |
| 3 bills, Tk 9,200, due in the next |
| 14 days.                           |
| House rent   5 Dec, in 3 days  8,000|
| Bike loan    9 Dec, in 7 days  1,200|
|   [====------]  4 of 12 paid        |
|                                    |
| Owed and owing                     |
| To get Tk 2,000    To give Tk 500  |
| (up to 4 rows of people here)       |
| Look back                          |
| [This month][Last month][Last 6]   |
| 1 to 17 Nov            Other dates |
| Where it went                      |
| Food took 42% of what you spent    |
| Food       [==========]  3,400  42%|
| Rent       [=====]       1,800  22%|
+------------------------------------+
```

(The sketch is illustrative only; row counts follow the section caps.)

## 8. Charts on old phones

Targets from `docs/PLAN.md`: 60 fps scroll with 5,000 entries, cold start under 3 s on a 2 GB Android 7 phone, no blur on rows. Insights is a tab opened after start, so it must not add to cold start (its screen module loads lazily with the tab; nothing computes until it mounts).

Rendering approach.
- I1 and the bars of I4, I5 are plain `View` rows with a percentage width (no Svg). They cost one native view each.
- I2 and I7 use one `react-native-svg` `Svg` each, with `Rect` marks and `SvgText` labels, built once in a `useMemo` from numbers. A shared component `src/ui/PeriodBars.tsx` serves both (props: `bars: {key, valueMinor, label, subLabel?, isPartial}[]`, `maxMarks`, `summary`).
- One single hit target for the whole chart (a `Pressable` row of equal-width zones is acceptable up to 12 zones; no overlay `Pressable` per mark stacked over the Svg beyond that).
- Avoid: gradients, `ClipPath`, `Mask`, filters and shadows on Svg, `Animated` props on Svg children, `Text` measurement during render, `Svg` per row, `setState` from `onLayout` more than once, and drawing marks for zero-value periods that carry no information. Bars are drawn with no entry animation (the reduced-motion path is the default for charts; UI-FOUNDATION allows transform and opacity only).
- No new chart library (no victory, no skia). `react-native-svg` is already shipped.

Limits and data reduction.

| Chart | Max marks | Reduction rule |
|---|---|---|
| I1 bars | 7 rows (6 categories plus Other) | `buildCategoryBreakdown(items, total, 6)`; categories under 3 percent fold into Other |
| I2 bars | 12 bars (default 6) | A custom or year window longer than 12 periods is bucketed to coarser units: days to weeks, weeks to cycles. Never sample (drop) points; always sum into buckets so totals stay exact |
| I7 bars | 5 (4 complete weeks and the current) | Fixed |
| Lists (I4, I5) | 4 rows each | Top by rule, then a link; never render the full list |
| Total Svg nodes on screen | 80 | Sum of marks and labels across charts; a test counts them from the pure builder |

Where aggregation runs.
1. Step 1 (this spec): JavaScript, one pass. `useInsights` loads the entries it needs with the existing `repo.listTransactionsInRange` and `buildDayBuckets` reduces them once; every card derives from the buckets (a few hundred objects), not from the entry list. This removes the roughly ten passes of today. The query range shrinks as described in section 5, item 3.
2. Step 2 (only if the measurement below fails on the reference phone): add `repo.dailyTotals(fromIncl, toExcl, currency)` using SQL `SELECT occurred_on, category_id, type, SUM(amount_minor), COUNT(*) FROM transactions WHERE deleted_at IS NULL AND currency = ? AND occurred_on >= ? AND occurred_on < ? GROUP BY occurred_on, category_id, type`. It rides the existing index `idx_tx_date (deleted_at, occurred_on)`. It needs a `memoryRepo` twin and the same test fixtures (TEST-CASES section 6 requires memory and SQLite to behave identically). SQL returns at most days times categories rows (about 400 rows a year for a typical user), so JS work becomes trivial. Not built in step 1 because the data is already loaded for other screens and the plain-JS pass should be fast enough; this is a measurement call, not a guess.

Memoisation.
- `buckets` depends only on the entry list, currency (identity changes only on a data version bump).
- Each card builder has its own `useMemo` keyed on its inputs (`buckets`, `window`, `today`, `periodConfig`, plus `bills`, `people` and `dueEntries` only for the cards that use them). Changing the selector recomputes sections 7 to 10 only.
- Sections 6 to 10 render in a second pass: the first frame paints sections 1 to 5 and placeholders of fixed height (no spinner, no dots), then a `requestAnimationFrame` flag mounts the rest, so the first paint stays short. Fixed-height placeholders avoid layout jumps.
- Row components are `React.memo` with primitive props and hoisted styles (UI-FOUNDATION section 9).

Measurable budget per chart. The reference device is the lowest-spec phone available at test time. If only the owner's Galaxy S25 Ultra (USB serial R5CY23M7E6L, dev app `com.hamim.budgetapp.dev`) is available, apply a 5x allowance as an assumption, not a measured ratio, and say so in the result.

| Measure | Budget | How to check |
|---|---|---|
| `buildDayBuckets` plus all card builders, 5,000 entries over 12 months | Under 40 ms on the dev PC in jest, under 200 ms on the reference phone | A jest test timing the builders on a seeded 5,000-entry fixture (fail at 150 ms on the PC as a coarse guard); on the phone, a one-off `performance.now()` log in a dev-only build |
| First paint of sections 1 to 5 after the tab opens | Under 250 ms | Phone: `adb shell dumpsys gfxinfo com.hamim.budgetapp.dev framestats` taken just after the tab switch |
| Chart mount (`PeriodBars`, 12 bars) | Under 40 ms | React profiler in the dev build, or `performance.now()` around the first render |
| Scroll jank, whole screen, 5,000 entries (use the dev app's sample data plus the seeded fixture import) | Under 5 percent janky frames; no frame over 100 ms | `gfxinfo` percentage after a full scroll |
| Svg nodes | At most 80 on screen, at most 40 per chart | Counted in a unit test of the pure bar builder |
| Memory | No growth over 20 MB after opening Insights ten times | `adb shell dumpsys meminfo com.hamim.budgetapp.dev` before and after |

Accessibility.
- Every chart wrapper is one `accessible` element with `accessibilityRole="image"` and an `accessibilityLabel` from `t()` that states: what it shows, the number of bars, the total, and the highest bar with its amount (as `insights.historyChartA11y` does today). In hidden-amounts mode the amounts read "Hidden".
- Bar zones that are tappable are real `accessibilityRole="button"` elements with the period and amount as the label, at least 48 dp wide (12 bars at 360 dp is 28 dp each; so beyond 6 bars the tap zones are 48 dp and the chart scrolls horizontally, or the number is capped at 7; builder picks the cap of 7 visible bars plus a "Last 12" toggle if 12 is needed; default 6 means no problem).
- Meaning never rests on colour: partial period = outline plus the word "so far"; over budget = the word and an icon plus colour; overdue = the word "late" plus days.
- Each list row reads as one sentence to TalkBack (name, amount, status).
- Respect `reducedMotion` (charts have no entry animation at all).

Number formatting.
- Amounts through `Money` only; `allowCompact` for chart value labels. Compact form today is `k` and `M` (`compactMoney`). Bangladesh reads lakh and crore, and in Bangla `হাজার`, `লাখ`, `কোটি` (open question 5; until decided, the existing compact form ships).
- Bangla digits through `toBnDigits` (AppText and Money do it automatically in the `bn` locale). Never hand-format digits.
- Whole-taka display (`showPoisha` false) on charts and KPIs unless the user turned poisha on; the underlying value stays integer poisha.
- True minus (U+2212) is already handled in `Money`. Dates through the existing formatters. Percentages: integer plus the percent sign; in Bangla the sign follows the digits.

## 9. Build tasks, in order

Each task is one builder session. After each: `npm run typecheck`, `npm test`, and the no-ellipsis test must pass (AGENTS section 2 rule 9, section 4b). Phone checks use only the dev app `com.hamim.budgetapp.dev` (AGENTS section 7). Builders add strings to both `src/i18n/en.ts` and `src/i18n/bn.ts` and never write three periods in a row or the ellipsis character. Every task is followed by the reviewer.

| # | Task | Files | Depends on | Done when |
|---|---|---|---|---|
| 1 | Period config plumbing (weekly consistency) | `src/domain/insights.ts`, `src/domain/calc.ts` (compare helpers take a `PeriodConfig`), `src/state/useInsights.ts`, `src/screens/InsightsScreen.tsx` (labels, remove note), `src/i18n/en.ts`, `bn.ts`, `src/domain/insights.test.ts`, `src/domain/weeklyPeriod.test.ts` | none | `npm test -- insights weeklyPeriod` passes, with new cases: weekly "this period" total equals Home's weekly total for the same fixture; monthly cases unchanged; `insights.monthlyCyclesNote` is gone; `npm run typecheck` exits 0 |
| 2 | Day buckets, depth, change helper, and one-pass report | new `src/domain/insightData.ts`; `insights.ts` refactored to read buckets; `insights.test.ts` | 1 | New tests: buckets equal the old per-function totals on the existing fixtures; `changeOrNull` returns null pct under the base and `bigWord` at double; `describeDepth` returns the five states; a timing test on 5,000 synthetic entries finishes under 150 ms |
| 3 | Replace hard-coded English pattern sentences with `t()` keys | `src/domain/insights.ts` (return ids and params, not text), `InsightsScreen.tsx`, i18n en and bn, tests | 2 | `grep -n "You spent" src/domain/insights.ts` finds nothing; tests assert ids and params; no-ellipsis test passes |
| 4 | Pace hero (I3) | `src/domain/insightCards.ts` (`buildPace`), `src/ui/InsightsPace.tsx` (uses `HeroCard`, `ProgressBar`), `InsightsScreen.tsx`, i18n | 1, 2 | Test: budget 20,000, spent 5,000 with 10 days elapsed of 30, unpaid bills 6,000 gives left after bills 9,000 and safe per day 450 (20 days left); gap null at 3 entry days; no-budget state shows "Set a budget" which navigates |
| 5 | Where it went (I1) | `insightCards.ts` (`buildWhereItWent`), `src/ui/CategoryBars.tsx` (Views), `InsightsScreen.tsx`, i18n | 2 | Test: shares round half up and Other folds under 3 percent; sentence variant switches at 30 percent; no sentence under 5 entries or 3 days; row taps call `applyExternalFilters` (screen test) |
| 6 | Trend bars (I2) | `src/ui/PeriodBars.tsx`, `insightCards.ts` (`buildTrend`), `InsightsScreen.tsx`, i18n; retire the old history chart | 2 | Test: bars begin at zero; partial current period flagged; no bar before first entry; not rendered at under 2 periods; a11y label exists; Svg node count under 40 |
| 7 | Bills and instalments due (I5) | `insightCards.ts` (`buildUpcomingBills`), `src/ui/UpcomingBills.tsx`, `InsightsScreen.tsx` (needs bills from `AppContext` repo in `useInsights`), i18n | 1 | Test: a bill due on the 5th seen on the 3rd lists as "in 2 days"; paid bills drop; late bill first; EMI row shows "8 of 12 paid" for 12 total with 8 paid; weekly mode gives the same list |
| 8 | Owed and owing (I4) | `insightCards.ts` (`buildDuesInsight`), `src/ui/DuesInsight.tsx`, `useInsights.ts` (people, due entries), i18n | 1 | Test: overdue sorts first; undated balance gets `openSinceDays`; with no open balances the section is absent (screen test) |
| 9 | Fees (I6) | `insightCards.ts` (`buildFeeInsight`), `InsightsScreen.tsx`, i18n | 2 | Test: 3 transfers with fees 18.50, 37.00, 9.25 on 1,000, 2,000, 500 give rate 185 bp; rate null under 2 transfers; the fee total equals `computePeriodFeeTotal` on the same fixture |
| 10 | Income steadiness (I7) | `insightCards.ts` (`buildIncomeRhythm`), reuse `PeriodBars`, `InsightsScreen.tsx`, i18n | 6 | Test: gate fails for one income entry a month, passes for 8 income days in 28 across 3 of 4 weeks; median of four computed; not rendered when the gate fails |
| 11 | Advice engine | new `src/domain/advice.ts` and `advice.test.ts`; dismissals in settings store `insights_dismissed`; `src/data/backup.ts` carries or ignores the key | 4, 5, 6, 7, 8, 9, 10 | Each of A1 to A11 has four tests (fires, below threshold, repeat suppressed, dismissed); at most 2 returned; priority order verified; `npm test -- advice backup` passes; an old backup without the key imports |
| 12 | Screen assembly, selector and layout | `src/screens/InsightsScreen.tsx` (new section order, `SegmentedControl` of 3, "Other dates" Sheet), remove retired cards (I9), two-pass render | 4 to 11 | Screen tests for each section present or absent; retired strings gone from `en.ts` and `bn.ts`; typecheck and tests pass; web check at 360, 390 and 430 wide, light, dark and black |
| 13 | Small-data states and copy | i18n en and bn, section states in each component, `EmptyState` | 12 | A fixture test per row of the section 4 table (none, one day, partial, one period) asserts which sections render and their text; `no-ellipsis.test.ts` passes |
| 14 | Accessibility and performance verification | `src/theme/tokens.test.ts` (chart contrast pairs), `src/ui/a11y.test.tsx`, a seeded-5,000-entry fixture; phone check (dev app only) | 12, 13 | Contrast tests pass; every chart has a non-empty `accessibilityLabel`; budgets in section 8 measured and written in `docs/PROGRESS.md`, or marked NOT VERIFIED with the reason; the only test entry on the phone is `UI TEST – delete me`, deleted after |
| 15 (conditional) | SQL daily totals | `src/data/repo.ts`, `sqliteRepo.ts`, `memoryRepo.ts`, tests | 14 shows the JS budget missed | `repo.dailyTotals` gives the same buckets as `buildDayBuckets` on the fixture in both repos; the budget is met after |

## 10. Open questions for the owner (at most six)

1. Should Insights keep a custom date range and "This year"? They add a sheet, many data-reduction cases and few decisions. Recommended default: keep them behind the "Other dates" button, bucketed by the data-reduction rules, and do no extra design for them.
2. Is it right to retire the averages and "biggest" figures (section 3, I9)? They are the main content of today's screen. Recommended default: retire them; per-day average moves into the pace card and the largest expense becomes a caption.
3. Advice tone and dismissal: the rules show at most two items, each with "Hide". Recommended default: ship as in section 6, with A8 (fee advice) and A9 (income swings) behind "Hide for good" and off by default until the owner has read their wording in Bangla.
4. Income steadiness (I7) guesses the person is a daily earner from their entries. Recommended default: auto-gate as specified, and add a later settings row "Show earning days" (Auto, On, Off) only if the guess is wrong in testing.
5. Lakh and crore: amounts use `k` and `M` and Western grouping today. Recommended default: for the `bn` locale use `হাজার`, `লাখ`, `কোটি` in compact labels, and move to lakh grouping (1,00,000) in a separate task with a native check; English keeps `k` and `M`.
6. Is it acceptable to keep Insights single-currency? Entries in another currency are ignored and counted today. Recommended default: yes; show one caption `{n} entries in another currency are not counted` when the count is above zero, until a currency decision exists (SYNTHESIS item 19).
