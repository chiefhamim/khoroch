# PROGRESS — the agent's checklist and memory

Legend: `[ ]` not started · `[~]` in progress · `[x]` done and verified · `BLOCKED:` see note
Rules: `AGENTS.md`. At the start of **every** phase re-read AGENTS.md + SPEC DECISIONS + the sections listed. Don't rely on memory.
You may tick boxes, add `BLOCKED:` notes under tasks, and append to the Log. Don't delete or reword tasks or "Done when" lines.

Standard checks (referred to below as **CHECKS**):
`npm run typecheck` → 0 errors · `npx expo lint` → 0 errors · `npm test` → all pass, 0 skipped · `npx expo export --platform web --output-dir dist-check` → succeeds

---

## Phase 0 — Baseline  [x]
Re-read: everything in `docs/` once, fully.
Already done by the planner: Expo SDK 58 project created, template demo code removed, `npm run typecheck` passes.
- [x] Read AGENTS.md, SPEC.md (all), ARCHITECTURE.md, TEST-CASES.md, this file
- [x] `npm run typecheck` passes on the untouched baseline
- [x] Add `dist-check/` to `.gitignore` (done by planner; web export verified working on the baseline)
- [x] Commit: `Phase 0: plan docs + clean Expo baseline`

**Done when:** the Phase 0 commit exists and typecheck passes.

---

## Phase 1 — Foundation  [x]
Re-read: SPEC **DECISIONS**, §2, §3, §4, §17, §20 · ARCHITECTURE (all) · TEST-CASES §1, §2, §3, §6

- [x] Install with `npx expo install`: `expo-sqlite`, `react-native-svg`, `@expo-google-fonts/inter`, `expo-crypto` (UUIDs), `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native` (dev deps where appropriate). Optional: `zustand`.
- [x] Jest configured (`preset: 'jest-expo'`), `"test": "jest --watchAll=false"` in package.json, ignores `dist-check/`
- [x] `src/theme/tokens.ts` (light + dark exactly as ARCHITECTURE §6, contrast-checked), ThemeProvider with system/light/dark, Inter loaded
- [x] `src/i18n` with `t()`, `en.ts`, `bn.ts` stub (same keys)
- [x] UI primitives: `Screen` (safe area + 20dp margins), `AppText` (variants from tokens), `Money` (tabular nums, uses formatMoney), `Card`, `Button`, `EmptyState`
- [x] `src/domain`: `types.ts`, `money.ts`, `dates.ts`, `period.ts`, `calc.ts`, `validation.ts`, `categories.ts` (defaults + keyword map)
- [x] Tests for TEST-CASES §1, §2 (incl. the property test), §3 — all passing
- [x] `src/data`: migrations (schema in ARCHITECTURE §3), `repo.ts` interface, `sqliteRepo.ts`, `memoryRepo.ts` + tests for TEST-CASES §6
- [x] DB opens + migrates at startup in root `_layout.tsx`; on web, if expo-sqlite web can't work after 3 attempts, use memoryRepo on web only and log it in DECISIONS-LOG
- [x] `(tabs)/_layout.tsx`: Overview, Activity, Budget, Insights, Settings + visible Add button; each tab shows a proper titled `EmptyState` (no fake numbers)
- [x] Add button opens `transaction/new` (may show a minimal working form here; full sheet is Phase 2)

**Done when:**
- CHECKS pass; every TEST-CASES §1, §2, §3, §6 case exists as a test and passes
- Web preview (390×844) shows the 5 tabs + Add in light and dark mode without errors in the console
- Log lists test count and anything BLOCKED

---

## Phase 2 — Onboarding & Transactions  [x]
Re-read: SPEC **DECISIONS**, §5, §7, §13 (list part only), §16, §22 · ARCHITECTURE §2, §3, §7

