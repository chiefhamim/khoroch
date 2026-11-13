# SPEC — Premium Personal Budget & Finance Companion

> **Source of truth.** The `DECISIONS` block below was made by the project owner and **overrides anything that follows it**.
> Where the original spec says "React Native / Flutter", "Hydrogen", "secure backend proxy", "accounts", "encryption", etc., the DECISIONS block wins.
> The original spec (sections 2–27) is kept word-for-word below so no detail is lost. Section 1's role-play list was removed; it added nothing.

---

## DECISIONS (override everything below)

### v1.1 UI overhaul (added 2026-11-13, after v1.0 shipped)
`docs/ui-overhaul/DESIGN.md` is authoritative for all visuals, layout and the behaviour changes in its §4. It overrides: SPEC §3 (visual direction), §4 (navigation is now 4 tabs + centre Add, and Settings opens from the Home avatar), ARCHITECTURE §6 (tokens), D-002 (floating +), and D-005 (weekday reminders become per-day toggles). It adds the `rent_income` category, auto-filled time, no preselected category in Add, and cycle-aware period labels. Everything else below still applies (money rules, v1 scope, no cloud).

### Stack
- **Expo SDK 58 + TypeScript strict + Expo Router** (routes in `src/app/`). Already scaffolded. No Flutter, no bare React Native.
- **Database:** `expo-sqlite` (local, unencrypted in v1). Repository interface so a memory implementation can be used in tests and, if needed, on web.
- **Tests:** `jest-expo` + `@testing-library/react-native`. Pure domain logic is tested without any DB or UI.
- **Charts:** hand-built with `react-native-svg`. No heavy chart libraries (no Skia, no Victory).
- **Icons:** `@expo/vector-icons` (already bundled with Expo).
- **Font:** Inter via `@expo-google-fonts/inter`, with `fontVariant: ['tabular-nums']` on all amounts.
- **State:** SQLite is the source of truth. Small hooks re-query after writes (a `dataVersion` counter / store). `zustand` is allowed for UI/session state. No Redux.
- **Notifications:** `expo-notifications`, local scheduling only.
- **i18n:** all strings via `t()` from `src/i18n`; `en.ts` complete, `bn.ts` exists as a stub with the same keys (values may fall back to English).

### Money
- Amounts stored as **integer minor units** (`amount_minor`, poisha for BDT; cents for USD/EUR). Never floats.
- Input accepts up to 2 decimals. **Display:** whole units when the amount has no fractional part (`৳ 1,250`), otherwise 2 decimals (`৳ 1,250.50`). Thousands separators always. BDT uses Western 3-digit grouping in v1 (`৳ 250,000`, not lakh-style `৳ 2,50,000`). Put the grouping in one formatter function so it can be switched later.
- **One currency per install in v1.** Chosen in onboarding (default BDT ৳; also USD, EUR). Each transaction still stores its `currency`. Changing currency in Settings is **disabled once any transaction exists** (show a short explanation). Calc functions ignore transactions whose currency ≠ the active currency and report how many were ignored.
- Max single amount: 999,999,999.99 (reject above).

