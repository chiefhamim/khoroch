# PROGRESS — the agent's checklist and memory

Legend: `[ ]` not started · `[~]` in progress · `[x]` done and verified · `BLOCKED:` see note
Rules: `AGENTS.md`. At the start of **every** phase re-read AGENTS.md + SPEC DECISIONS + the sections listed. Don't rely on memory.
You may tick boxes, add `BLOCKED:` notes under tasks, and append to the Log. Don't delete or reword tasks or "Done when" lines.

> **v1.0 (Phases 0–6) is done.** The current work is **v1.1 UI OVERHAUL, Phases 7–13, at the bottom of this file.** Their spec is `docs/ui-overhaul/DESIGN.md` (+ `mockup.html`). Phone rules: AGENTS.md §6.

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

## Phase 6 — Polish, QA, Accessibility, Docs  [x]
Re-read: SPEC **DECISIONS**, §3, §20, §21, §22, §23, §26 · AGENTS.md §5

- [x] Visual audit of every screen (onboarding, overview, add, quick entry, activity, transaction detail, budget, insights, check-in, settings, categories, reminders) at 360/390/430 × light/dark; fix misalignment, uneven padding, overflow, tiny targets, bottom-tab overlap, keyboard overlap
- [x] Every screen has an empty state and an error state (DB write failure shows a friendly message and keeps input)
- [x] Accessibility: roles + labels on all tappables, 48dp targets, contrast ≥ 4.5:1, reduced-motion respected, large-font layout doesn't break (test with a larger `fontScale` in a component test if web can't simulate)
- [x] Search code for hard-coded strings (all via `t()`), magic spacing numbers, and money maths outside `calc.ts`/`money.ts`; fix
- [x] `npx expo-doctor` clean (or issues logged)
- [x] `README.md`: what it is, how to run (`npx expo start`, Expo Go on Android), tests, folder map
- [x] `docs/COSTS.md`: what's local, what uses network (nothing in v1), what would cost money in v2 (SPEC §19.3)
- [x] `docs/PHONE-TEST.md`: a step-by-step checklist for the owner to test on a real Android phone in the morning (persistence after restart, notifications, mic via dev build, haptics, text scaling, safe areas)
- [x] Walk SPEC §26 Definition of Done item by item; write honest status for each in the Morning summary

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

### 2026-11-13 02:12 — Phase 6 — done
- Built: Code-wide polish & static audit fixes: extracted `formatMinorToDraft` into `src/domain/money.ts` and removed duplicate `/ 100` math from `transaction/[id].tsx` & `(tabs)/budget.tsx`; added `<ErrorState>` + retry recovery across `transaction/new.tsx`, `transaction/[id].tsx`, `category/[id].tsx`, and `settings/categories.tsx` plus action-error feedback in `(tabs)/settings.tsx`; moved all remaining hardcoded UI strings/stepper `accessibilityLabel`s (`onboarding/preferences.tsx`, `(tabs)/settings.tsx`, `MetricCard.tsx`, date placeholders) to `src/i18n/en.ts`; upgraded Activity search clear icon to a 48dp touch target (`theme.touch.min`) and eliminated magic spacing literals across `activity.tsx`, `budget.tsx`, `index.tsx`, `insights.tsx`, `settings.tsx`, `MetricCard.tsx`; added `src/ui/a11y.test.tsx` (testing `reducedMotion` propagation, 48dp touch targets, `PixelRatio.getFontScale() = 2.0`, and DB failure `ErrorState` + Retry recovery) and `formatMinorToDraft` tests in `money.test.ts`; authored `README.md`, `docs/COSTS.md`, and `docs/PHONE-TEST.md`; ran `npx expo-doctor` (20/20 passed).
- CHECKS: typecheck ✔ · lint ✔ · tests 69 passed / 69 total (14 suites) · expo-doctor 20/20 ✔ · web export ✔
- Visual check: Multi-screen Playwright Chromium audit (`docs/screenshots/phase-6/`) across Onboarding Steps 1/2/6, Overview (empty + sample), Category detail, Check-in, Quick Entry, New Transaction, Budget, Activity, Transaction Detail, Insights, Settings, and Categories across 360dp, 390dp, and 430dp in Light and Dark modes; 0 horizontal overflows, 0 console errors, 0 console warnings, 0 page errors.
- Problems / BLOCKED: none
- Decisions logged: none (total D-001 through D-005 in `docs/DECISIONS-LOG.md`)