- [x] Onboarding steps 1–6 (welcome · preferences: name, currency BDT/USD/EUR, month start day 1–28 · budget (skippable, copy explains budget ≠ balance) · categories pick · reminder choice (just store the preference now; scheduling is Phase 4) · done) → writes settings → `onboarding_done`
- [x] Root gate: not onboarded → onboarding; onboarded → tabs
- [x] Default categories seeded (15 expense + 4 income) with icons
- [x] Add transaction sheet: Expense/Income switch (default Expense) · big amount with on-screen `AmountPad` · category chips (selected ones first, horizontal scroll) · description with recent suggestions · date (Today / Yesterday / pick date) · optional time + note collapsed under "More"
- [x] Validation + friendly errors; input preserved on failure; id generated on open; Save disabled while saving; success feedback; sheet closes
- [x] `transaction/[id]`: view, edit every field, delete with confirm (soft delete)
- [x] Activity tab (basic): list grouped by date with daily totals, paginated (no "load everything"), tap → detail, empty state
- [x] Settings: name · currency (locked with explanation once any transaction exists) · month start day · theme · categories screen (add, rename, change icon, archive) · delete all data (two-step confirm → back to onboarding) · about
- [x] `__DEV__`-only "Load sample data" / "Clear sample data" in Settings (≈ 3 months, ~150 realistic BDT transactions, source='sample')
- [x] Component tests (RNTL): add form double-tap saves once; invalid amount shows error and keeps input; delete asks for confirmation

**Done when:**
- CHECKS pass
- Web: fresh start → onboarding → add expense → add income → both in Activity with right totals → edit one → delete one → numbers update everywhere
- Persistence: on web reload data survives **if** web uses SQLite; if web uses memoryRepo, write "persistence across restart = Needs phone test" in the Morning summary (do not claim it)

---

## Phase 3 — Dashboard & Budget  [x]
Re-read: SPEC **DECISIONS**, §6, §10, §17 · ARCHITECTURE §5, §6 · TEST-CASES §3

- [x] Overview: greeting by time of day + name + date · **budget card** (budget, spent, remaining — remaining is the hero number; negative shown explicitly; % used; progress bar; status colour **+ icon + label**; period dates; "Edit budget" shortcut; one line "Budget is a spending plan, not your wallet balance")
- [x] 4 metric cards: Average daily spending · Safe to spend per day · Income this month · Expense this month — each with an ⓘ that explains the formula in plain words
- [x] Spending chart (react-native-svg): Daily / Weekly / Monthly switch, tap a bar → value + date tooltip, readable at 360dp
- [x] Category breakdown (horizontal bars, top 5 + "Other"), tap → `category/[id]` list for that period
- [x] Recent activity (latest 5) + "View all" → Activity
- [x] Highlights: top category · largest expense · # transactions · vs same point last month (MTD rule)
- [x] All numbers come from `calc.ts` via `state/useDashboard.ts` — no sums inside components
- [x] Budget tab: overall budget edit · per-category budgets (add/edit/remove) · per-category spent/remaining/% + status · "unallocated" amount · remaining days · previous periods (read-only list) · copy-forward on new period
- [x] Dashboard re-queries after any write (dataVersion) — adding an expense updates every number without restart

**Done when:**
- CHECKS pass
- A component test renders Overview with Scenario A fixture (TEST-CASES §3) and asserts the displayed strings: `৳ 23,550` remaining, `৳ 16,450` spent, `41%` (or `41.1%`, logged), `৳ 1,265.38` daily average, `৳ 1,308.33` safe per day
- Web check with sample data at 360, 390, 430 widths × light/dark: no overflow, no overlap, numbers aligned; over-budget state checked by setting a small budget

---

## Phase 4 — Quick Entry, Voice, Reminders, Check-in  [x]
Re-read: SPEC **DECISIONS** (voice section!), §8 (skip §8.2 except digit normalisation), §12, §22 · TEST-CASES §4

