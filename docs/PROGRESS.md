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

## Phase 1 — Foundation  [ ]
Re-read: SPEC **DECISIONS**, §2, §3, §4, §17, §20 · ARCHITECTURE (all) · TEST-CASES §1, §2, §3, §6

- [ ] Install with `npx expo install`: `expo-sqlite`, `react-native-svg`, `@expo-google-fonts/inter`, `expo-crypto` (UUIDs), `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native` (dev deps where appropriate). Optional: `zustand`.
- [ ] Jest configured (`preset: 'jest-expo'`), `"test": "jest --watchAll=false"` in package.json, ignores `dist-check/`
- [ ] `src/theme/tokens.ts` (light + dark exactly as ARCHITECTURE §6, contrast-checked), ThemeProvider with system/light/dark, Inter loaded
- [ ] `src/i18n` with `t()`, `en.ts`, `bn.ts` stub (same keys)
- [ ] UI primitives: `Screen` (safe area + 20dp margins), `AppText` (variants from tokens), `Money` (tabular nums, uses formatMoney), `Card`, `Button`, `EmptyState`
- [ ] `src/domain`: `types.ts`, `money.ts`, `dates.ts`, `period.ts`, `calc.ts`, `validation.ts`, `categories.ts` (defaults + keyword map)
- [ ] Tests for TEST-CASES §1, §2 (incl. the property test), §3 — all passing
- [ ] `src/data`: migrations (schema in ARCHITECTURE §3), `repo.ts` interface, `sqliteRepo.ts`, `memoryRepo.ts` + tests for TEST-CASES §6
- [ ] DB opens + migrates at startup in root `_layout.tsx`; on web, if expo-sqlite web can't work after 3 attempts, use memoryRepo on web only and log it in DECISIONS-LOG
- [ ] `(tabs)/_layout.tsx`: Overview, Activity, Budget, Insights, Settings + visible Add button; each tab shows a proper titled `EmptyState` (no fake numbers)
- [ ] Add button opens `transaction/new` (may show a minimal working form here; full sheet is Phase 2)

**Done when:**
- CHECKS pass; every TEST-CASES §1, §2, §3, §6 case exists as a test and passes
- Web preview (390×844) shows the 5 tabs + Add in light and dark mode without errors in the console
- Log lists test count and anything BLOCKED

---

## Phase 2 — Onboarding & Transactions  [ ]
Re-read: SPEC **DECISIONS**, §5, §7, §13 (list part only), §16, §22 · ARCHITECTURE §2, §3, §7

- [ ] Onboarding steps 1–6 (welcome · preferences: name, currency BDT/USD/EUR, month start day 1–28 · budget (skippable, copy explains budget ≠ balance) · categories pick · reminder choice (just store the preference now; scheduling is Phase 4) · done) → writes settings → `onboarding_done`
- [ ] Root gate: not onboarded → onboarding; onboarded → tabs
- [ ] Default categories seeded (15 expense + 4 income) with icons
- [ ] Add transaction sheet: Expense/Income switch (default Expense) · big amount with on-screen `AmountPad` · category chips (selected ones first, horizontal scroll) · description with recent suggestions · date (Today / Yesterday / pick date) · optional time + note collapsed under "More"
- [ ] Validation + friendly errors; input preserved on failure; id generated on open; Save disabled while saving; success feedback; sheet closes
- [ ] `transaction/[id]`: view, edit every field, delete with confirm (soft delete)
- [ ] Activity tab (basic): list grouped by date with daily totals, paginated (no "load everything"), tap → detail, empty state
- [ ] Settings: name · currency (locked with explanation once any transaction exists) · month start day · theme · categories screen (add, rename, change icon, archive) · delete all data (two-step confirm → back to onboarding) · about
- [ ] `__DEV__`-only "Load sample data" / "Clear sample data" in Settings (≈ 3 months, ~150 realistic BDT transactions, source='sample')
- [ ] Component tests (RNTL): add form double-tap saves once; invalid amount shows error and keeps input; delete asks for confirmation

**Done when:**
- CHECKS pass
- Web: fresh start → onboarding → add expense → add income → both in Activity with right totals → edit one → delete one → numbers update everywhere
- Persistence: on web reload data survives **if** web uses SQLite; if web uses memoryRepo, write "persistence across restart = Needs phone test" in the Morning summary (do not claim it)

---

## Phase 3 — Dashboard & Budget  [ ]
Re-read: SPEC **DECISIONS**, §6, §10, §17 · ARCHITECTURE §5, §6 · TEST-CASES §3