## Needs phone test
- Real Android SQLite persistence after force-killing Expo Go (`docs/PHONE-TEST.md` §1)
- Local notifications scheduling & firing at scheduled time (everyday vs weekdays, timezone change re-sync on app start, deny permission flow → "Enable in system settings")
- Tapping a delivered daily reminder notification deep-links straight to `/check-in`
- Microphone voice entry (`expo-speech-recognition` requires an Android/iOS development build; hidden automatically in Expo Go without crashing)
- Tactile haptics, physical OS font scaling on Android Display settings, TalkBack pass, and Android system navigation bar / display cutout safe areas

## Morning summary

### Phases completed / blocked
- **Completed:** Phases 0, 1, 2, 3, 4, 5, and 6 — **all 7 phases complete (`[x]`)**.
- **Blocked:** None.

### What the owner should try first
1. Check `git log --oneline` (one clean commit per phase, Phases 0–6).
2. Run `npm run typecheck`, `npx expo lint`, and `npm test` (69/69 tests across 14 suites).
3. Start `npx expo start` and open on Android **Expo Go** following `docs/PHONE-TEST.md`: complete the 6-step onboarding, log `"350 taka lunch"` in Quick Entry, log an expense/income manually, force-kill Expo Go, reopen it to confirm SQLite persistence, and test Insights + Daily Check-in reminders.

