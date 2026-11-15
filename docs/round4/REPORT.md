# Khoroch (`খরচ`) — Round 4 Final Report

- **Repository:** `C:\Users\User\lenden`
- **Branch:** `ui-round3-daybook`
- **Round 4 Scope:** `aad22d9..HEAD` (21 page commits `0721527`..`8d80902` + this report & release dev walk)
- **Diff size through `8d80902`:** 469 files changed, 5,756 insertions(+), 1,237 deletions(-)
- **Test Phone:** Samsung Galaxy S25 Ultra (`SM_S938B`, ADB serial `R5CY23M7E6L`)
- **Dev Package Tested:** `com.hamim.budgetapp.dev` (`Khoroch Dev`, `versionName='1.1.0'`)
- **Live Package (`com.hamim.budgetapp`):** **Untouched** — held for Section 6 step 4 owner approval.
- **Screenshot Archive:** **417 PNGs** across 22 subfolders under `docs/round4/`, **0 `.xml` files** remaining.

---

## 1. Final Quality & Build Verification

Re-run cleanly after the last code edit (`8d80902`):

- **TypeScript (`npm run typecheck`):** PASS — `tsc --noEmit` exited `0` (0 errors).
- **Linter (`npx expo lint`):** PASS — exited `0` (0 errors, 0 warnings; resolved the pre-existing `src/app/wallets/[id].tsx:258` `exhaustive-deps` warning during Page 16).
- **Unit & Integration Tests (`npm test -- --no-color`):** PASS — **36 / 36 test suites passed, 188 / 188 tests passed, 0 skipped, 0 snapshots** (`12.903 s`).
  - Baseline entering Round 4 (`aad22d9`): 26 suites / 153 tests; Round 4 added 10 test files / 35 tests (`tokens.test.ts`, `components.test.tsx`, `FastTransactionEntry.test.tsx`, `TransactionForm.test.tsx`, `quick-entry.test.tsx`, `check-in.test.tsx`, `plan.test.tsx`, `insights.test.tsx`, `category-detail.test.tsx`, `people.test.tsx`, `person-detail.test.tsx`, `wallets.test.tsx`, `wallet-detail.test.tsx`, `settings.test.tsx`, `categories.test.tsx`).
- **Standalone Release Dev APK (`APP_VARIANT=dev`, zero Metro):**
  - Built via `.\gradlew.bat assembleRelease --init-script ..\scripts\short-cxx-paths.gradle` -> `BUILD SUCCESSFUL in 1m 8s` (`761 actionable tasks`).
  - Output APK: `C:\Users\User\lenden\android\app\build\outputs\apk\release\app-release.apk` (`120,467,425` bytes).
  - `aapt2 dump badging`: `package: name='com.hamim.budgetapp.dev' versionCode='1' versionName='1.1.0'`, `application-label:'Khoroch Dev'`.
  - Installed and walked on `R5CY23M7E6L` with port `8081` closed and `adb reverse --remove-all` active (`39` screenshots captured across all 19 screens in Dark EN and Light BN, plus `01-home-system-en.png`).
  - Restored dev app theme to **System** and language to **English** (`docs/round4/21-release-dev-walk/01-home-system-en.png`).

---

## 2. Page-by-Page Fixes & Before / After Screenshot Pairs

