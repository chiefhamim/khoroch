# Khoroch (v1.1.0)

A calm, offline-first personal budget & expense companion built with **Expo SDK 58**, **React Native 0.88**, **TypeScript 6**, **Expo Router**, **Lucide Icons**, and **expo-sqlite**.

Know where your money goes, log expenses or income in under 10 seconds (by tapping or typing/saying `"350 taka lunch"`), see your safe-to-spend-today pace aligned to your personal billing cycle, and explore period-to-period comparisons — with zero cloud tracking or recurring API fees.

- **Humans:** read [START-HERE.md](START-HERE.md) and walk [docs/PHONE-TEST.md](docs/PHONE-TEST.md) on your phone.
- **Coding agents:** read [AGENTS.md](AGENTS.md) first, then [docs/PROGRESS.md](docs/PROGRESS.md) and [docs/ui-overhaul/DESIGN.md](docs/ui-overhaul/DESIGN.md).

---

## Working from another PC (office)

1. Clone to a **short path** (Windows path limit breaks the native build otherwise): `git clone https://github.com/chiefhamim/lenden C:\dev\lenden`
2. Needs Node 26, Java 21, Android SDK (`adb`), Python 3 + `fonttools` (only to re-run `scripts/patch-taka-font.py`).
3. `npm install`, then `npm run typecheck` and `npm test`.
4. Build the **dev** app (never the owner's app for testing):
   ```powershell
   $env:CI="1"; $env:APP_VARIANT="dev"; npx expo prebuild -p android
   cd android; .\gradlew.bat assembleRelease --init-script ..\scripts\short-cxx-paths.gradle; cd ..
   adb -s <phone> install -r android\app\build\outputs\apk\release\app-release.apk
   ```
   `android/` is generated, never committed. Check `android\app\build.gradle` says `com.hamim.budgetapp.dev` before installing.
5. Package IDs stay `com.hamim.budgetapp` / `.dev` even though the app is now called **Khoroch**, so updates keep the owner's data. Signing uses Expo's template `debug.keystore`, which prebuild regenerates identically on any PC.
6. Latest state of the UI overhaul: `docs/overhaul-copilot/` (BRIEF, ROUND2, REPORT, NOTES, screenshots).

---

## Features in v1.1

- **Calm Home dashboard:** Hero **Left to spend** card with `On track` / `Watch` / `Over` pill, progress bar, `Safe today | Spent | Income` strip, no-budget inline CTA, new-cycle banner into Insights, inline `Day | Week | Month` bar chart, Top categories breakdown, Recent activity rows, and avatar `(H)` shortcut to Settings.
- **v2 Navigation shell:** Clean 5-slot bottom bar (`Home · Activity · [ + ] · Budget · Insights`) with a centered accent `+` button (`tap` → Add transaction, `long-press` → Quick Entry), while **Settings** and **Categories** live as pushed stack routes.
- **Fast Add, Edit & Quick Entry:**
  - Hero amount display (`tabular-nums`), pinned custom keypad that hides automatically while typing descriptions/notes, native Android calendar & clock dialogs (`DateField` / `TimeField` with `Add time` support), `4×2` category grid ordered by recency + frequency (never preselected) with `"All…"` sheet & inline `+ New category`, strict per-`(type, category)` suggestion chips, two-step Delete bottom sheet, and subtle confirmation toasts.
  - Local Quick Entry parser (`"350 taka lunch"`, `"২৫০ টাকা রিকশা"`, `"Spent 500 on Uber and 200 on coffee"`, `"50000 salary"`) producing editable draft cards before saving; mic capture auto-hides gracefully when native speech isn't present.
- **Activity search & Filters sheet:** Keyset-paginated `SectionList` grouped by local calendar date with sticky date + net headers (`+`/`−`), wrapped period chip (`All dates`, `Today`, `This week`, `This cycle`, `Last cycle`, `Custom`) + live `Spent · Income` line, debounced search, and multi-criteria Filters bottom sheet (Type, multi-select category tiles, date presets + two `DateField`s, min/max amount, Reset / Show N results).
- **Budgets:** Circular `ProgressRing` hero, `Edit` sheet with keypad, single `+ Add category budget` row, unallocated amount indicator, and collapsible **Past cycles** formatted via `formatCycleLabel` (e.g. `10 Oct – 9 Nov`).
- **Insights:** Period dropdown sheet (`This week`, `This cycle`, `Last cycle`, `3 cycles`, `6 cycles`, `This year`, `Custom`), plain-language comparison (`"You've spent ... so far"` with two scaled bars), Last complete cycle card (`10 Oct – 9 Nov vs 10 Sep – 9 Oct`), gated spending pattern observations, `2×2` Averages, Biggest + Changes lists, and multi-cycle SVG bar chart with 1-tap drilldown into pre-filtered Activity.
- **Settings, Categories & Daily Check-in:** Grouped Settings sections (`GENERAL`, `REMINDERS`, `DATA`, `ABOUT`), interactive 1–28 `DayOfMonthGrid` with live `Current cycle:` preview, 3 visual Appearance swatches (`System` / `Light` / `Dark`), custom reminder days (`days: number[]` with `Every day` / `Sun–Thu` presets & native clock dialog without lock-screen amounts), 3-column Lucide Category tile grid with 13 pastel colors × 24 icons (protecting `other` / `other_income` from archival), and `Today` Check-in review screen.
- **Privacy & Design:** 100% local SQLite storage with additive schema migrations (`v1` → `v2`), integer minor-unit math, WCAG AA light & dark palettes verified by unit tests, reduced-motion respect, haptics, and full accessibility labels/roles.

For items deferred to v2 (accounts/transfers, recurring transactions, CSV export, cloud Gemini AI proxy, encryption/app lock, full Bangla UI translation), see [docs/SPEC.md](docs/SPEC.md) (`DECISIONS` block) and [docs/COSTS.md](docs/COSTS.md).

---

## Running Locally

### Prerequisites
- Node.js + npm
- Android SDK + Java 21 (for standalone release APK builds) or **Expo Go** on Android

### Commands

```bash
npm install

# Start Metro bundler
npx expo start

# Run in Chrome web preview
npm run web

# Static analysis, types, and automated tests
npm run typecheck
npx expo lint
npm test

# Standalone signed-with-debug-key release APK (keeps user data via adb install -r)
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
```

---

## Folder Map

```text
khoroch/
├── src/
│   ├── app/                  # Expo Router screens
│   │   ├── (tabs)/           # 5-slot V2TabBar: index (Home), activity, budget, insights + [+]
│   │   ├── onboarding/       # 6-step first-run wizard (welcome, prefs, budget, categories, reminder, done)
│   │   ├── category/         # Period breakdown per category ([id].tsx)
│   │   ├── settings/         # Pushed Settings (index.tsx) & Categories 3-col grid (categories.tsx)
│   │   ├── transaction/      # Create (new.tsx) and edit/delete ([id].tsx) screens
│   │   ├── dev/              # __DEV__ v2 Component gallery (gallery.tsx)
│   │   ├── quick-entry.tsx   # Natural-language / voice draft parser & confirmation
│   │   ├── check-in.tsx      # Daily evening summary & review confirmation
│   │   └── _layout.tsx       # Root providers, onboarding gate, notification resync & deep-link
│   ├── data/                 # StorageRepository, SQLite repo + additive v2 migration, MemoryRepo, sampleData
│   ├── domain/               # Pure logic: money, dates, period/cycle labels, calc, insights, categories, validation
│   ├── i18n/                 # Typed translation keys (en.ts, structure ready for bn in v2)
│   ├── notifications/        # Weekly multi-day reminder scheduler & legacy reminder converter
│   ├── state/                # AppContext, Zustand stores, reactive dashboard/transaction hooks
│   ├── theme/                # v2 Design tokens (4pt grid, typography, light/dark WCAG AA palettes, categoryColors)
│   ├── ui/                   # v2 UI primitives (Surface, IconTile, Sheet, Keypad, DateField, TimeField, SpendingChart, etc.)
│   └── voice/                # Local bilingual-digit parser & guarded expo-speech-recognition wrapper
└── docs/
    ├── SPEC.md               # Product specification & authoritative DECISIONS
    ├── ARCHITECTURE.md       # System structure, DB schema, calc API
    ├── PROGRESS.md           # Checklist, verification log & v1.1 summary
    ├── DECISIONS-LOG.md      # Implementation choices (D-001 – D-007)
    ├── PHONE-TEST.md         # Android verification checklist (v1.1)
    └── ui-overhaul/          # v1.1 DESIGN.md, mockup.html, compare.html, before/ & after/ captures
```