- [x] `src/voice/parser.ts` + tests for **every** row in TEST-CASES §4
- [x] `quick-entry` screen: text box with example placeholder · Parse → review list of drafts (each editable: type, amount, category, description, date; remove item) · missing amount / category clearly requested · **Confirm** saves all (source `quick` or `voice`) · nothing saved without Confirm
- [x] Reachable in ≤ 2 taps from Overview (e.g. Add → "Say or type it")
- [x] `src/voice/speech.ts`: try `npx expo install expo-speech-recognition` + config plugin. Expose `isAvailable()`. Mic button only rendered when available; explains permission before asking; transcript shown live; on error → falls back to text. 3-strike rule → BLOCKED, text entry ships alone.
- [x] Reminders: `expo-notifications`; Settings → Reminders (on/off, time, every day / weekdays); explain-before-permission screen; if denied, don't ask again (store flag; show "Enable in system settings"); content has **no amounts**; tap opens `check-in`; reschedule on app start (covers timezone change); guarded on web
- [x] Pure scheduling logic in `src/notifications/reminders.ts` with tests (everyday vs weekdays → which triggers; time parsing; disabled → cancel all)
- [x] `check-in` screen: today's expenses, income, count · quick Add · "Done for today" → `day_reviews` (works with zero spending, never creates fake transactions)

**Done when:**
- CHECKS pass; all TEST-CASES §4 rows pass
- Web: typing `Spent 500 on Uber and 200 on coffee` → 2 drafts → Confirm → both appear in Activity and Overview numbers change accordingly
- Web: typing `lunch` asks for an amount; typing `spent 300 on blah` asks for a category
- Mic hidden on web if unsupported (no dead button)
- "Needs phone test" list updated: notifications, mic, notification → check-in deep link

---

## Phase 5 — Activity search/filters & Insights  [x]
Re-read: SPEC **DECISIONS**, §11, §13, §21 · TEST-CASES §3 (comparison), §5

- [x] Activity: search by description (debounced ~250ms) · filters: type, category, date range (presets + custom), amount min/max · active-filter chips with clear · FlatList virtualization + pagination · daily totals respect filters · empty-result state
- [x] `src/domain/insights.ts` + tests for TEST-CASES §5 and the comparison rows of §3
- [x] Insights tab: period selector (this week, this month, last month, last 3 months, last 6 months, this year, custom) · MTD comparison card (with "compared to the same N days last month" label) · full-period comparison · averages (per day, per transaction, per week, monthly average over complete months) · biggest (top category, largest expense, most frequent category, most expensive day, biggest month-on-month change) · category change list · pattern sentences (only with enough data) · history chart
- [x] Every insight is tappable → Activity pre-filtered to the transactions behind it
- [x] Chart `accessibilityLabel` summarises the data in words

**Done when:**
- CHECKS pass; §5 tests pass
- With sample data (load 500+ transactions in a dev test or via sample data) Activity scrolls smoothly in web and the query uses LIMIT (show the SQL/repo call in the Log)
- Web check of Insights at 360/390/430 × light/dark; with an empty DB, Insights shows a friendly "not enough data" state, not zeros pretending to be insights

---

## Phase 6 — Polish, QA, Accessibility, Docs  [ ]
Re-read: SPEC **DECISIONS**, §3, §20, §21, §22, §23, §26 · AGENTS.md §5

- [ ] Visual audit of every screen (onboarding, overview, add, quick entry, activity, transaction detail, budget, insights, check-in, settings, categories, reminders) at 360/390/430 × light/dark; fix misalignment, uneven padding, overflow, tiny targets, bottom-tab overlap, keyboard overlap
- [ ] Every screen has an empty state and an error state (DB write failure shows a friendly message and keeps input)
- [ ] Accessibility: roles + labels on all tappables, 48dp targets, contrast ≥ 4.5:1, reduced-motion respected, large-font layout doesn't break (test with a larger `fontScale` in a component test if web can't simulate)
- [ ] Search code for hard-coded strings (all via `t()`), magic spacing numbers, and money maths outside `calc.ts`/`money.ts`; fix
- [ ] `npx expo-doctor` clean (or issues logged)
- [ ] `README.md`: what it is, how to run (`npx expo start`, Expo Go on Android), tests, folder map
- [ ] `docs/COSTS.md`: what's local, what uses network (nothing in v1), what would cost money in v2 (SPEC §19.3)
- [ ] `docs/PHONE-TEST.md`: a step-by-step checklist for the owner to test on a real Android phone in the morning (persistence after restart, notifications, mic via dev build, haptics, text scaling, safe areas)
- [ ] Walk SPEC §26 Definition of Done item by item; write honest status for each in the Morning summary