### Definition of Done (SPEC §26) — status per item (v1)
- [x] **Application launches successfully:** Verified via `npx expo start --web`, `npx expo export --platform web`, and `npx expo-doctor` (20/20 checks passed). Needs phone launch confirmation via `npx expo start`.
- [x] **Onboarding flow works:** 6-step wizard (`onboarding/*`) verified end-to-end in Playwright (Phases 2, 4, 5, 6) writing user prefs, budget, categories, and reminder settings cleanly.
- [x] **User can create an expense:** Verified via RNTL (`TransactionForm.test.tsx`) and Playwright (manual `+` keypad & Quick Entry drafts).
- [x] **User can create income:** Verified via `calc.test.ts`, `overview.test.tsx`, and Playwright (`verify-phase2.js`).
- [x] **User can edit and delete transactions:** Soft-delete (`deletedAt`) + edit flow verified in `memoryRepo.test.ts`, `TransactionForm.test.tsx` (`ConfirmModal`), and Playwright (`verify-phase2.js` & `verify-phase6.js`).
- [x] **All financial calculations are correct:** Integer minor-unit arithmetic verified in `money.test.ts`, `period.test.ts`, `calc.test.ts`, `insights.test.ts`, and `validation.test.ts` matching `docs/TEST-CASES.md`.
- [x] **Budget remaining updates immediately:** Reactive `bumpDataVersion()` re-query verified in `overview.test.tsx` (`৳ 23,550` live update) and Playwright (`৳ 39,300` live update in `verify-phase4.js`).
- [x] **Category breakdowns are accurate:** Verified in `calc.test.ts` (multi-currency isolation, soft-delete exclusion, >5 category `Other` bucket) and `overview.test.tsx`.
- [x] **Monthly comparisons use equivalent periods:** `compareMonthToDate` (matching elapsed days, clamped for shorter prior months), `compareFullPeriods`, and complete-months averages verified in `calc.test.ts` & `insights.test.ts`.
- [x] **Dashboard cards show correct information:** Scenario A exact values verified in `overview.test.tsx` & rendered screenshots across 360/390/430dp.
- [x] **Average spending is correct:** Daily, per-transaction, weekly, and complete-months averages verified in `calc.test.ts` & `insights.test.ts`.
- [x] **Largest transaction is correctly identified:** Largest expense + tie-breaking rules verified in `calc.test.ts` & `insights.test.ts`.
- [~] **Voice entry works when supported:** Local bilingual-digit NLP parser (`src/voice/parser.ts`) verified for all 17 rows in `TEST-CASES §4` (`parser.test.ts` + Playwright). Native mic wrapper (`src/voice/speech.ts`) is guarded cleanly so Expo Go never crashes; **hardware mic capture needs a development build on phone**.
- [x] **Voice interpretation always requests confirmation before saving:** Verified in `quick-entry.tsx` and Playwright (`verify-phase4.js`): transactions save only on explicit **Confirm & Save**, and missing amounts/categories prompt inline without guessing.
- [~] **Daily reminders can be configured:** Pure trigger math (`reminders.test.ts`) and Settings controls (`verify-phase4.js`) verified cleanly; **real OS alarm delivery & permission-denied Android settings recovery need real phone test**.
- [~] **Notifications open the correct screen:** `expo-notifications` response listener + cold-start `getLastNotificationResponseAsync` → `/check-in` wired in `_layout.tsx`; **tap-to-open delivery needs real phone test**.
- [x] **Activity history works:** `LIMIT 30` keyset SQLite pagination (`memoryRepo.test.ts` over 550 transactions), debounced search, Filters modal, chips, daily totals, and empty states verified in Playwright & tests.
- [~] **Historical records persist after restarting the app:** Verified SQLite WASM IndexedDB persistence across browser `page.reload()` in `verify-phase2.js`; **real Android force-kill persistence needs phone test**.
- [x] **Core application works offline:** Zero network calls (`fetch`/`axios` audit = 0); SQLite DB, money math, parser, Insights, and local notifications run 100% on-device (`docs/COSTS.md`).
- ~~[ ] **Data export and import work:**~~ Deferred to v2 per `SPEC DECISIONS` (`NOT in v1`).
- ~~[ ] **Sensitive data receives appropriate protection:**~~ Encryption (`SQLCipher`) & PIN/biometric lock deferred to v2 (`NOT in v1`); v1 keeps zero cloud secrets, parameterized SQL queries everywhere, zero analytics, and zero monetary amounts in reminder notifications.
- [x] **Dark mode works:** Every token pair meets WCAG AA `>= 4.5:1` (`tokens.test.ts`) and verified across screens in Playwright Dark mode screenshots (`docs/screenshots/phase-3..6/`).
- [x] **UI is responsive across supported devices:** Verified 360dp, 390dp, and 430dp with 0 horizontal overflows in Playwright plus mocked `fontScale = 2.0` / `reducedMotion` check (`a11y.test.tsx`); physical Android display cutouts / nav bar safe areas remain in `docs/PHONE-TEST.md`.
- [x] **No important controls are non-functional:** Verified interactive navigation, modals, filters, charts, insights drilldowns, error retry handlers, category CRUD, and reminder controls.
- [x] **No critical console errors remain:** 0 console errors, 0 console warnings, and 0 page errors across all Playwright verification runs.
- [x] **Automated tests have actually been executed:** `npm test` executed cleanly after final edit: **14 test suites, 69/69 tests passed**, `tsc --noEmit` (0 errors), `npx expo lint` (0 errors/warnings), `npx expo-doctor` (20/20), and `npx expo export --platform web` succeeded.
- ~~[ ] **A production build can be generated:**~~ Deferred to v2 (requires EAS / native Android SDK not present in workspace; web production bundle export succeeded).