### Periods & formulas (exact rules)
- Budget period = month starting on `monthStartDay` (setting, **1–28**, default 1). Period = `[start, nextStart)`.
- **Dates are local calendar dates** stored as `YYYY-MM-DD` strings (`occurred_on`). Never bucket by UTC timestamps.
- **Elapsed days** = days from period start through **today inclusive**.
- **Remaining days** = days from **today inclusive** through period end. (Today counts as remaining. Elapsed + Remaining = period length + 1.)
- **Spent** = sum of non-deleted expense transactions in the period (all dates in the period, including future-dated ones).
- **Remaining budget** = budget − spent (may be negative; show it explicitly).
- **Utilization %** = spent / budget × 100. If budget is not set or is 0 → `null` (show "No budget set", never divide by zero).
- **Daily average** = spent up to and including today ÷ elapsed days. Rounded half-up to an integer minor unit.
- **Safe-to-spend per day** = max(remaining, 0) ÷ remaining days, **rounded down** (conservative). If over budget → 0 and over-budget state.
- **Average transaction** = gross expense sum ÷ number of expense transactions (refunds don't exist in v1).
- **Month comparison (MTD):** current period days 1..N (N = elapsed days) vs previous period days 1..min(N, previous period length). Full-month comparison = previous complete period vs the one before it.
- **Status thresholds** (configurable later, constants now): <70% ok, 70–85% info, 85–100% attention, =100% reached, >100% over.
- Deleted transactions (`deleted_at` not null) are excluded from everything.
- Income never reduces "spent". Budget ≠ wallet balance (say so in UI copy).

### Budgets
- Stored **per period** (`period_start`), overall + optional per-category. Changing this month's budget never edits past periods.
- When a new period starts and has no budget row, **copy the previous period's budgets** on first read (one time), so the user isn't asked every month.
- Category budgets do not have to add up to the overall budget; show "unallocated" amount if they don't.

### Voice / quick entry (v1 = NO cloud AI)
- v1 has **no Gemini / Hydrogen / any cloud AI and no backend**. Section 9 is v2.
- Build a **local rule-based parser** (`src/voice/parser.ts`, pure TS, fully unit-tested — see `docs/TEST-CASES.md`).
- Build a **Quick Entry** screen: a text box ("Type it like you'd say it: *350 taka lunch*") + mic button. Both feed the same parser → review list → user confirms → save. **Nothing is ever saved without confirmation.**
- Speech: use `expo-speech-recognition` **only if** it installs cleanly for SDK 58; it needs a development build, so in Expo Go / web it must detect unavailability and hide the mic (text entry still works). If it doesn't install cleanly in 3 attempts → BLOCKED, text entry ships alone.
- English parsing only. Normalize Bangla digits (০–৯ → 0–9) and "টাকা"/"tk"/"taka"/"৳" as currency words, but Bangla sentence parsing is v2.
- Missing amount → ask for it. Unknown category → ask user to pick. Never guess an amount.

### Other v1 choices
- **No payment accounts in v1.** Hide every account field mentioned in sections 6.6, 7.4, 7.6, 13.
- Categories: the 15 expense categories from section 5 + income categories **Salary, Business/Freelance, Gift received, Other income**. Categories are **archived, never hard-deleted**; archived ones keep showing on old transactions.
- **Duplicate prevention:** the add sheet generates the transaction `id` (UUID) when it opens; insert is `INSERT OR IGNORE`; Save is disabled while saving.
- **Dev sample data:** a "Load sample data" button in Settings **only when `__DEV__`**, clearly labelled, with "Clear sample data". Used for visual checks. Never in production builds, never auto-loaded.
- Reminders: one daily local reminder (default 21:00), on/off, time picker, every day or weekdays. Notification text **never contains amounts**. Tapping it opens the Daily Check-in screen.
- Theme: system / light / dark.
- Settings in v1: name, currency (locked once data exists), month start day, theme, reminders, categories (add/rename/icon/archive), delete all data (double confirm), about. Everything else in section 16 is v2 — do not show placeholder rows for it.

### NOT in v1 — do not build, do not stub, do not show in UI
Payment accounts & transfers · refunds · recurring transactions · import/export/backup/restore · encryption at rest / encrypted SQLite · biometric/PIN app lock · Bangla UI translation & Bangla voice parsing · cloud AI (Gemini/Hydrogen) & backend proxy · cloud sync · savings targets · custom budgeting periods beyond monthStartDay · budget rollover/carryover · production/EAS builds · e2e tests on device.

### Verification limits tonight
No Android SDK/emulator/phone on this PC. Visual checks happen in the **web build** at phone viewport sizes. Native-only features are guarded and listed for a phone test in the morning. See `AGENTS.md` §3.

### v1 scope map (section → status)
| § | Topic | v1 |
|---|---|---|
| 2 | Principles / architecture / offline | BUILD |
| 3 | Design direction, tokens, spacing, type, motion | BUILD |
| 4 | Navigation (5 tabs + Add) | BUILD |
| 5 | Onboarding | BUILD (no language step beyond showing "English"; no demo mode — dev sample data instead) |
| 6 | Dashboard | BUILD (no account info) |
| 7 | Add / edit transaction | BUILD (no account, no recurring) |
| 8 | Voice | PARTIAL — local parser + text Quick Entry + mic if available; 8.2 Bangla = v2 |
| 9 | Gemini / Hydrogen | **v2** |
| 10 | Budget | BUILD overall + category; 10.1 history view yes; rollover/savings v2 |
| 11 | Insights | BUILD |
| 12 | Reminders + check-in | BUILD |
| 13 | Activity / search | BUILD (no account filter) |
| 14 | Accounts | **v2** |
| 15 | Recurring | **v2** |
| 16 | Settings | PARTIAL (list above) |
| 17 | Calc engine | BUILD — highest priority; drop refunds/transfers/recurring tests (v2) but keep a test proving only `expense`/`income` types exist |
| 18 | Security | PARTIAL — parameterized queries, input validation, no secrets, no analytics, delete-all. Encryption/app lock v2 |
| 19 | Cost | BUILD (it's all local) — write `docs/COSTS.md` in Phase 6 |
| 20 | Accessibility / i18n | BUILD (English + bn stub) |
| 21 | Performance | BUILD |
| 22 | Error handling | BUILD for v1 features |
| 23 | UI QA | BUILD via web viewport checks |
| 24 | Automated tests | BUILD unit + component tests; device e2e v2 |
| 25 | Phases | **Replaced by `docs/PROGRESS.md`** |
| 26 | Definition of done | Applies to v1 items only |
| 27 | Final instructions | Applies (no subagents editing the same files at once) |

---
---

# ORIGINAL SPEC (sections 2–27, verbatim)

## 1. OBJECTIVE

Your assignment is to DESIGN, ENGINEER, TEST AND DELIVER a professional, production-quality personal budget and expense management mobile application.

This is not a UI prototype. This is not a collection of beautiful screens with non-functional buttons. This is not another generic expense tracker.

Build a genuinely usable personal financial companion that people can comfortably use every day.

The experience must be:

- Extremely intuitive.
- Visually polished and professionally designed.
- Fast and responsive.
- Voice-friendly.
- Privacy-conscious.
- Reliable when offline.
- Accurate in every financial calculation.
- Economical to operate.
- Easy to maintain and extend.

The application should feel like a premium application from a well-funded product company, despite being economical to develop and operate.

Do not sacrifice functionality for visual appearance or visual quality for technical simplicity.

**Primary product philosophy:**

"Understand your money without having to think about managing your money."

A user should be able to open the app, understand their financial situation within five seconds, and record an expense within approximately five to ten seconds.

Do not stop after creating a project plan. Inspect the environment, create the actual application, connect the functionality, run tests, inspect the rendered interface, identify problems, and fix them.

---

# 2. PROJECT PRINCIPLES AND TECHNICAL STRATEGY

## 2.1 Inspect the development environment first

Before making changes:

1. Inspect the existing repository and file structure.
2. Identify the existing framework, dependencies, development environment, build system and available integrations.
3. Identify any existing authentication, database, notification and API infrastructure.
4. Reuse stable existing infrastructure where appropriate.
5. Avoid replacing working components unnecessarily.
6. Document architectural decisions before major changes.

If starting from an empty project, use:

- React Native with Expo.
- TypeScript with strict type checking.
- Expo Router for navigation.
- SQLite for local-first persistent data.
- A maintained local notification solution.
- Native speech recognition where supported.
- Secure platform storage for sensitive keys.

If the environment requires another supported mobile framework, adapt appropriately.

The result must be a genuine installable mobile application, not simply a desktop website squeezed into a mobile viewport.

Prioritize Android, while maintaining compatibility with iOS wherever the chosen architecture supports it.

## 2.2 Architecture

Use a clean modular architecture.

Separate:

- Presentation layer.
- Navigation.
- Business logic.
- Financial calculation engine.
- Data persistence.
- Voice recognition.
- AI interpretation.
- Notification scheduling.
- Security and authentication.
- Settings and personalization.

Create reusable components instead of duplicating UI code.

Keep financial calculations independent of the presentation layer.

Use typed data models, proper validation, predictable state management and consistent error handling.

Never allow a UI component to independently calculate financial totals.

All financial calculations must use one authoritative calculation service.

## 2.3 Offline-first philosophy

The core application must work without an internet connection.

Users must be able to:

- Add expenses.
- Add income.
- Edit and delete transactions.
- View dashboards.
- Review monthly reports.
- Manage budgets.
- Search existing transactions.
- Access categories.
- View previous financial history.

Persist all changes locally.

Do not make basic expense tracking dependent on a server.

Cloud functionality, if implemented, must be optional and explicitly enabled.

---

# 3. PRODUCT IDENTITY AND DESIGN DIRECTION

Develop a premium, minimalist, modern financial application.

The visual direction should combine the clarity of a premium banking application with the approachability of a modern lifestyle productivity app.

Avoid the appearance of:

- Generic accounting software.
- Old-fashioned banking dashboards.
- Cryptocurrency trading platforms.
- Overcomplicated financial spreadsheets.
- Excessively colorful expense tracking applications.
- Generic AI-generated template dashboards.

## 3.1 Visual personality

The application should feel:

- Calm.
- Premium.
- Trustworthy.
- Friendly.
- Intelligent.
- Modern.
- Organized.
- Lightweight.

Use generous spacing, clear typography, refined surfaces, balanced proportions and deliberate visual hierarchy.

## 3.2 Color system

Build a comprehensive design token system.

Suggested palette:

Primary: Deep forest green / refined emerald.

Secondary: Soft mint.

Background: Very light neutral gray or warm off-white.

Surface: Clean white.

Primary text: Dark charcoal.

Secondary text: Muted gray.

Income: Subtle green.

Expenses: Refined coral or muted red.

Warnings: Warm amber.

Success: Green.

Dark mode: Deep charcoal with carefully balanced elevated surfaces.

Do not overuse green.

Do not rely exclusively on colors to distinguish income, expenses or financial conditions.

Provide semantic colors alongside icons, labels and text.

Support both light and dark themes, preferably with automatic system-theme detection.

## 3.3 Geometry and spacing

This is extremely important.

Use a consistent 4-point spacing foundation with an 8-point primary layout rhythm.

Suggested layout:

- Horizontal screen margins: 20–24 dp.
- Card internal padding: 16–20 dp.
- Small component gaps: 8 dp.
- Standard component gaps: 12–16 dp.
- Major section spacing: 24–32 dp.
- Section headings: consistent baseline alignment.
- Card corner radius: approximately 16–22 dp.
- Buttons: consistent heights and corner radii.
- Minimum touch targets: 44–48 dp.

Avoid arbitrary spacing values throughout the application.

Use a grid-based layout system.

Pay special attention to:

- Left and right alignment.
- Text baselines.
- Card widths.
- Internal component alignment.
- Consistent heading positions.
- Safe-area insets.
- Bottom navigation clearance.
- Keyboard overlap.
- Scroll behavior.

Every screen must be visually balanced.

Never allow charts, numbers, labels or cards to overflow their containers.

Avoid both excessive whitespace and cramped content.

## 3.4 Typography

Use a highly readable, modern typeface.

Use a deliberate hierarchy:

- Large financial figures.
- Clear screen headings.
- Medium-weight section titles.
- Comfortable body text.
- Small but readable secondary labels.

Tabular numerals should be used for financial amounts to prevent numbers from visually jumping or appearing misaligned.

Financial numbers must receive stronger visual emphasis than decorative icons.

Use responsive font sizing and support system accessibility text scaling.

## 3.5 Motion and interaction

Use subtle, purposeful animations.

Examples:

- Smooth dashboard number transitions.
- Small success feedback when a transaction is saved.
- Natural bottom-sheet presentation.
- Gentle chart animations.
- Lightweight navigation transitions.
- Button press feedback.
- Haptic feedback where appropriate.

Recommended animation duration: approximately 150–250 ms for ordinary interactions.

Respect reduced-motion accessibility settings.

Do not introduce animations that slow down basic workflows.

Avoid excessive blur, glassmorphism, gradients and decorative effects.

---

# 4. APPLICATION NAVIGATION

Build a simple bottom navigation system.

Suggested primary destinations:

1. Overview
2. Activity
3. Budget
4. Insights
5. Settings

Provide a prominent, easily accessible Add Transaction action.

The add action should be visually discoverable without overwhelming the navigation.

The navigation must remain consistent across the application.

Every screen must have an obvious navigation path back.

Avoid deeply nested navigation structures.

Use bottom sheets for lightweight operations and full screens for tasks that need more space.

---

# 5. ONBOARDING AND PERSONALIZATION

Create an onboarding process that feels effortless.

Do not ask users to fill out an unnecessarily long questionnaire.

Complete essential setup in approximately one to two minutes.

## Step 1: Welcome

Introduce the application with a concise explanation.

Possible headline:

"Your money. Your clarity."

Explain three benefits:

- Know where your money goes.
- Stay within your budget.
- Build better spending habits.

Provide a clear Continue button.

## Step 2: Personal preferences

Collect:

- Preferred name or nickname (optional).
- Preferred currency.
- Language.
- Regional date format.
- Month start day or budgeting cycle.

Default currency: BDT (৳).

Allow users to change it to USD, EUR or another supported currency.

Default timezone: Asia/Dhaka when appropriate, but allow the device timezone to be used or changed.

Support English initially and design the translation architecture to accommodate Bangla.

## Step 3: Monthly budget

Ask:

"How much do you want to spend this month?"

Allow the user to enter a total monthly spending budget.

Provide an option to skip.

Make it clear that a spending budget is not the same as a bank balance.

## Step 4: Spending categories

Provide suggested categories:

- Food & Dining.
- Groceries.
- Transportation.
- Shopping.
- Housing & Rent.
- Utilities.
- Health.
- Entertainment.
- Education.
- Travel.
- Subscriptions.
- Personal Care.
- Family.
- Gifts.
- Other.

Allow users to select their commonly used categories.

Allow category creation, renaming, deletion and icon customization later.

## Step 5: Reminder preference

Ask:

"Would you like a gentle daily reminder to log your spending?"

Let users choose a preferred time.

Default suggestion: 9:00 PM.

Do not request notification permission without explaining its purpose first.

## Step 6: Finish

Show a beautiful onboarding completion screen.

Immediately take users to a functioning dashboard.

Do not populate actual production accounts with fake financial data.

Provide an optional demo mode for users who want to explore the interface before recording real transactions.

---

# 6. THE MAIN DASHBOARD — THE MOST IMPORTANT SCREEN

The dashboard is the heart of this application.

Design it carefully.

The user must understand their financial situation almost instantly.

Do not overcrowd the first screen with every statistic available.

Use progressive disclosure: critical information first, deeper analysis below.

## 6.1 Greeting and date

At the top:

"Good evening, [Name]"

Show today's date.

Provide a compact notification or settings shortcut.

Use a friendly, restrained greeting.

## 6.2 Main budget card

This must be the primary visual element.

Display:

MONTHLY BUDGET

৳ 40,000

SPENT

৳ 16,450

REMAINING

৳ 23,550

Also show:

- Percentage of budget used.
- Progress visualization.
- Current budget period.
- Optional budget adjustment shortcut.

The remaining amount should be extremely easy to recognize.

The progress indicator should change appropriately depending on spending status.

Use calm colors when everything is on track.

Use warning colors only when there is a meaningful issue.

If spending exceeds the budget, make the negative remaining amount explicit instead of hiding it.

Include a clear distinction between available budget and actual account or wallet balance.

These are not the same thing.

## 6.3 Financial summary cards

Display carefully selected metrics:

**Average Daily Spending**

How much the user spends on an average calendar day in the selected period.

**Daily Safe-to-Spend**

How much of the remaining budget is available per remaining day.

**Income This Month**

Total recorded income.

**Expense This Month**

Total net recorded expenses.

Make all metric definitions discoverable.

Do not use confusing financial terminology.

## 6.4 Spending overview chart

Build a beautiful interactive chart.

Show spending over the month.

Allow users to switch between:

- Daily.
- Weekly.
- Monthly.

Provide clear tooltips.

Charts must display meaningful values and dates.

Avoid excessive gridlines and legends.

The chart must remain readable on small devices.

## 6.5 Spending by category

Build a category breakdown.

Examples:

Food: ৳ 6,500

Transportation: ৳ 2,800

Shopping: ৳ 4,200

Utilities: ৳ 1,950

Entertainment: ৳ 1,000

Use an attractive horizontal bar chart or compact donut chart.

The selected category should expose additional information.

Tapping a category should navigate to its transaction history.

## 6.6 Recent activity

Display the most recent transactions.

Each item should show:

- Category icon.
- Description.
- Date or time.
- Payment account where applicable.
- Amount.
- Income or expense distinction.

Provide a View All shortcut.

## 6.7 Financial highlights

Include a small section showing:

- Highest spending category.
- Largest individual expense.
- Number of transactions this month.
- Comparison with previous month.

Make insights feel useful rather than artificially intelligent.

Do not add every possible dashboard card simply because space is available.

---

# 7. ADD TRANSACTION — MAKE THIS EXCEPTIONALLY FAST

Adding an expense must be one of the most polished experiences in the entire application.

Create an elegant, mobile-native bottom sheet or dedicated entry screen.

Default transaction type: Expense.

Provide a clear switch between:

- Expense.
- Income.

## 7.1 Amount entry

The amount should be the visual focus.

Provide a large numeric input.

Use a dedicated numeric keypad where appropriate.

Handle decimal input according to currency rules.

Display the selected currency.

Do not allow invalid values.

## 7.2 Category selection

Display commonly used categories as attractive icon-based chips.

Allow horizontal scrolling or a compact categorized selector.

Avoid making the user open several menus before choosing a category.

## 7.3 Description

Optional description field.

Suggested examples:

- Lunch.
- Uber.
- Electricity bill.
- Groceries.
- Coffee.

Provide recent descriptions or suggestions where appropriate.

## 7.4 Additional details

Allow users to specify:

- Date.
- Time.
- Payment account.
- Category.
- Note.
- Recurring status.

Keep optional information collapsed or progressively accessible.

Do not make every field mandatory.

## 7.5 Save interaction

The Save button must be clearly visible.

After saving:

- Validate the transaction.
- Persist it successfully.
- Update all relevant dashboard figures.
- Update category totals.
- Update budget progress.
- Provide subtle confirmation.
- Close the entry interface.

If saving fails, preserve the entered information.

Prevent accidental duplicate submissions.

## 7.6 Transaction editing

Allow users to:

- Edit an amount.
- Change a category.
- Modify a date.
- Change a description.
- Change payment account.
- Delete a transaction.

Provide confirmation before destructive actions.

All changes must update relevant calculations immediately.

---

# 8. VOICE INPUT — A MAJOR PRODUCT FEATURE

Voice entry should feel natural, fast and reliable.

Make it possible for the user to record expenses without manually navigating multiple input fields.

Add a prominent microphone action in the transaction workflow.

Example:

User says:

"I spent 350 taka on lunch today."

The application should identify:

Amount: 350

Currency: BDT

Type: Expense

Category: Food & Dining

Description: Lunch

Date: Today

Another example:

"Paid 1200 taka for electricity."

Expected interpretation:

Amount: 1200

Type: Expense

Category: Utilities

Description: Electricity bill

Another example:

"I received 25 thousand taka salary."

Expected interpretation:

Amount: 25000

Type: Income

Category: Salary

Description: Monthly salary

Another example:

"Spent 500 on Uber and 200 on coffee."

The application should recognize two separate transactions and present them for review.

## 8.1 Voice workflow

1. User taps the microphone.
2. Explain microphone permission if not already granted.
3. Start voice recognition.
4. Show a clear recording state.
5. Show the recognized transcript.
6. Interpret the transcript.
7. Populate the transaction fields.
8. Display a preview.
9. Allow correction.
10. Require user confirmation before saving.

Never silently save an uncertain transaction.

Never silently guess an amount.

If the category is unclear, ask the user to select one.

If the voice engine fails, fall back to manual entry.

## 8.2 Language support

Support:

- English.
- Bangla.
- Banglish where the speech recognition engine supports it.

Handle Bangladeshi currency expressions such as:

- ২০০ টাকা.
- ৫০০ টাকার বাজার.
- ১২০০ টাকা বিদ্যুৎ বিল.
- Three hundred taka for lunch.

Normalize numbers correctly.

Avoid losing digits or confusing thousands, hundreds and decimal values.

## 8.3 Voice privacy

Prefer on-device speech recognition where available.

Do not upload raw recordings to an AI service by default.

If cloud-based transcription or interpretation is used, clearly disclose it and obtain consent.

Provide manual input as a complete alternative.

---

# 9. GEMINI / HYDROGEN INTELLIGENCE LAYER  — ⚠ v2, DO NOT BUILD IN v1

Use Google's Hydrogen model when it is genuinely available to the development environment or through an officially supported API.

Important:

Do not assume that an undocumented Hydrogen model identifier or API exists.

Before integration, inspect the available model catalogue and supported API capabilities.

Create a model-provider abstraction so the application can switch between available Gemini models without modifying the core application.

Use the most cost-effective supported Flash-tier model suitable for structured text interpretation.

The AI layer should initially have limited responsibilities:

1. Interpret natural-language expense descriptions.
2. Convert voice transcripts into structured transaction fields.
3. Normalize natural financial language.
4. Suggest an expense category when confidence is sufficiently high.
5. Identify ambiguity and request clarification.

Do NOT make the AI responsible for calculating balances, monthly totals, budgets or financial history.

Those calculations must remain deterministic and local.

## 9.1 Structured AI response

Require strict structured output.

Example:

```json
{
  "type": "expense",
  "amount": 350,
  "currency": "BDT",
  "category": "food_dining",
  "description": "Lunch",
  "date": "2026-11-13",
  "confidence": 0.97,
  "requires_confirmation": true
}
```

Validate every response against a strict application-side schema.

Reject invalid output.

Do not let AI output directly modify the financial database.

The user must confirm the parsed transaction.

## 9.2 Model efficiency

Use AI only when needed.

Do not send a model request for every button press.

Do not send the complete transaction history to the model.

Send only the minimum necessary transcript and context.

Do not use AI to generate ordinary dashboard statistics.

Use deterministic logic for charts, reports and comparisons.

Provide a fully functioning non-AI fallback.

---

# 10. BUDGET MANAGEMENT

Build a dedicated Budget section.

Users should be able to create:

- Monthly overall budgets.
- Category-specific budgets.
- Custom budgeting periods.
- Optional budget rollover.
- Savings targets as a separate feature.

Example:

Monthly Budget: ৳40,000

Food Budget: ৳10,000

Transport Budget: ৳5,000

Shopping Budget: ৳6,000

Utilities Budget: ৳4,000

Other Budget: ৳15,000

Show:

- Budget allocation.
- Amount spent.
- Amount remaining.
- Percentage consumed.
- Remaining days.
- Budget performance.

Make category budgets editable.

Warn users when approaching their limits.

Suggested thresholds:

70%: Informational.

85%: Attention.

100%: Budget reached.

Above 100%: Over budget.

These thresholds should be configurable.

Do not make warnings unnecessarily aggressive.

## 10.1 Budget flexibility

Support:

- Changing a monthly budget.
- Creating a new budget for the next month.
- Adjusting category limits.
- Handling incomplete budget allocations.
- Reviewing previous budgets.
- Optional carryover.

Do not automatically overwrite historical budgets when the user changes current settings.

Maintain historical accuracy.

---

# 11. MONTHLY COMPARISON AND INSIGHTS

Create a polished Insights section.

This is where the application becomes genuinely interesting.

## 11.1 Previous month comparison

Compare:

Current month spending against previous month spending.

Show:

- Current expenditure.
- Previous expenditure.
- Absolute difference.
- Percentage increase or decrease.
- Spending trend.
- Category-level changes.

For a fair in-progress comparison, compare the current month-to-date against the equivalent elapsed period in the previous month.

Offer a separate full-month comparison.

Never compare incomplete periods as though both periods were complete.

## 11.2 Average spending

Calculate and show:

- Average expenditure per calendar day.
- Average transaction amount.
- Average weekly expenditure.
- Monthly average over selected historical months.

Clearly label the date range and calculation basis.

## 11.3 Biggest spending

Show:

- Highest spending category.
- Largest individual expense.
- Most frequently used category.
- Most expensive day.
- Category with the largest month-on-month change.

Each insight should be interactive.

## 11.4 Spending patterns

Identify patterns from recorded data.

Examples:

"You spent 18% more on dining than last month."

"Transport is your second-largest spending category."

"Your average daily spending has decreased this week."

Only show insights supported by sufficient recorded data.

Never invent trends from missing information.

Do not imply that an observation is a prediction.

## 11.5 Financial history

Provide selectable periods:

- This week.
- This month.
- Last month.
- Last three months.
- Last six months.
- This year.
- Custom range.

Use attractive, easy-to-understand charts.

Allow users to drill down into the transactions behind every total.

---

# 12. DAILY REMINDERS AND SPENDING CHECK-IN

Daily spending reminders are a core feature.

Implement reliable local notifications.

The default reminder should be a gentle evening check-in.

Example:

"Time for your daily money check-in. Did you log today's spending?"

The notification should open the relevant app screen.

## 12.1 Reminder configuration

Allow users to:

- Enable or disable reminders.
- Select the preferred time.
- Select reminder frequency.
- Snooze reminders.
- Change reminder tone or wording.
- Choose weekdays or every day.

Schedule notifications locally.

Do not require a continuously running backend.

Respect timezone changes and reschedule notifications when appropriate.

Handle notification permissions correctly.

Do not repeatedly ask users for permission after rejection.

## 12.2 Daily check-in screen

Create a simple evening review experience.

Show:

Today's recorded expenses.

Today's income.

Number of transactions.

A quick Add Expense option.

A confirmation action:

"Done for today."

Allow the user to mark the day as reviewed even when spending is zero.

Do not create artificial transactions for days with no spending.

Never expose exact financial amounts in lock-screen notification content by default.

---

# 13. TRANSACTION HISTORY AND SEARCH

Build a dedicated Activity screen.

Requirements:

- Chronological transaction list.
- Group transactions by date.
- Daily totals.
- Search by description.
- Filter by category.
- Filter by income or expense.
- Filter by account.
- Filter by amount range.
- Select a date range.
- Edit and delete.
- View transaction details.

Provide a clean empty state.

Use pagination or efficient list virtualization for large histories.

Make scrolling smooth with hundreds or thousands of records.

Avoid recalculating the entire dashboard unnecessarily after every scroll.

---

# 14. ACCOUNTS AND PAYMENT METHODS — ⚠ v2, DO NOT BUILD IN v1

Provide lightweight payment account management.

Examples:

- Cash.
- Bank.
- Mobile banking.
- Credit card.
- Savings account.

Allow users to assign transactions to an account.

Make account selection optional for users who only want simple budget tracking.

Clearly distinguish:

1. Budget remaining.
2. Account balance.
3. Income.
4. Expenses.
5. Transfers between accounts.

Transfers must not be incorrectly counted as expenses or income.

Do not automatically assume a recorded expense represents a verified bank transaction.

This is a manually maintained personal ledger.

---

# 15. RECURRING TRANSACTIONS — ⚠ v2, DO NOT BUILD IN v1

Support optional recurring entries.

Examples:

- Monthly rent.
- Internet bill.
- Electricity.
- Subscriptions.
- Monthly salary.
- Weekly allowances.

Allow:

- Daily recurrence.
- Weekly recurrence.
- Monthly recurrence.
- Custom recurrence.
- Start and end dates.
- Reminder before due date.
- Pause and resume.

Do not silently create financial records unexpectedly.

Require explicit user configuration for automatic posting.

Provide a review or notification option before recurring transactions are recorded.

Ensure recurring entries are not duplicated when the application is offline or reopened.

---

# 16. SETTINGS AND PERSONALIZATION

Create a professionally organized settings section.

Include:

- Personal information.
- Currency.
- Language.
- Date format.
- First day of financial month.
- Theme preferences.
- Reminder preferences.
- Voice preferences.
- Biometric app lock.
- Privacy settings.
- Data export.
- Data import.
- Backup settings.
- Category management.
- Account management.
- About application.
- Privacy policy.
- Terms of service.
- Delete all personal data.

Allow customization without making settings complicated.

---

# 17. FINANCIAL CALCULATION ENGINE — ZERO TOLERANCE FOR INACCURACY

This is a critical engineering requirement.

All calculations must be deterministic, tested and centralized.

Never rely on floating-point arithmetic for financial values.

Store monetary amounts as integer minor currency units with appropriate currency metadata.

Use currency-aware decimal handling and display formatting.

## 17.1 Core formulas

Monthly expenditure:

Sum of expense transactions in the selected budget period, adjusted for any explicitly supported refunds.

Monthly income:

Sum of income transactions in the selected period.

Remaining budget:

Monthly budget minus net recorded expenses.

Budget utilization:

Net expenses divided by monthly budget, multiplied by 100.

Daily average:

Net recorded spending divided by elapsed calendar days in the budget period.

Daily safe-to-spend:

Remaining budget divided by remaining budget days.

Use clear rules for whether today's day counts as a remaining day. **(Decided: today counts — see DECISIONS.)**

Average transaction size:

Net or gross spending, according to a clearly documented definition, divided by the number of qualifying transactions.

Month comparison:

Current month-to-date compared against an equivalent elapsed period in the previous month.

Category expenditure:

Sum of transactions belonging to the selected category and period.

## 17.2 Data integrity

Exclude transfers from spending and income totals.

Do not include pending, deleted or draft transactions in financial summaries.

Prevent duplicate entries.

Handle deleted categories without destroying historical transaction information.

Handle edits to past transactions correctly.

Handle month boundaries, leap years and timezone changes.

Do not silently convert different currencies without a known exchange rate.

Handle refunds consistently.

Maintain accurate historical reporting when budgets change.

## 17.3 Calculation testing

Create unit tests for:

- Empty accounts.
- No spending.
- No income.
- Negative remaining budget.
- Zero budget.
- Refunds.
- Transfers.
- Category changes.
- Deleted transactions.
- Month changes.
- Leap years.
- Different currencies.
- Historical edits.
- Duplicate transactions.
- Recurring transactions.

Financial correctness takes priority over visual implementation speed.

---

# 18. SECURITY AND PRIVACY — NON-NEGOTIABLE

Financial information is sensitive.

Treat all user financial records as confidential personal data.

Implement security from the beginning instead of adding it at the end.

## 18.1 Data protection

- Use encrypted storage for sensitive local financial data.
- Prefer a properly supported encrypted SQLite implementation when available.
- Store encryption keys in Android Keystore or iOS Keychain through an appropriate secure-storage layer.
- Never store secrets or API keys in plain text.
- Never commit API keys to the repository.
- Never put a privileged Gemini API key inside the mobile application bundle.
- Use a secure backend proxy for any cloud AI integration requiring a private key.
- Use HTTPS for all network communications.
- Validate all inputs.
- Use parameterized database operations.
- Handle authorization correctly.

Do not invent custom cryptographic algorithms.

## 18.2 Application lock

Provide optional:

- Biometric authentication.
- Device authentication fallback.
- PIN-based app lock where appropriately implemented.
- Automatic locking after inactivity.

Do not build insecure authentication mechanisms simply for convenience.

## 18.3 Privacy

By default:

- Financial records stay on the user's device.
- No advertising SDKs.
- No selling or sharing of financial data.
- No unnecessary analytics.
- No uploading transaction history.
- No background financial profiling.
- No unnecessary account permissions.

AI features must disclose what data is transmitted.

Give the user a clear opt-in setting for cloud AI interpretation.

The user should be able to use the entire basic application without an AI subscription.

## 18.4 Data management

Support:

- Data export.
- Backup.
- Restore.
- Full deletion.
- Optional encrypted backup.

Warn users before permanently deleting data.

For cloud sync, if introduced:

- Use authenticated user-specific access.
- Enforce row-level security.
- Prevent cross-account access.
- Encrypt communications.
- Provide deletion and account recovery procedures.

Follow applicable OWASP mobile security practices.

---

# 19. COST AND RESOURCE OPTIMIZATION

Build this application to be affordable to develop, deploy and maintain.

The ideal core application should have almost no recurring infrastructure expenses.

## 19.1 Architecture costs

Prioritize:

- Local database.
- Local calculations.
- Local notifications.
- Local transaction management.
- Native speech recognition where possible.

Do not introduce an expensive backend merely to support basic expense logging.

Avoid paid APIs for features that can be handled locally.

## 19.2 AI costs

Use Hydrogen or the best supported economical Gemini Flash model for narrow interpretation tasks only.

Do not use a premium reasoning model for simple category classification.

Implement:

- Minimal prompts.
- Strict structured output.
- Small request payloads.
- Rate limiting.
- Request timeouts.
- Controlled retries.
- Graceful offline fallback.

Do not repeatedly call AI because a component re-rendered.

Never create an infinite AI retry loop.

## 19.3 Usage and infrastructure reporting

Document:

- Which features are entirely local.
- Which features use network access.
- Which features require an AI API.
- Which infrastructure is optional.
- Any third-party recurring cost.
- Estimated cost drivers.
- Which services have free and paid tiers.

Do not activate a paid service without explaining the dependency.

The application must remain useful even when AI or internet access is unavailable.

---

# 20. ACCESSIBILITY AND INTERNATIONALIZATION

Provide proper accessibility support.

Requirements:

- Screen-reader labels.
- TalkBack compatibility.
- VoiceOver compatibility where supported.
- Accessible contrast.
- Large touch targets.
- Dynamic type.
- Reduced motion.
- Keyboard navigation where appropriate.
- Meaningful chart descriptions.

Prepare all text through a localization system.

Provide English and a structure ready for Bangla translations.

Handle local number formatting.

Do not hardcode currency symbols into calculation logic.

Support appropriate pluralization and regional date formats.

---

# 21. PERFORMANCE AND MEMORY MANAGEMENT

The application must remain fast on ordinary mid-range Android devices.

Optimize:

- List virtualization.
- Database queries.
- Dashboard calculations.
- Chart rendering.
- Image and icon assets.
- Navigation transitions.
- State updates.
- Memory consumption.

Avoid:

- Unnecessary re-renders.
- Repeated database queries.
- Unnecessary network calls.
- Large packages for trivial features.
- Excessive animations.
- Memory leaks.
- Uncontrolled background processing.

The initial application should launch quickly.

Scrolling and ordinary interactions should feel smooth.

Do not load the entire transaction history into memory just to display the latest ten records.

Use appropriate database indexes.

---

# 22. ERROR HANDLING AND EDGE CASES

Design a complete error-handling system.

Consider:

- No internet.
- Microphone permission denied.
- Speech recognition unavailable.
- AI API unavailable.
- Invalid model output.
- Failed database write.
- Notification permission denied.
- Duplicate transaction submission.
- Insufficient storage.
- Failed backup.
- Invalid date.
- Unsupported currency.
- Extremely large values.
- Corrupt imported file.
- Missing category.
- App interrupted during transaction creation.
- Device timezone changed.
- User changes month start day.

Show helpful error messages.

Never expose stack traces or technical secrets to ordinary users.

Preserve user input whenever an operation fails.

Provide recovery options.

Do not display fabricated success messages.

---

# 23. UI QUALITY ASSURANCE

Do not consider the application finished because it compiles.

Inspect the actual rendered application on multiple mobile dimensions.

At minimum, inspect:

- Small Android phone.
- Standard Android phone.
- Large Android phone.
- Different text scaling settings.
- Light mode.
- Dark mode.

Take screenshots of:

1. Onboarding.
2. Main dashboard.
3. Add expense.
4. Voice entry.
5. Activity history.
6. Budget screen.
7. Insights.
8. Daily check-in.
9. Settings.
10. Empty states.
11. Error states.

Review each screenshot.

Look for:

- Misaligned text.
- Uneven padding.
- Inconsistent gaps.
- Awkward card widths.
- Overlapping elements.
- Tiny controls.
- Overflowing numbers.
- Broken chart legends.
- Excessive visual density.
- Unbalanced layouts.
- Incorrect safe-area spacing.
- Bottom navigation overlap.
- Keyboard overlap.

Fix every meaningful issue found.

Pay special attention to geometric consistency.

Do not use arbitrary width and height values that break when content changes.

Ensure the interface feels intentionally designed at every screen size.

---

# 24. AUTOMATED FUNCTIONALITY TESTING

Create comprehensive automated tests.

Use the testing framework appropriate for the chosen stack.

Test:

- Transaction creation.
- Transaction editing.
- Transaction deletion.
- Income recording.
- Expense recording.
- Category assignment.
- Budget creation.
- Budget updates.
- Daily average.
- Remaining budget.
- Monthly comparison.
- Category totals.
- Voice transcript parsing.
- Failed AI requests.
- Reminder scheduling.
- Reminder cancellation.
- Local database persistence.
- Data export.
- Data import.
- Offline operation.
- Theme changes.
- Authentication and app lock.

Create UI and end-to-end tests for important user journeys.

Use realistic fixtures.

Do not use sample data to disguise missing backend functionality.

Do not mark a test as passed without actually running it.

---

# 25. IMPLEMENTATION STRATEGY — ⚠ REPLACED BY docs/PROGRESS.md

(The original 7-phase plan is superseded by the phases in `docs/PROGRESS.md`, which follow the v1 scope above.)

---

# 26. DEFINITION OF DONE

The application is not finished until all of the following are true (v1 items only — v2 items are struck):

[ ] The application launches successfully.

[ ] The onboarding flow works.

[ ] The user can create an expense.

[ ] The user can create income.

[ ] The user can edit and delete transactions.

[ ] All financial calculations are correct.

[ ] Budget remaining updates immediately.

[ ] Category breakdowns are accurate.

[ ] Monthly comparisons use equivalent periods.

[ ] Dashboard cards show correct information.

[ ] Average spending is correct.

[ ] Largest transaction is correctly identified.

[ ] Voice entry works when supported.

[ ] Voice interpretation always requests confirmation before saving.

[ ] Daily reminders can be configured.

[ ] Notifications open the correct screen.

[ ] Activity history works.

[ ] Historical records persist after restarting the app.

[ ] The core application works offline.

~~[ ] Data export and import work.~~ (v2)

~~[ ] Sensitive data receives appropriate protection.~~ (v2 for encryption; v1 = no secrets, parameterized queries, no analytics)

[ ] Dark mode works.

[ ] UI is responsive across supported devices.

[ ] No important controls are non-functional.

[ ] No critical console errors remain.

[ ] Automated tests have actually been executed.

~~[ ] A production build can be generated.~~ (v2 — needs EAS/Android SDK)

---

# 27. FINAL WORKING INSTRUCTIONS

You are expected to operate as an autonomous senior development team.

Do not merely describe what needs to be implemented.

Implement it.

When encountering a technical limitation:

1. Identify the actual limitation.
2. Find an appropriate supported alternative.
3. Preserve as much intended functionality as possible.
4. Document anything that cannot be completed.
5. Never pretend that an unavailable integration works.

Use appropriate subagents if your environment supports them.

Separate work where useful:

- Architecture and database.
- UI and design system.
- Transactions and budget engine.
- Voice and AI integration.
- Security.
- Testing and quality assurance.

Avoid multiple agents modifying the same foundational files without coordination.

Maintain a shared architecture and clear integration ownership.

After implementation:

1. Run static analysis.
2. Run type checking.
3. Run unit tests.
4. Run integration tests.
5. Build the application.
6. Launch it.
7. Inspect screenshots.
8. Perform a complete functional audit.
9. Fix detected problems.
10. Repeat relevant tests.

Do not stop at the first successful build.

The goal is a product, not a demo.

## THE FINAL PRODUCT EXPERIENCE

Imagine someone opening the application at 9 PM.

They immediately see:

- How much they have spent.
- How much budget remains.
- Whether spending is higher or lower than last month.
- Their average daily spending.
- Their biggest spending category.

They tap the microphone.

They say:

"I spent 250 taka on dinner."

The app recognizes it, shows the transaction, the user confirms, and the dashboard updates.

No unnecessary navigation.

No complicated form.

No waiting for a server.

No confusing financial terminology.

No clutter.

Everything feels natural.

**Build something people will genuinely enjoy using every single day.**

Make it visually beautiful, financially accurate, secure, lightweight, dependable and exceptionally intuitive.

That is the quality bar.

---

## Owner's six priorities (from the original brief)

1. **Local-first, not AI-dependent.** The budget must not stop working because an API is down, credits ran out, or internet is off.
2. **Voice entry with confirmation.** Misreading ৳1,500 as ৳15,000 is a serious problem. Every voice/text-parsed transaction is reviewed before saving.
3. **Correct financial maths.** Last-month comparison must compare equivalent periods.
4. **Privacy.** No bank integrations, no unnecessary cloud storage in v1.
5. **Geometric discipline.** Visual hierarchy, consistent spacing, aligned numbers, restrained charts — not a pile of cards.
6. **No fake functionality.** Every button, chart, filter, reminder and setting must actually work.

**First release = five outstanding experiences:** Dashboard, Quick Expense Entry, Voice/Quick Entry, Budget Management, Monthly Insights. Get those right before anything else.