**Done when:** CHECKS pass, the audit list above is ticked, and the Morning summary is written.

---

## If everything is done before morning
Do **not** start v2 items. Instead: re-run all CHECKS, hunt for bugs (edge cases in TEST-CASES you might have missed, month rollover, empty states), add tests for untested branches, tidy code. Commit as `QA: <summary>`.

---

## Needs phone test (agent appends)
-

## Log
<!-- Agent appends one entry per phase (and per BLOCKED event):
### YYYY-MM-DD HH:MM — Phase N — done | blocked | partial
- Built: …
- CHECKS: typecheck ✔/✘ · lint ✔/✘ · tests N passed / N total · web export ✔/✘
- Visual check: what screens/sizes/themes were actually looked at
- Problems / BLOCKED: …
- Decisions logged: D-00x, …
-->

### 2026-11-13 00:58 — Phase 0 — done
- Built: Read AGENTS.md, SPEC.md, ARCHITECTURE.md, TEST-CASES.md, DECISIONS-LOG.md, PROGRESS.md in full; verified untouched baseline typecheck and lint (ESLint auto-configured via `npx expo lint`).
- CHECKS: typecheck ✔ · lint ✔ · tests N/A (Phase 1) · web export N/A (baseline verified by planner)
- Visual check: N/A in Phase 0
- Problems / BLOCKED: none
- Decisions logged: none

### 2026-11-13 01:14 — Phase 1 — done
- Built: Installed SDK 58 deps (`expo-sqlite`, `react-native-svg`, `@expo-google-fonts/inter`, `expo-crypto`, `@expo/vector-icons`, `zustand`, `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native`); pure domain layer (`types`, `money`, `dates`, `period`, `calc`, `validation`, `categories`); contrast-checked `src/theme/tokens.ts` + `ThemeProvider` (system/light/dark + reducedMotion); `src/i18n` (`t()`, `en.ts`, `bn.ts` stub); UI primitives (`Screen`, `AppText`, `Money`, `Card`, `Button`, `EmptyState`, `ErrorState`); `src/data` (`repo`, `migrations`, `sqliteRepo`, `memoryRepo`, `db` + `metro.config.js` WASM/COEP/COOP); root `_layout`, 5-tab layout + Add FAB + minimal `transaction/new`.
- CHECKS: typecheck ✔ · lint ✔ · tests 47 passed / 47 total (7 suites) · web export ✔
- Visual check: Web preview at 390×844 light & dark (`docs/screenshots/phase-1/overview-390-light.png`, `overview-390-dark.png`, `add-390-light.png`); caught and fixed bottom tab label clipping (`height: tabBarHeight` + `tabBarItemStyle`) and faux-bold fontWeight on Inter faces; 0 console errors/warnings (`expo-sqlite` WASM booted cleanly on web).
- Problems / BLOCKED: Playwright MCP server unavailable because Chrome binary is absent at Google Chrome's default path; verified via existing `playwright-core` + `ms-playwright/chromium-1254`.
- Decisions logged: D-001, D-002