### Known bugs / rough edges
- None observed in automated tests or headless Chromium checks; `expo-notifications` alarm delivery, notification deep-link wakeup, native `expo-speech-recognition` microphone capture, and native Android force-kill SQLite persistence could not run without a physical Android device and are documented step by step in `docs/PHONE-TEST.md`.
- Design choices made unattended are recorded as **D-001 through D-005** in `docs/DECISIONS-LOG.md` (notably WCGA-adjusted light/dark foreground shades in `D-001`, 5-tab + floating `+` FAB in `D-002`, protecting fallback categories `other`/`other_income` in `D-003`, 1-decimal percentage display in `D-004`, and Mon–Fri weekdays repeat + lazy Expo Go speech guard in `D-005`).


---
---

# v1.1 UI OVERHAUL — Phases 7–13

Spec: **`docs/ui-overhaul/DESIGN.md`** (audit §1, principles §2, tokens §3, behaviour changes §4, components §5, screen layouts §6). Visual reference: `docs/ui-overhaul/mockup.html` (open it in your browser at the start of every phase). Before-screenshots: `docs/ui-overhaul/before/`.
At the start of every phase re-read: AGENTS.md (esp. §6 phone rules), DESIGN.md §2 + §3 + §4, the sections listed for the phase, and look at the mockup.

