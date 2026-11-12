# ARCHITECTURE — target structure for v1

Follow this layout. If you must deviate, log why in `docs/DECISIONS-LOG.md`.

## 1. Layers (dependencies point downward only)

```
src/app/          routes (screens)        → may import ui, theme, i18n, state, (read-only) domain types
src/ui/           reusable components     → theme, i18n, domain/money (formatting only)
src/state/        hooks that load data    → data, domain
src/data/         SQLite + repositories   → domain types
src/domain/       PURE TS: money, periods, calc, insights, categories   → nothing (no React, no Expo)
src/voice/        parser.ts (pure) + speech.ts (native wrapper)
src/notifications/ reminder scheduling
src/theme/        tokens + theme provider
src/i18n/         t(), en.ts, bn.ts
```

**Rule:** `src/domain/**` and `src/voice/parser.ts` must not import React, React Native, or any Expo module. They are pure functions with 100% of their behaviour unit-tested.

## 2. Folder layout

```
src/
  app/                                  # Expo Router — ONLY route files here
    _layout.tsx                         # Providers: fonts, theme, DB init + migrations, onboarding gate
    onboarding/
      _layout.tsx
      index.tsx                         # Step 1 welcome
      preferences.tsx                   # Step 2 name, currency, month start day
      budget.tsx                        # Step 3 monthly budget (skippable)
      categories.tsx                    # Step 4 pick categories
      reminder.tsx                      # Step 5 reminder (explain before permission)
      done.tsx                          # Step 6
    (tabs)/
      _layout.tsx                       # 5 tabs + centre/FAB Add action
      index.tsx                         # Overview (dashboard)
      activity.tsx
      budget.tsx
      insights.tsx
      settings.tsx
    transaction/
      new.tsx                           # Add sheet (presentation: 'formSheet' or 'modal')
      [id].tsx                          # Edit / detail / delete
    quick-entry.tsx                     # Text + mic → parser → review → confirm
    check-in.tsx                        # Daily check-in (notification target)
    category/[id].tsx                   # Transactions for one category + period
    settings/
      categories.tsx
      reminders.tsx
  ui/
    AppText.tsx  Money.tsx  Card.tsx  Button.tsx  Chip.tsx  ProgressBar.tsx
    SegmentedControl.tsx  ListRow.tsx  SectionHeader.tsx  EmptyState.tsx
    ErrorState.tsx  AmountPad.tsx  Screen.tsx  CategoryIcon.tsx
    charts/BarChart.tsx  charts/CategoryBars.tsx
  theme/
    tokens.ts                           # colors (light/dark), spacing, radius, typography, motion
    ThemeProvider.tsx  useTheme.ts
  i18n/
    index.ts  en.ts  bn.ts
  domain/
    types.ts                            # Transaction, Category, Budget, Settings, Period ...
    money.ts       money.test.ts        # parse/format minor units
    dates.ts       dates.test.ts        # LocalDate helpers ('YYYY-MM-DD'), no Date-UTC traps
    period.ts      period.test.ts       # getPeriod, elapsed/remaining days
    calc.ts        calc.test.ts         # THE calculation service
    insights.ts    insights.test.ts
    categories.ts                       # default categories + keyword map for the parser
    validation.ts  validation.test.ts
  data/
    db.ts                               # open DB, run migrations (PRAGMA user_version)
    migrations.ts
    repo.ts                             # Repository interface
    sqliteRepo.ts
    memoryRepo.ts  memoryRepo.test.ts   # same interface, used in tests (and web fallback if needed)
    sampleData.ts                       # __DEV__ only
  state/
    dataVersion.ts                      # bump after every write → hooks re-query
    useDashboard.ts useTransactions.ts useBudget.ts useInsights.ts useSettings.ts
  voice/
    parser.ts      parser.test.ts
    speech.ts                           # expo-speech-recognition wrapper + isAvailable()
  notifications/
    reminders.ts   reminders.test.ts    # pure "what to schedule" logic tested; native calls guarded
```

