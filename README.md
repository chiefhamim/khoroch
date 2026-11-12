# Budget App

A calm, offline-first personal budget & expense companion built with **Expo SDK 58**, **React Native 0.88**, **TypeScript 6**, **Expo Router**, and **expo-sqlite**.

Know where your money goes, log expenses or income in under 10 seconds (by tapping or typing/saying `"350 taka lunch"`), see your safe-to-spend-today limit, and explore month-to-date comparisons and spending insights — with zero cloud tracking or recurring API fees in v1.

- **Humans:** read [START-HERE.md](START-HERE.md) and walk [docs/PHONE-TEST.md](docs/PHONE-TEST.md) on your phone.
- **Coding agents:** read [AGENTS.md](AGENTS.md) first, then [docs/PROGRESS.md](docs/PROGRESS.md).

---

## Features in v1

- **Overview dashboard:** Remaining monthly budget, spent vs budget progress bar, today's safe-to-spend pace, quick 2×2 key metrics (Spent, Income, Daily avg, Largest expense with `ⓘ` formula popups), interactive SVG Daily/Weekly/Monthly spending chart, Top categories breakdown, Recent activity, and 1-tap shortcuts to Quick Entry and Daily Check-in.
- **Fast transaction logging & Quick Entry:** Manual keypad form (`+` FAB) and local Quick Entry parser (`"350 taka lunch"`, `"২৫০ টাকা রিকশা"`, `"Spent 500 on Uber and 200 on coffee"`, `"50000 salary"`). Always presents editable drafts for explicit confirmation before saving; never guesses missing amounts or categories. Microphone input appears automatically on development builds (`expo-speech-recognition`) and hides gracefully in Expo Go.
- **Activity search & filters:** Keyset-paginated (`LIMIT 30`) `FlatList` grouped by local calendar date with live daily totals, 250ms debounced description/note search, multi-criteria Filters modal (type, category, date range presets + custom dates, min/max amount), removable active-filter chips, and edit/soft-delete detail screen.
- **Budgets:** Monthly overall budget (`monthStartDay` 1–28), per-category budgets, unallocated summary badge, copy-forward when entering a new period, and category drill-down.
- **Insights:** 7 period presets (`This week`, `This month`, `Last month`, `3 months`, `6 months`, `This year`, `Custom`), equivalent-day MTD comparison, complete-months comparison, 4 spending averages, top/most-frequent/most-expensive cards, MTD category changes, gated spending pattern sentences (shown only once enough data exists), interactive monthly SVG history chart (`accessibilityLabel` narrative summary), and 1-tap drilldown from any insight to pre-filtered Activity.
- **Daily Check-in & Local Reminders:** Evening notification reminder (`expo-notifications`, everyday or weekdays, non-sensitive copy without amounts) deep-linking to `/check-in`, plus explicit zero-spend `"Done for today"` day review without fake transactions.
- **Privacy & Design:** 100% local SQLite storage with parameterized queries, integer minor-unit money math, WCAG AA light & dark palettes, reduced-motion respect, and full accessibility labels/roles.

For items intentionally deferred to v2 (accounts/transfers, recurring transactions, CSV export, cloud Gemini AI proxy, encryption/app lock, full Bangla UI translation), see [docs/SPEC.md](docs/SPEC.md) (`DECISIONS` block) and [docs/COSTS.md](docs/COSTS.md).

---

## Running Locally

### Prerequisites
- Node.js + npm
- **Expo Go** on Android (or an Android/iOS development build for native microphone speech recognition)

### Commands

```bash
npm install

# Start Metro bundler (scan the QR code with Expo Go on Android)
npx expo start

# Run in Chrome web preview
npm run web

# Static analysis, types, and automated tests
npm run typecheck
npx expo lint
npm test
```

If you edit files inside Android/iOS native modules or config plugins (`expo-notifications`, `expo-speech-recognition`), build a development client rather than Expo Go to exercise device mic capture.

---

## Folder Map

```text
budget-app/
├── src/
│   ├── app/                  # Expo Router screens
│   │   ├── (tabs)/           # Bottom tabs: overview (index), activity, budget, insights, settings
│   │   ├── onboarding/       # 6-step first-run wizard (welcome, prefs, budget, categories, reminder, done)
│   │   ├── category/         # Period breakdown per category ([id].tsx)
│   │   ├── settings/         # Category management & archive (categories.tsx)
│   │   ├── transaction/      # Create (new.tsx) and edit/delete ([id].tsx) screens
│   │   ├── quick-entry.tsx   # Natural-language / voice draft parser & confirmation
│   │   ├── check-in.tsx      # Daily evening summary & review confirmation
│   │   └── _layout.tsx       # Root providers, onboarding gate, notification resync & deep-link
│   ├── data/                 # StorageRepository interface, SQLite repo + migrations, MemoryRepo, sampleData
│   ├── domain/               # Pure business logic: money, dates, period, calc, insights, categories, validation
│   ├── i18n/                 # Typed translation keys (en.ts, structure ready for bn in v2)
│   ├── notifications/        # Local reminder trigger builder & guarded expo-notifications scheduler
│   ├── state/                # AppContext, Zustand filter/onboarding/dataVersion stores, reactive hooks
│   ├── theme/                # Design tokens (4pt grid, typography, light/dark WCAG AA palettes) & ThemeProvider
│   ├── ui/                   # Reusable accessible components (AmountPad, SpendingChart, Card, ListRow, etc.)
│   └── voice/                # Local bilingual-digit parser & guarded expo-speech-recognition wrapper
└── docs/
    ├── SPEC.md               # Product specification & authoritative v1 DECISIONS
    ├── ARCHITECTURE.md       # System structure, DB schema, calc API, design tokens
    ├── TEST-CASES.md         # Canonical fixtures for math & voice parsing
    ├── PROGRESS.md           # Implementation checklist, verification log & Morning summary
    ├── DECISIONS-LOG.md      # Implementation choices logged during the build
    ├── COSTS.md              # Local vs optional v2 cloud cost breakdown (SPEC §19.3)
    ├── PHONE-TEST.md         # Step-by-step Android device testing checklist
    └── screenshots/          # Web preview screenshots inspected across Phases 1–5
```