### 2026-11-13 01:27 — Phase 2 — done
- Built: 6-step Onboarding flow (`src/app/onboarding/*`, `onboardingStore.ts`) + root onboarding gate in `_layout.tsx`; reusable UI components (`AmountPad`, `CategoryIcon`, `Chip`, `ConfirmModal`, `ListRow`, `SectionHeader`, `SegmentedControl`, `TransactionForm`); full `transaction/new.tsx` & `transaction/[id].tsx` (view/edit/soft-delete with confirm); paginated date-grouped Activity tab (`useTransactions.ts`, `groupTransactionsByDate` in `calc.ts`, `activity.tsx`); Settings tab (`useSettings.ts`, `settings.tsx` with locked currency when transactions exist, theme toggle, two-step Delete All confirmation, `__DEV__` ~154-item sample data loader/clearer in `sampleData.ts`); Categories management (`settings/categories.tsx`); RNTL tests (`TransactionForm.test.tsx`).
- CHECKS: typecheck ✔ · lint ✔ · tests 51 passed / 51 total (8 suites) · web export ✔
- Visual check: End-to-end Playwright Chromium check at 390×844 (`docs/screenshots/phase-2/`): fresh start → Onboarding 1–6 → Add expense + Add income → Activity daily totals → `page.reload()` persistence confirmed (`expo-sqlite` WASM persisted across reload!) → Edit → Delete → Currency lock + Dark mode Settings + Categories; caught & fixed web `AmountPad` `TextInput` flex `minWidth: 0` overflow and added bottom padding to tab labels; 0 console errors/warnings/page errors.
- Problems / BLOCKED: none
- Decisions logged: D-003

### 2026-11-13 01:36 — Phase 3 — done
- Built: Pure domain date/period/breakdown/allocation helpers (`dates.ts`, `period.ts`, `calc.ts`) and full Overview/Budget/Category strings (`en.ts`); reactive data-version hooks (`useDashboard.ts`, `useBudgets.ts`) triggering copy-forward via `ensureBudgetsForPeriod`; UI components (`BudgetStatusBadge`, `InfoModal`, `MetricCard`, `ProgressBar`, interactive SVG `SpendingChart`); full Overview dashboard (`index.tsx` exporting `OverviewContent`), Budget tab (`budget.tsx` with overall edit, per-category budgets add/edit/remove, unallocated summary, remaining days, previous periods), and Category detail drilldown (`category/[id].tsx`); unit tests in `calc.test.ts` + RNTL integration test `overview.test.tsx` (Scenario A fixture assertions + live `bumpDataVersion()` re-query).
- CHECKS: typecheck ✔ · lint ✔ · tests 53 passed / 53 total (9 suites) · web export ✔
- Visual check: Playwright Chromium verification across 360, 390, and 430px × light/dark with sample data (`docs/screenshots/phase-3/`), interactive Daily/Weekly/Monthly chart bar taps, metric ⓘ formula modal, category drilldown, per-category budget creation, and over-budget (`৳ 100`) test; fixed React Native Web `<Modal>` stale overlay issue on rapid open/close by conditionally mounting modals only when visible; 0 console errors/warnings/page errors.
- Problems / BLOCKED: none
- Decisions logged: D-004