Tests are colocated as `*.test.ts(x)`. jest config must ignore `dist-check/` and `node_modules/`.

## 3. Database schema (expo-sqlite, migration v1)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,              -- uuid, or stable key for defaults e.g. 'food_dining'
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,                 -- @expo/vector-icons name
  kind        TEXT NOT NULL CHECK (kind IN ('expense','income')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_selected INTEGER NOT NULL DEFAULT 1,    -- shown as a quick chip
  archived_at INTEGER,                       -- archived, never hard-deleted
  created_at  INTEGER NOT NULL
);

CREATE TABLE transactions (
  id            TEXT PRIMARY KEY,            -- uuid generated when the add sheet OPENS (idempotency)
  type          TEXT NOT NULL CHECK (type IN ('expense','income')),
  amount_minor  INTEGER NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 99999999999),
  currency      TEXT NOT NULL,               -- 'BDT' | 'USD' | 'EUR'
  category_id   TEXT REFERENCES categories(id),
  description   TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  occurred_on   TEXT NOT NULL,               -- local date 'YYYY-MM-DD'
  occurred_time TEXT,                        -- local 'HH:mm', optional
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','quick','voice','sample')),
  created_at    INTEGER NOT NULL,            -- epoch ms
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER                      -- soft delete
);
CREATE INDEX idx_tx_date     ON transactions (deleted_at, occurred_on);
CREATE INDEX idx_tx_category ON transactions (category_id, occurred_on);

CREATE TABLE budgets (
  period_start TEXT NOT NULL,                -- 'YYYY-MM-DD' (start of the budget period)
  category_id  TEXT NOT NULL DEFAULT '',     -- '' = overall budget
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (period_start, category_id)
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                        -- JSON
);
-- keys: onboarding_done, name, currency, month_start_day, theme, reminder {enabled,time,days}, sample_data_loaded

CREATE TABLE day_reviews (
  day         TEXT PRIMARY KEY,              -- 'YYYY-MM-DD'
  reviewed_at INTEGER NOT NULL
);
```

- **All queries parameterized** (`?` placeholders). Never string-concatenate user input into SQL.
- Inserts: `INSERT OR IGNORE` on `transactions` (duplicate taps can't create duplicates).
- Reads for the dashboard query **only the current + previous period** (`WHERE deleted_at IS NULL AND occurred_on >= ? AND occurred_on < ?`). Activity list is paginated (`LIMIT/OFFSET` or keyset on `occurred_on, created_at`). Never load all history to show 10 rows.
- `deleteAllData()` drops rows in all tables and resets settings → app returns to onboarding.

## 4. Repository interface (sketch)

```ts
interface Repo {
  // transactions
  insertTransaction(t: NewTransaction): Promise<void>;          // INSERT OR IGNORE
  updateTransaction(id: string, patch: TransactionPatch): Promise<void>;
  softDeleteTransaction(id: string): Promise<void>;
  getTransaction(id: string): Promise<Transaction | null>;
  listTransactionsInRange(fromIncl: LocalDate, toExcl: LocalDate): Promise<Transaction[]>;
  searchTransactions(q: TxQuery, page: { limit: number; cursor?: string }): Promise<{ rows: Transaction[]; next?: string }>;
  // categories
  listCategories(opts?: { includeArchived?: boolean }): Promise<Category[]>;
  upsertCategory(c: Category): Promise<void>;
  archiveCategory(id: string): Promise<void>;
  // budgets
  getBudgets(periodStart: LocalDate): Promise<Budget[]>;
  setBudget(periodStart: LocalDate, categoryId: string /* '' = overall */, amountMinor: number): Promise<void>;
  ensureBudgetsForPeriod(periodStart: LocalDate, previousPeriodStart: LocalDate): Promise<void>; // copy-forward once
  // settings & reviews
  getSettings(): Promise<Settings>;  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): Promise<void>;
  markDayReviewed(day: LocalDate): Promise<void>;  isDayReviewed(day: LocalDate): Promise<boolean>;
  deleteAllData(): Promise<void>;
}
```

## 5. Calculation service API (`src/domain/calc.ts`, pure)

```ts
type LocalDate = string; // 'YYYY-MM-DD'