- [ ] Overview: greeting by time of day + name + date · **budget card** (budget, spent, remaining — remaining is the hero number; negative shown explicitly; % used; progress bar; status colour **+ icon + label**; period dates; "Edit budget" shortcut; one line "Budget is a spending plan, not your wallet balance")
- [ ] 4 metric cards: Average daily spending · Safe to spend per day · Income this month · Expense this month — each with an ⓘ that explains the formula in plain words
- [ ] Spending chart (react-native-svg): Daily / Weekly / Monthly switch, tap a bar → value + date tooltip, readable at 360dp
- [ ] Category breakdown (horizontal bars, top 5 + "Other"), tap → `category/[id]` list for that period
- [ ] Recent activity (latest 5) + "View all" → Activity
- [ ] Highlights: top category · largest expense · # transactions · vs same point last month (MTD rule)
- [ ] All numbers come from `calc.ts` via `state/useDashboard.ts` — no sums inside components
- [ ] Budget tab: overall budget edit · per-category budgets (add/edit/remove) · per-category spent/remaining/% + status · "unallocated" amount · remaining days · previous periods (read-only list) · copy-forward on new period
- [ ] Dashboard re-queries after any write (dataVersion) — adding an expense updates every number without restart

**Done when:**
- CHECKS pass
- A component test renders Overview with Scenario A fixture (TEST-CASES §3) and asserts the displayed strings: `৳ 23,550` remaining, `৳ 16,450` spent, `41%` (or `41.1%`, logged), `৳ 1,265.38` daily average, `৳ 1,308.33` safe per day
- Web check with sample data at 360, 390, 430 widths × light/dark: no overflow, no overlap, numbers aligned; over-budget state checked by setting a small budget

---

## Phase 4 — Quick Entry, Voice, Reminders, Check-in  [ ]
Re-read: SPEC **DECISIONS** (voice section!), §8 (skip §8.2 except digit normalisation), §12, §22 · TEST-CASES §4

- [ ] `src/voice/parser.ts` + tests for **every** row in TEST-CASES §4
- [ ] `quick-entry` screen: text box with example placeholder · Parse → review list of drafts (each editable: type, amount, category, description, date; remove item) · missing amount / category clearly requested · **Confirm** saves all (source `quick` or `voice`) · nothing saved without Confirm
- [ ] Reachable in ≤ 2 taps from Overview (e.g. Add → "Say or type it")
- [ ] `src/voice/speech.ts`: try `npx expo install expo-speech-recognition` + config plugin. Expose `isAvailable()`. Mic button only rendered when available; explains permission before asking; transcript shown live; on error → falls back to text. 3-strike rule → BLOCKED, text entry ships alone.
- [ ] Reminders: `expo-notifications`; Settings → Reminders (on/off, time, every day / weekdays); explain-before-permission screen; if denied, don't ask again (store flag; show "Enable in system settings"); content has **no amounts**; tap opens `check-in`; reschedule on app start (covers timezone change); guarded on web
- [ ] Pure scheduling logic in `src/notifications/reminders.ts` with tests (everyday vs weekdays → which triggers; time parsing; disabled → cancel all)
- [ ] `check-in` screen: today's expenses, income, count · quick Add · "Done for today" → `day_reviews` (works with zero spending, never creates fake transactions)

**Done when:**
- CHECKS pass; all TEST-CASES §4 rows pass
- Web: typing `Spent 500 on Uber and 200 on coffee` → 2 drafts → Confirm → both appear in Activity and Overview numbers change accordingly
- Web: typing `lunch` asks for an amount; typing `spent 300 on blah` asks for a category
- Mic hidden on web if unsupported (no dead button)
- "Needs phone test" list updated: notifications, mic, notification → check-in deep link

---

## Phase 5 — Activity search/filters & Insights  [ ]
Re-read: SPEC **DECISIONS**, §11, §13, §21 · TEST-CASES §3 (comparison), §5

- [ ] Activity: search by description (debounced ~250ms) · filters: type, category, date range (presets + custom), amount min/max · active-filter chips with clear · FlatList virtualization + pagination · daily totals respect filters · empty-result state
- [ ] `src/domain/insights.ts` + tests for TEST-CASES §5 and the comparison rows of §3
- [ ] Insights tab: period selector (this week, this month, last month, last 3 months, last 6 months, this year, custom) · MTD comparison card (with "compared to the same N days last month" label) · full-period comparison · averages (per day, per transaction, per week, monthly average over complete months) · biggest (top category, largest expense, most frequent category, most expensive day, biggest month-on-month change) · category change list · pattern sentences (only with enough data) · history chart
- [ ] Every insight is tappable → Activity pre-filtered to the transactions behind it
- [ ] Chart `accessibilityLabel` summarises the data in words

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

## Morning summary
<!-- Agent writes this at the very end:
- Phases completed / blocked
- What the owner should try first
- Definition of Done (SPEC §26) — status per line, honest
- Needs phone test
- Known bugs / rough edges
-->