Detailed engineering notes for each item remain in [LOG.md](file:///C:/Users/User/lenden/docs/round4/LOG.md) and checklists in [PAGES.md](file:///C:/Users/User/lenden/docs/round4/PAGES.md).

| # | Commit | Folder (PNG count) | Key Issues Found & Fixed on Phone | Representative Before / Early -> After / Verified Screenshot Pairs |
| --- | --- | --- | --- | --- |
| **0a–0c** | `0721527` | `0a-0c/` (9) | Nested `KeyboardAwareScrollView` inside `KeyboardAvoidingView` clipped Sheet bodies above the keyboard on Android; added 3-layer elevation (`bg`/`surface`/`surfaceRaised`/`surfaceSunken`), `e1`–`e3` `boxShadow`s, Hind Siliguri tokens, `V2TabBar`, and `KeyboardAvoidingView` (`behavior="padding"`). | `initial-launch.png`, `sheet-keyboard-dark.png` -> `sheet-keyboard-dark-fixed.png`, `sheet-keyboard-light-fixed.png`, `gallery-light-top.png`, `gallery-dark-mid.png` |
| **1** | `fd1d59d` | `01-onboarding/` (30) | `reactCompiler: true` froze `t(...)` across live EN↔BN taps (`useLocale()` `useSyncExternalStore` added, compiler disabled); `Surface` inner clip fixed top corner bleed; `SettingsRow` subtitle expanded past 2 lines; Fabric last-word clipping resolved. | `step1-bn-dark.png`, `step1-check.png`, `step5-dark.png` -> `step1-bn-clean.png`, `step1-en-clean.png`, `step5-fixed.png`, `step6-keyboard.png`, `step7-dark.png` |
| **2** | `2370b4a` | `02-home/` (21) | SpendingChart zero-spend bars looked dashed (omitted `0`-height `<Rect>`); compact `SegmentedControl` & Hero `বাজেট প্ল্যান \| ওয়ালেট` / `BudgetStatusBadge` clipped on live theme/locale toggles (`bnMinWidth` + remount key); localized dues summary & `Recent` date prefixes; allowed optional `0` cash-out fee in `parseNonNegativeMoneyInput`. | `home-dark-en-1-top.png`, `home-dark-bn-2-mid.png` -> `home-dark-en-final.png`, `home-dark-bn-v2-1-top.png`, `home-light-bn-v2-1-top.png`, `home-light-bn-v2-wallets.png`, `home-chart-week.png`, `home-chart-bar-tap.png`, `home-privacy-hidden.png` |
| **3** | `a943d30` | `03-daybook/` (13) | Localized Day Book weekdays (`WEEKDAY_SHORT`/`MONTH_SHORT`); discriminated pre-opening wallet notes (`daybook.beforeOpeningNote`); centered timeline rails on single/last rows (`railSpacer`); added `trending-down` icon; systemic `AppText` `mapFontToBangla` (`600SemiBold` before `Bold` check) + `estimateSingleLineMinWidth`. | `daybook-dark-en-top.png`, `daybook-light-en-picker.png` -> `daybook-light-en-v2-top.png`, `daybook-light-en-v2-wed11.png`, `daybook-dark-bn-top.png`, `daybook-light-bn-top.png` |
| **4** | `1b5d0f2` | `04-all-entries/` (21) | Multi-word `Chip`s & section dates (`বুধ, 11 নভে`) wrapped/clipped trailing words in Bangla (`estimateSingleLineMinWidth`, `fontWeight` clearing on native Bangla `AppText`); localized period sheet & `DateField`; shared `filterVisibleTransfers` kept Filters CTA count exact. | `all-dark-en-filters-bot.png`, `all-dark-bn-v2-filters-top.png` -> `all-dark-en-v2-top.png`, `all-dark-en-v3-filtered.png`, `all-dark-bn-v3-top.png`, `all-light-bn-v3-top.png` |
| **5** | `597e202` | `05-add-entry/` (18) | Bottom keypad row (`. 0 ⌫`) pushed below fold (tightened heights while keeping `48dp` keys); `Received into` / `কোন ওয়ালেট থেকে` wrapped vertically; `All categories` 4-col split words (changed to 3-col); localized `DateTimeSheet`, Bangla `TextInput` fonts, Dark disabled calendar date contrast. | `add-dark-en-spent.png` (pre-commit tune) -> `add-dark-en-received.png`, `add-dark-en-allcats.png`, `add-dark-en-when-date.png`, `add-light-bn-spent.png`, `add-light-bn-whatfor-kb.png`, `add-dark-bn-saved-inline.png` |
| **6** | `21db37f` | `06-transaction-edit/` (12) | Moved `Delete` out of hidden More menu into sticky `bottomDock` (`Delete` + `Save`) visible with keyboard open; `bottomOffset={88}` kept focused fields clear; localized `TimeField`; allowed 2-line category tiles; `estimateBanglaCtaMinWidth` fixed `"মুছে ফেলুন"` clipping. | `tx-dark-en-main.png`, `tx-dark-en-kb.png` -> `tx-dark-en-note-kb.png`, `tx-dark-en-delete-confirm.png`, `tx-light-en-kb.png`, `tx-light-bn-kb.png`, `tx-dark-bn-kb.png`, `tx-dark-bn-delete-confirm.png` |
| **7** | `9602a1e` | `07-transfer-edit/` (12) | Replaced 1-item `[Transfer]` pill header with full-width `<AppText variant="headline">` (`"ট্রান্সফার এডিট"`); sunken pill border on fee input + `estimateSingleLineMinWidth` on `"চার্জ / ফি"`; expanded `estimateBanglaCtaMinWidth` to 16 weighted units for `"ট্রান্সফার সেভ করুন"`. | `tr-dark-en-main.png`, `tr-dark-en-fee-invalid.png` -> `tr-dark-en-fee-kb.png`, `tr-light-bn-main.png`, `tr-light-bn-fee-kb.png`, `tr-dark-bn-main.png`, `tr-dark-bn-delete-confirm.png` |
| **8** | `de5a196` | `08-quick-entry/` (17) | Wrapped body in `KeyboardAvoidingView` + pinned `bottomDock` so draft fields & `Confirm & save` sit above keyboard; prioritized selected category/wallet chips first; added 34 Bangla keywords & suffix/conjunction rules in `parser.ts`; raised CTA width cap to 18 units for `"নিশ্চিত ও সেভ করুন (2)"`. | `qe-dark-en-main.png`, `qe-dark-en-transfer-fee-invalid.png` -> `qe-dark-en-drafts.png`, `qe-dark-en-draft1-desc-kb.png`, `qe-light-bn-drafts.png`, `qe-dark-bn-drafts.png`, `qe-light-bn-speech-sheet.png` |
| **9** | `738f9e5` | `09-check-in/` (8) | Subscribed `useLocale()` & passed `locale` to `formatWeekdayShortDate`; caught & fixed Android Fabric shrink-wrap truncation in `EmptyState` (`alignSelf: 'stretch'`) and `Toast` (`"আজকের হিসাব মেলানো হয়েছে"`). | `checkin-dark-en-main.png` -> `checkin-dark-bn-main.png`, `checkin-dark-en-reviewed.png`, `checkin-light-bn-populated.png`, `checkin-light-bn-reviewed.png`, `checkin-light-bn-empty-reviewed.png` |
| **10** | `4540c86` | `10-plan/` (14) | Expanded `ProgressRing` (`164dp` -> `196dp`) so `৳27,380` stayed on 1 line; localized `formatCycleLabel` / `formatPeriodRange` (`"নভেম্বর"`); reused shared `estimateBanglaWeightedUnits` to fix `"ক্যাটাগরি বাজেট"` & `"+ ক্যাটাগরি বাজেট যোগ করুন"` clipping. | `plan-dark-en-top.png` -> `plan-dark-en-populated.png`, `plan-dark-en-past.png`, `plan-dark-en-sheet-error.png`, `plan-light-bn-populated.png`, `plan-light-bn-editcat-sheet.png`, `plan-dark-bn-populated.png` |
| **11** | `8183c0f` | `11-insights/` (13) | Fixed Fabric clipping on `"এই মাস"` & `"খাতায় হিসাবগুলো দেখুন"`; localized cycle ranges, chart `SvgText` X-axis ticks (`Jun`–`Nov` / BN), `"নতুন"` badge, calm `textSecondary` no-baseline note, and working empty-state Back button. | `insights-dark-en-top.png` -> `insights-light-bn-top.png`, `insights-light-bn-bottom.png`, `insights-light-bn-tooltip.png`, `insights-dark-bn-top.png`, `insights-dark-en-period-sheet.png` |
| **12** | `58262d3` | `12-category-detail/` (4) | Subscribed `useLocale()` for period range & row dates (`1 নভে – 30 নভে`); added `minWidth` on right `{count}টি খরচ` badge (`1টি খরচ` unclipped) + `router.canGoBack()` fallback. | `category-detail-dark-en.png` -> `category-detail-light-en.png`, `category-detail-light-bn.png`, `category-detail-dark-bn.png` |
| **13** | `f917416` | `13-people/` (10) | Localized `'আপনি পাবেন'`, `'১ জন'`/`'{count} জন'`, `formatFriendlyDate`, and `checkDueOverpayment`; fixed `DueEntrySheet` `kindPill` so all 4 direction pills stayed on 1 row without pushing `'পরিশোধ করেছি'` onto row 2. | `due-sheet-light-bn.png`, `due-sheet-light-bn-kbd.png` (recaptured after `kindPill` fix), `people-dark-en.png` -> `people-light-bn.png`, `people-dark-bn.png`, `due-sheet-dark-bn.png` |
| **14** | `43e4c00` | `14-person-detail/` (14) | Localized Remind card & `formatFriendlyDate(..., locale)`; stopped `'WhatsA / pp'` & `'Messen / ger'` mid-word wraps via `flexWrap` + `Button numberOfLines={1}`; expanded `PersonEditorSheet` honorific `SegmentedControl` to `size="md"`; wired Bangla input font, `errorTestID`, archive confirmation step, and `'নতুন এন্ট্রি'` `minWidth`. | `person-dark-en.png`, `editor-dark-en.png` -> `person-light-bn.png`, `person-dark-bn.png`, `editor-light-bn-kbd.png`, `options-confirm-light-bn.png`, `rakib-light-bn.png` |
| **15** | `d63150e` | `15-wallets/` (13) | Localized `ACCOUNT_KIND_OPTIONS`, sign toggle pills, `Ending {last4}`, card due suffixes, and `Tag-older` dates; balanced 2-column `Opening balance` + `As of date` row above full-width `signPill` and keypad; wrapped archive confirm actions cleanly. | `wallets-dark-en.png`, `wallet-edit-dark-en.png` -> `wallets-light-bn.png`, `wallets-dark-bn.png`, `wallet-edit-card-dark-en.png`, `wallet-edit-light-bn.png`, `wallet-new-light-bn.png`, `wallet-archive-confirm-light-bn.png` |
| **16** | `40a4ad7` | `16-wallet-detail/` (13) | Cleared the repo's last ESLint warning (`wallets/[id].tsx:258`); fixed `wallets.openingMeta` double separator (`'শুরুতে ৳ 4,200 · গতকাল'`), `'Before opening'`, due feed titles, privacy hiding on `openingMeta` + `WalletBalanceChart`, and `BalanceAdjustmentSheet` draft reset on close. | `detail-bkash-dark-en.png`, `detail-card-dark-en.png` -> `detail-bkash-light-bn.png`, `detail-bkash-dark-bn.png`, `detail-bkash-chart-tap-dark-en.png`, `detail-card-light-bn.png`, `detail-adjust-light-bn.png`, `detail-edit-light-bn-kbd.png` |
| **17** | `a11c398` | `17-settings/` (19) | Localized `DayToggles` (`র সো ম বু বৃ শু শ`), `formatOrdinal(day, locale)` (`'মাসের 1 তারিখ'`), currency full names, and `formatCycleLabel(..., locale)`; guarded appearance swatches & wrapped `sheetActions`; verified backup, cycle, privacy & delete-confirm keyboards. | `settings-top-dark-en.png`, `settings-cycle-light-en.png` -> `settings-top-light-bn.png`, `settings-top-dark-bn.png`, `settings-appearance-light-bn.png`, `settings-cycle-light-bn.png`, `settings-delete-dark-bn-kbd.png` |
| **18** | `8b2947d` | `18-categories/` (14) | Added `useLocale()`, locale-aware `localeCompare`, natural Bangla casing on Archived header, `minWidth: 0` bounds on preview & toggle labels, wrapping `confirmRow` archive buttons, `confirmArchive` close reset, and `category-name-error`. | `cat-expense-dark-en.png`, `cat-edit-groceries-dark-en.png` -> `cat-expense-light-bn.png`, `cat-expense-dark-bn.png`, `cat-add-dark-bn-kbd.png`, `cat-edit-light-bn-kbd.png`, `cat-archive-confirm-light-bn.png` |
| **19** | `f298cb2` | `19-sheets-toasts/` (27) | Responsive `useWindowDimensions()` `maxMessageRoom` in `ToastView` for action toasts; `minWidth: 0` on `Sheet` title; `flexWrap` + `minWidth: 110` on `PersonEditorSheet` & `DueEntrySheet` `actionsRow`; re-verified every sheet/toast with soft keyboard open (`mInputShown=true`). | `toast-settings-dark-en.png`, `sheet-due-newperson-dark-en-kbd.png` -> `toast-settings-light-bn.png`, `sheet-due-newperson-light-bn-kbd.png`, `sheet-person-editor-light-bn-kbd.png`, `sheet-wallet-editor-dark-bn-kbd.png`, `sheet-tx-delete-confirm-dark-bn.png` |
| **20** | `8d80902` | `20-final-walk/` (76) | Full 4-mode walk (`dark-en`, `light-en`, `light-bn`, `dark-bn` × 19 views) caught two subtle BN defects: (1) `styles.heroSubRow` shrink-wrapped text dropped `'ব্যবহৃত'` and `'দিন'` on Home (`index.tsx`); (2) `HindSiliguri_500Medium.ttf` lacked `'১'` (`U+09E7`) upper loop (`১ জন`, `১টি এন্ট্রি` -> promoted to `HindSiliguri_600SemiBold` in `AppText.tsx`). | `20-final-walk/01-home-dark-bn.png`, `02-home-wallets-light-bn.png`, `13-people-light-bn.png` -> recaptured in `20-final-walk/` & re-verified in `21-release-dev-walk/01-home-light-bn.png`, `02-home-wallets-light-bn.png`, `13-people-light-bn.png`, `19-dev-gallery-light-bn.png` |
| **Release Dev Walk** | (this commit) | `21-release-dev-walk/` (39) | Standalone `assembleRelease` build of `com.hamim.budgetapp.dev` walked end-to-end without Metro (all 19 views in `dark-en` + `light-bn`, plus `01-home-system-en.png` after restoring System theme). Notice: a transient OS Messenger toast appeared at the very top of `09-transfer-detail-dark-en.png` and `11-insights-light-bn.png`; the underlying Khoroch Dev UI stayed focused and unclipped (`09-transfer-detail-light-bn.png` & `11-insights-dark-en.png` show clean headers). | All 39 PNGs inspected (`01-home-dark-en.png`..`19-dev-gallery-dark-en.png`, `01-home-light-bn.png`..`19-dev-gallery-light-bn.png`, `01-home-system-en.png`) |

---

## 3. Cross-Screen Arithmetic & State Verification

### Phase A — Pages `02–19` Seeded Fixture State
Verified live on `R5CY23M7E6L` before adding an extra test transaction for the final walkthrough:
- **Transactions:** `Freelance project (+৳4,500 on bKash)`, `Mirpur CNG (−৳120)`, `Office lunch (−৳350)`, `Monthly bazar (−৳1,200)`, `Electricity bill (−৳950)`, transfer `bKash -> Cash (৳1,000)`.
- **Totals verified across Home, Day Book, All Entries, Plan, Insights & Wallets:**
  - Budget `৳30,000` − Spent `৳2,620` (`8.7%`) = **Remaining `৳27,380`**; Safe/day across 17 days (`27,380 / 17`) = **`৳1,610.58`**; Day Book start `৳16,200` + in `৳4,500` − out `৳470` (`+৳4,030`) = **`৳20,230`** across 3 wallets; People: `Tanvir +৳1,500`, `Rakib −৳800`.

### Phase B — Pages `20` & `21` Release Dev Walk State (`15 Nov 2026`, `16` days remaining)
Directly observed across `21-release-dev-walk/` (`01-home-*`, `02-home-wallets-*`, `06-ledger-daybook-*`, `07-ledger-all-*`, `10-plan-*`, `11-insights-*`, `12-category-detail-*`, `13-people-*`, `15-wallets-*`, `16-wallet-detail-*`):
- **All Entries (`07-ledger-all-light-bn.png`):**
  - Yesterday (`গতকাল` net `+৳1,740`): `Freelance project +৳4,500` (`bKash`) − `Bus Fare ৳10` (`Cash`) − `Office lunch ৳2,750` (`bKash`) = `+৳1,740`, plus `bKash -> Cash ৳1,000` transfer.
  - `বুধ, 11 নভে`: `Monthly bazar −৳1,200` (`bKash`).
  - `রবি, 8 নভে`: `Internet bill −৳2,000` (`bKash`).
  - Period expenses = `2,750 + 10 + 1,200 + 2,000 = ৳5,960`; income = `৳4,500` (exact match in `07-ledger-all-light-bn.png`: `খরচ ৳ 5,960 · আয় ৳ 4,500`).
- **Home & Plan Budget (`01-home-light-bn.png`, `02-home-wallets-light-bn.png`, `10-plan-light-bn.png`):**
  - `৳30,000 − ৳5,960 = ৳24,040` remaining (`5,960 / 30,000 = 19.866...%` -> **`19.9% ব্যবহৃত`** / `19.9% used`).
  - Safe to spend per day across `16` remaining days (`15 Nov – 30 Nov`): `24,040 / 16` = **`৳1,502.50`** (`আজ নিরাপদ ৳1,502.50`, `৳ 1,502.50 / দিন`, Plan `16 দিন বাকি · দৈনিক ৳ 1,502.50 নিরাপদ`).
- **Wallets & Day Book (`15-wallets-light-bn.png`, `16-wallet-detail-light-bn.png`, `06-ledger-daybook-light-bn.png`):**
  - `Cash ৳4,490` (Opening `৳3,500` + `bKash -> Cash ৳1,000` − `Bus Fare ৳10` = **`৳4,490`**) + `bKash ৳4,950` + `Card ৳8,500` = **`৳17,940`** (`3টি ওয়ালেট মিলে ৳17,940`, Day Book `দিন শুরু হয়েছিল ৳17,940` / `এখন হাতে আছে ৳17,940`).
- **Insights & Category Detail (`11-insights-light-bn.png`, `12-category-detail-light-bn.png`):**
  - MTD (`1 নভে – 30 নভে`): **`৳5,960`**, prior cycle same 15 days `৳0`.
  - Per day (`5,960 / 15` elapsed days): **`৳397`**; per week: **`৳2,781`**; per expense (`5,960 / 4`): **`৳1,490`**.
  - Top category & largest expense: `Food & Dining ৳2,750` (`1টি খরচ`, `Office lunch −৳2,750`).
- **People (`13-people-light-bn.png`, `14-person-detail-light-bn.png`):**
  - Receivable: `১ জন`, **`৳1,500`** (`Tanvir +৳1,500`); Payable: `১ জন`, **`৳800`** (`Rakib −৳800`).

---

## 4. Blocked Items & Intentional Deferrals / Not Done

### Blocked
- **None.** All code fixes, Metro & standalone dev builds, S25 Ultra UI walks across Dark/Light × EN/BN, tests, typecheck, and lint completed without blockers. (Two transient OS Messenger notification banners appeared over the status area in `21-release-dev-walk/09-transfer-detail-dark-en.png` and `11-insights-light-bn.png`; neither affected app responsiveness or layout, and clean header renders were also verified in `09-transfer-detail-light-bn.png`, `11-insights-dark-en.png`, and `20-final-walk/`.)

### Chosen Not To Do & Why
1. **Production release build & install (`com.hamim.budgetapp`) — Held for Owner Confirmation (Section 6 step 4):**
   - Per Phone Rules §1 and Section 6 step 4, the owner's live app `com.hamim.budgetapp` was never modified or overwritten without explicit `"yes"`. Building and installing with `APP_VARIANT` unset is ready to run immediately upon confirmation.
2. **Git push & PC shutdown — Held Until Owner Confirmation:**
   - Earlier user requests to push to GitHub and shut down the PC remain held until Section 6 step 4 (live production install) is confirmed or explicitly declined so nothing is pushed/shut down prematurely before the final release verification.
3. **Keeping existing `C:/b/` CMake build staging path in `scripts/short-cxx-paths.gradle`:**
   - Windows `MAX_PATH` causes native CMake `assembleRelease` builds to fail inside `android/app/.cxx` (`D-008`). Left `scripts/short-cxx-paths.gradle` pointing CMake `buildStagingDirectory` to `C:/b/<slug>` rather than altering tracked Android CMake config so the upcoming production `assembleRelease` step builds cleanly.
4. **Dev Gallery (`settings-open-gallery`) visible in `21-release-dev-walk`:**
   - Intentional behavior: `SettingsScreen` gates Dev Gallery on `isDevVariant()` (`APP_VARIANT === 'dev'`) rather than `__DEV__` so dev APKs retain QA access (`19-dev-gallery-*.png`), while `APP_VARIANT` unset (production `com.hamim.budgetapp`) strips it automatically.
5. **Pre-existing React `Money` / `TransactionForm` `act(...)` console warnings in Jest:**
   - Left pre-existing timer console logs in `overview.test.tsx` and `TransactionForm.test.tsx` untouched (all 36 suites pass cleanly; Round 4 passed `animate={false}` in `FastTransactionEntry` and avoided adding new console warnings across new tests).