getPeriod(today: LocalDate, monthStartDay: number): Period          // { start, endExcl, lengthDays }
previousPeriod(p: Period, monthStartDay: number): Period
elapsedDays(p: Period, today: LocalDate): number                   // start..today inclusive, clamped to [0, length]
remainingDays(p: Period, today: LocalDate): number                 // today..end inclusive, clamped

summarize(input: {
  transactions: Transaction[]; period: Period; today: LocalDate;
  overallBudgetMinor: number | null; currency: string;
}): {
  spentMinor: number; incomeMinor: number;
  remainingMinor: number | null; utilizationPct: number | null;   // pct is a display number, not money
  dailyAverageMinor: number; safeToSpendPerDayMinor: number | null;
  status: 'no_budget' | 'ok' | 'info' | 'attention' | 'reached' | 'over';
  expenseCount: number; averageTransactionMinor: number | null;
  largestExpense: Transaction | null; topCategoryId: string | null;
  ignoredOtherCurrencyCount: number;
}
spendByCategory(txs, period, currency): { categoryId: string; spentMinor: number; count: number }[]   // sorted desc
categoryBudgetStatus(txs, budgets, period, currency): {...}[]
dailySeries(txs, period, currency): { day: LocalDate; spentMinor: number }[]          // every day in period, zeros included
weeklySeries(...), monthlySeries(txs, months: Period[], currency)
compareMonthToDate(txs, today, monthStartDay, currency): { currentMinor; previousMinor; diffMinor; pctChange: number | null; daysCompared: number }
compareFullPeriods(txs, today, monthStartDay, currency): {...}
```

Every function filters out `deleted_at != null` and other-currency rows itself — callers can't forget.

## 6. Design tokens (starting values — tune visually, keep them tokens)

```ts
spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 }   // screen margin = xl (20)
radius:  { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 }                   // cards = xl (20)
touch:   { min: 48 }
motion:  { fast: 150, normal: 200, slow: 250 }
type (Inter): display 34/40 semibold (big money) · title 22/28 semibold · heading 17/22 semibold
              · body 15/22 regular · label 13/18 medium · caption 12/16 regular
light: bg #F6F7F5 · surface #FFFFFF · surfaceAlt #EEF3EF · text #1C2321 · textMuted #6B7570
       primary #1F6F54 · primarySoft #DDF0E6 (mint) · income #2E8B57 · expense #D2604F
       warning #C98A1B · danger #C0392B · border #E3E7E4
dark:  bg #0F1412 · surface #171D1B · surfaceAlt #1F2724 · text #ECF1EE · textMuted #9AA5A0
       primary #5CC49A · primarySoft #1F3A2F · income #6BCB94 · expense #F08A7A
       warning #E5B04A · danger #F07167 · border #2A332F
```
Check contrast (text vs surface ≥ 4.5:1) and adjust if a pair fails; log the change.

## 7. Navigation map

```
_layout (gate) ── onboarding_done? ──no──► onboarding/* ──► (tabs)
                                  └─yes─► (tabs): Overview | Activity | [ + Add ] | Budget | Insights ... Settings
Overview ─► transaction/new (sheet) · quick-entry · category/[id] · check-in · transaction/[id]
Activity ─► transaction/[id]
Notification tap ─► check-in
```
5 tabs per SPEC §4 (Overview, Activity, Budget, Insights, Settings) + an always-visible Add button (floating or centred). On Add, show two options inline: amount pad (default) and "Say/Type it" → quick-entry.