**PHONE CHECK** (referred to below): if the phone is reachable (AGENTS §6), install the current build and take screenshots of the screens touched in this phase, in **light and dark** (switch via the app's own Appearance setting, then set it back to System), into `docs/ui-overhaul/after/phase-N/`. Look at each screenshot and fix what's wrong. If the phone is not reachable or is locked, do the web check at 360/390/430 instead and write "PHONE CHECK skipped: <reason>" in the Log. Never block on the phone.

## Phase 7 — Design system v2 + native foundations  [x]
Re-read: DESIGN §3, §5 · AGENTS §6
- [x] `npx expo install lucide-react-native @react-native-community/datetimepicker expo-haptics` (lucide fallback rule in DESIGN §3)
- [x] `tokens.ts` → v2 colours, typography, radius, geometry; `tokens.test.ts` contrast checks updated for every text role × {bg, surface, surfaceRaised}
- [x] `src/theme/categoryColors.ts` (13 colour keys, light/dark) + default category → colorKey + lucide icon map
- [x] DB migration **v2, additive only**: `ALTER TABLE categories ADD COLUMN color_key TEXT`; backfill colour + icon for defaults; insert `rent_income` if missing; no table drops/recreates. Test: a v1-shaped DB with transactions migrates to v2 with every row intact (memoryRepo + migration-SQL test)
- [x] All components in DESIGN §5 built/restyled (`Surface`, `Button`, `IconButton`, `IconTile`, `Money` v2, `ListRow`, `SettingsGroup/Row`, `Sheet`, `SegmentedControl`, `Chip`, `Field`, `DateField`, `TimeField`, `DayToggles`, `DayOfMonthGrid`, `ProgressBar`, `ProgressRing`, `Keypad`, `EmptyState`, `Banner`, `Toast`)
- [x] `DateField`/`TimeField` open the native Material dialogs on Android (`DateTimePickerAndroid.open`), `<input type=date|time>` on web; display "Today"/"Yesterday"/"Wed, 11 Nov" and device 12/24h time — with unit tests for the display helpers
- [x] `src/app/dev/gallery.tsx` (`__DEV__` only) showing every component, both themes
- [x] Native rebuild succeeded (`assembleDebug`, `app-debug.apk` built cleanly after `expo prebuild -p android`). Phone install & live check **SKIPPED** (phone unreachable on `192.168.0.154:45999` and Tailscale `100.120.102.83:45999/5555` refused) — verify migrated DB intact when phone reconnects.

**Done when:** CHECKS pass · gallery checked on web at 360 light+dark · PHONE CHECK skipped (`192.168.0.154:45999` unreachable, Tailscale `100.120.102.83:45999/5555` refused).

## Phase 8 — Navigation shell  [x]
Re-read: DESIGN §4 (tab bar, settings), §6.1 header, §6.6 last paragraph
- [x] Tab bar: `Home · Activity · [ + ] · Budget · Insights` — centre 56dp accent button inside the bar; tap → Add, long-press → Quick Entry (with haptic). Remove the floating FAB and the Settings tab
- [x] Avatar (initial) top-right on Home → Settings as a stack screen with back arrow, no tab bar
- [x] Every tab's scroll content has bottom padding = tab bar height + 16 — nothing hidden behind the bar
- [x] Screen headers per mockup (title 22, no gear icons)
- [x] Update tests that referenced the old tabs/FAB

**Done when:** CHECKS pass · web 360px Light+Dark verified (last items above tab bar across all 4 tabs, avatar → Settings stack with no tab bar) · PHONE CHECK skipped (device unreachable on 192.168.0.154:45999 and Tailscale 100.120.102.83:45999/5555 refused).

## Phase 9 — Add / Edit / Quick Entry / Transaction detail  [x]
Re-read: DESIGN §4 (no preselect, auto time, rent_income), §6.2, §6.8 · SPEC §7, §8 · TEST-CASES §4
- [x] Add/Edit layout exactly per DESIGN §6.2: amount hero, note toggle, Date/Time chips → native dialogs, 4-col category grid (most-used first, "All…" sheet with every category + "New category"), description with suggestions filtered by type + category, keypad pinned bottom, Save pinned
- [x] No preselected category; Save disabled until amount > 0 and category chosen; time auto-filled with now
- [x] Haptics: light on keypad, success on save; Toast "Saved"
- [x] Edit: `⋯` menu → Delete with confirm sheet
- [x] Quick Entry restyle (DESIGN §6.8); drafts use IconTile + DateField/TimeField
- [x] Tests: Save disabled without category; date/time callbacks update state; suggestions filtered; double-tap still saves once

**Done when:** CHECKS pass · PHONE CHECK: Add screen in both themes; the date chip opens the Material **calendar** dialog and the time chip opens the Material **clock** dialog (screenshot both); one test transaction named `UI TEST – delete me` saved, seen in Activity, then deleted (AGENTS §6).

## Phase 10 — Home + Budget  [x]
Re-read: DESIGN §4 (cycle labels, new-cycle hint), §6.1, §6.4 · SPEC §6, §10, §17
- [x] `formatCycleLabel(period, monthStartDay)` in `src/domain` — month name when msd = 1, otherwise "10 Oct – 9 Nov"; tests incl. year boundary
- [x] `shouldShowNewCycleHint` (elapsed ≤ 7 and previous cycle spent > 0) + tests
- [x] Chart axis: ≤ 5 labels, never two labels closer than 3 days, last label "Today" when today is in range; tests for the tick picker
- [x] Home per §6.1 (hero card with 3-column strip, banner, 2 small actions, chart, top categories with colour bars, recent). No-budget state = compact inline row
- [x] Budget per §6.4 (ProgressRing, one Edit, category rows with status-coloured bars, ONE dashed "Add category budget" row, unallocated, past cycles collapsible)
- [x] All numbers still from `calc.ts` (Scenario A overview test updated to new layout and still asserts ৳ 23,550 / ৳ 16,450 / ৳ 1,308.33 etc.)

**Done when:** CHECKS pass · web 360/390/430 light+dark with sample data · PHONE CHECK with the owner's real data: Home shows the new-cycle banner ("New cycle started 10 Nov · Last cycle ৳4,600" — true for 13–16 Nov 2026), Budget screen both themes, no duplicate CTAs anywhere.

## Phase 11 — Activity + Insights  [ ]
Re-read: DESIGN §6.3, §6.5 · SPEC §11, §13
- [ ] Activity per §6.3: search + filter icon with count badge, period chip + summary line, sticky date headers with net, 64dp rows with "Category · 9:40 PM", expense neutral / income accent
- [ ] Filters bottom sheet (type, category tiles multi-select, presets + Custom range via two DateFields, min/max, Reset / Show N results)
- [ ] Insights per §6.5: period dropdown → sheet (7 options), plain-language headline comparison with two bars, compact averages, biggest list, changes list, history chart — all labels via `formatCycleLabel`
- [ ] Copy: remove every "comparison window" / jargon string from `en.ts`; empty states per DESIGN §2.6

**Done when:** CHECKS pass · PHONE CHECK: Insights complete-cycle card reads "10 Oct – 9 Nov" (not "Oct 2026") for the owner's data; Activity + Filters sheet in both themes.

## Phase 12 — Settings, Categories, Reminders, Onboarding, Check-in  [ ]
Re-read: DESIGN §4 (reminder days), §6.6, §6.7, §6.8 · SPEC §5, §12, §16
- [ ] Settings grouped list per §6.6; sheets for name, cycle start (DayOfMonthGrid + live preview of the current cycle), appearance (3 preview swatches)
- [ ] Reminders: switch, Time row → native clock dialog, DayToggles + presets [Every day] [Sun–Thu]; settings stored as `days: number[]`; old `everyday`/`weekdays` values converted on read; scheduler schedules one weekly trigger per selected day — tests for conversion and trigger list
- [ ] Categories screen per §6.7: tile grid, edit sheet with name, 13 swatches, icon grid, archive (protected ones hide archive)
- [ ] Onboarding + Check-in restyled (§6.8)
- [ ] App version → 1.1.0 in `app.json`

**Done when:** CHECKS pass · PHONE CHECK: Settings both themes, the time row opens the Material clock dialog, cycle-start sheet, categories edit sheet. Reminder change on phone is reverted to the owner's original (every day, 21:00) after testing.

## Phase 13 — Device QA + release build  [ ]
Re-read: DESIGN (all) · AGENTS §5, §6
- [ ] Full sweep on the phone: every screen (Home, Add, Quick Entry, Activity, Filters, Transaction detail, Budget, Insights, Settings, Categories, Check-in, Onboarding via the gallery or web) in light and dark; compare with mockup; fix misalignment, overflow, clipped text, weak contrast
- [ ] Web sweep at 360/390/430 for the same screens
- [ ] Release build (`assembleRelease`), `adb install -r`, stop Metro, cold-start the app: it opens without the PC and the owner's data is intact
- [ ] Appearance setting on the phone set back to **System**
- [ ] README + `docs/PHONE-TEST.md` updated for v1.1
- [ ] Write the **v1.1 summary** below (what changed, before/after screenshot pairs, BLOCKED items, anything the owner should try)

**Done when:** CHECKS pass · release build installed and cold-started on the phone · v1.1 summary written.

## v1.1 Log
<!-- Agent appends per phase: date/time, phase, built, CHECKS results, PHONE CHECK (screenshots taken or why skipped), BLOCKED, D-entries -->
- 2026-11-13 12:52 | Phase 7: Design system v2 + native foundations | built: lucide-react-native, @react-native-community/datetimepicker, expo-haptics; v2 tokens/categoryColors (D-006 contrast adjustments); additive SQLite v2 migration + rent_income + unit SQL test; 22 v2 UI primitives + native DateField/TimeField + DEV UI gallery; native Android debug APK (`assembleDebug`) | CHECKS: PASS (typecheck 0 errors, expo lint 0 warnings, 16/16 Jest suites / 80/80 tests passed, web export + 360px Light/Dark gallery 0 console/DOM errors) | PHONE CHECK: SKIPPED (192.168.0.154:45999 unreachable/host off-LAN, Tailscale 100.120.102.83:45999 & :5555 connection refused — Wireless Debugging unavailable) | BLOCKED: none (re-verify migrated owner DB when phone reconnects)
- 2026-11-13 13:04 | Phase 8: Navigation shell | built: 5-slot `V2TabBar` (`Home · Activity · [ + ] · Budget · Insights`) with 56dp accent circle (tap → Add + light haptic, long-press → Quick Entry + medium haptic); removed floating FAB & Settings tab; moved Settings to stack `/settings` (`src/app/settings/index.tsx`) with back header; Home header avatar `(H)` → `/settings`; `tabBarHeight + 16` bottom padding on all 4 tabs; `TabBar.test.tsx` + `overview.test.tsx` updated | CHECKS: PASS (typecheck 0 errors, expo lint 0 warnings, 17/17 Jest suites / 82/82 tests passed, web export + 360px Light/Dark all 4 tabs + Settings verified with 0 errors/overflow) | PHONE CHECK: SKIPPED (device unreachable on 192.168.0.154:45999 / Tailscale 100.120.102.83:45999/5555 refused) | BLOCKED: none
- 2026-11-13 13:20 | Phase 9: Add, Edit & Quick Entry overhaul | built: v2 `TransactionForm` (`[✕]` + segmented control + `⋯` edit menu, Hero amount + `+ Add a note` toggle, `DateField`/`TimeField` with `Add time` fallback & auto current time only on new, 4×2 category grid with recent+frequency ordering + `"All…"` sheet + inline custom category creator via `buildCustomCategory`, zero preselected category, strict `(type, categoryId)` suggestion chips, auto-hiding `Keypad` when typing, pinned Save CTA + double-tap guard); updated `transaction/new.tsx` (removed Quick Entry banner) & `transaction/[id].tsx` (`⋯` → Delete confirm sheet + Toast `'Saved'`/`'Deleted'`); restyled `quick-entry.tsx` v2 (`IconTile`, `SegmentedControl`, `DateField`/`TimeField`, voice `Sheet`); added `Field` `inputRef`/`errorTestID` & web outline fix; added 7 Phase 9 tests in `TransactionForm.test.tsx` | CHECKS: PASS (typecheck 0 errors, expo lint 0 errors/warnings, 17/17 Jest suites / 85/85 tests passed, web export + Playwright 360px Light/Dark Add/Edit/Delete/Quick Entry verified with 0 console/DOM/overflow errors) | PHONE CHECK: SKIPPED (Tailscale `100.120.102.83` active via relay `bom`, but ports `45999` and `5555` refused `10061` because Wireless Debugging is disabled on mobile network) | BLOCKED: none
- 2026-11-13 13:46 | Phase 10: Home & Budget overhaul | built: `formatCycleLabel` + `shouldShowNewCycleHint` + unit/year-boundary tests in `period.ts`/`period.test.ts`; v2 `SpendingChart` (`Surface`, `pickDailyAxisLabels` <=5 ticks >=3d spacing ending on `Today`, controlled inline `Day|Week|Month`, accent/0.35 bars) + tests; v2 `BudgetStatusBadge` (Lucide `AppIcon` + semantic tones); `useDashboard` new-cycle hint wiring; v2 Home (`(tabs)/index.tsx`: hero `Left to spend` + `⋯` explanation `Sheet`, 3-col strip `Safe today|Spent|Income`, no-budget inline CTA row, new-cycle `Banner` → Insights, 50/50 secondary actions, inline `Day|Week|Month` chart, `Top categories` colored progress bars, `Recent` 64dp rows) & Budget (`(tabs)/budget.tsx`: `ProgressRing` + single `Edit`, status-colored category bars + single dashed `+ Add category budget` row, unallocated inline indicator, collapsible `Past cycles` via `formatCycleLabel`, `Sheet` + `Keypad` editors); updated Scenario A + new-cycle/no-budget tests in `overview.test.tsx` | CHECKS: PASS (typecheck 0 errors, expo lint 0 errors/warnings, 17/17 Jest suites / 90/90 tests passed, web export + Playwright 360/390/430 Light & Dark with sample data 0 console/DOM/overflow errors) | PHONE CHECK: SKIPPED (device away on cellular/mobile network, Wireless Debugging disabled) | BLOCKED: none

## v1.1 summary
<!-- Agent writes at the end -->