### 2026-11-13 01:48 — Phase 4 — done
- Built: Local natural-language parser `src/voice/parser.ts` (Bangla digit normalization via `normalizeDigits`, number words `zero–nineteen` + tens + `hundred`/`thousand`/`k`/`lakh`/`lac`, English/Bangla currency words, multi-clause splitting, `yesterday`/`today`/ISO dates, income verbs, keyword map, explicit `needsAmount`/`needsCategory` without guessing) + tests covering every row in TEST-CASES §4 (`parser.test.ts`); `src/voice/speech.ts` (installed `expo-speech-recognition` + config plugin, guarded lazy native loader skipping Expo Go `StoreClient`, `isAvailable()`, explain-before-permission, live transcript + error fallback); `src/notifications/reminders.ts` (installed `expo-notifications` + plugin, pure trigger builder `buildReminderTriggerSpecs` + `parseReminderTime`, non-amount content, Android/iOS guarded scheduler, app-start rescheduling & tap → `/check-in` deep link in `_layout.tsx`) + unit tests (`reminders.test.ts`); `src/app/quick-entry.tsx` (1-tap from Overview + 2-tap via `+` → `Say or type it`); `src/app/check-in.tsx` + `summarizeDayActivity` in `calc.ts`; Settings → Reminders controls + explain modal + denied-permission system-settings notice in `settings.tsx`.
- CHECKS: typecheck ✔ · lint ✔ · tests 59 passed / 59 total (11 suites) · web export ✔
- Visual check: Playwright Chromium verification (`docs/screenshots/phase-4/`): 360dp Overview shortcut bar, zero-spend Daily check-in review (`Done for today` with 0 transactions), 2-tap FAB `+` → `Say or type it`, `hello` empty guidance, `lunch` → amount prompt, `spent 300 on blah` → category prompt, `Spent 500 on Uber and 200 on coffee` → 2 drafts → Confirm updates Overview (`৳ 39,300` remaining, `৳ 700` spent) & Activity & Check-in, Settings Reminders toggle/Weekdays/20:00 + Dark Quick Entry; fixed `check-in.tsx` header title wrapping beside Reviewed badge; 0 console errors/warnings/page errors.
- Problems / BLOCKED: none
- Decisions logged: D-005

### 2026-11-13 02:01 — Phase 5 — done
- Built: Pure Insights domain engine `src/domain/insights.ts` (`resolveInsightsWindow` with Monday week start + 7 presets, `computeMonthlyAverageOverCompleteMonths` excluding partial month, `computeCategoryMtdChanges`, gated `buildPatternSentences` requiring >=7 elapsed days and >=5 expenses in both comparison windows, `buildInsightsReport` with §5 tie-breakers) + tests (`src/domain/insights.test.ts`); `SpendingChart.tsx` interactive SVG `accessibilityRole="image"` & `accessibilityLabel`; Zustand Activity filter bridge (`src/state/activityFilterStore.ts`) + reactive `useInsights.ts`; upgraded Activity tab (`src/app/(tabs)/activity.tsx`) with 250ms debounced search bar outside `FlatList` to keep focus, `Filters` modal (type, category, date presets + custom, min/max amount), active filter chips, empty-filter state, and `LIMIT 30` keyset pagination (`src/data/sqliteRepo.ts` executes `SELECT * FROM transactions WHERE ... ORDER BY occurred_on DESC, created_at DESC, id DESC LIMIT ?` with `limit + 1`, verified over 550 seeded items in `src/data/memoryRepo.test.ts`); complete Insights tab (`src/app/(tabs)/insights.tsx`) + RNTL integration test (`src/state/insights.test.tsx`).
- CHECKS: typecheck ✔ · lint ✔ · tests 66 passed / 66 total (13 suites) · web export ✔
- Visual check: Playwright Chromium verification (`docs/screenshots/phase-5/`): empty DB → Insights `"Not enough data yet"` (no fake zeros); sample dataset → Activity `Load more` pagination, `Uber` search, Filters modal + chips, empty-filter clear, Insights across all 7 presets + 360/390/430dp × Light/Dark, `insight-top-category` drilldown to pre-filtered Activity, descriptive `<svg aria-label>`; added `titleNumberOfLines={3}` on `ListRow` so Spending pattern sentences wrap cleanly without truncation at 360dp; 0 console errors/warnings/page errors.
- Problems / BLOCKED: none
- Decisions logged: none

## Needs phone test
- Local notifications scheduling & firing at scheduled time (everyday vs weekdays, timezone change re-sync on app start, deny permission flow → "Enable in system settings")
- Microphone voice entry (`expo-speech-recognition` requires an Android/iOS development build; hidden automatically in Expo Go without crashing)
- Tapping a delivered daily reminder notification deep-links straight to `/check-in`

## Morning summary
<!-- Agent writes this at the very end:
- Phases completed / blocked
- What the owner should try first
- Definition of Done (SPEC §26) — status per line, honest
- Needs phone test
- Known bugs / rough edges
-->
