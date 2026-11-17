# DECISIONS-LOG — choices the agent made without asking

The owner is asleep. When something is unclear, choose the simplest option consistent with `docs/SPEC.md` (DECISIONS block first), write it here, and keep going. The owner will review this file in the morning.

Format:
```
## D-001 — <short title>  (Phase N, YYYY-MM-DD HH:MM)
- Question: what was unclear
- Options considered: A / B
- Chose: A, because …
- Easy to reverse? yes/no — how
```

---

## D-000 — Planner's setup notes  (before Phase 0, 2026-11-13)
- The project was created with `create-expo-app@latest` → **Expo SDK 58**, React Native 0.88, React 19.3, TypeScript 6, Expo Router with routes in `src/app/`.
- The template's demo code (components, hooks, constants, explore tab, demo images, `scripts/reset-project.js`) was deleted because its typecheck failed and the reset script is interactive. `src/app/_layout.tsx` + `src/app/index.tsx` are minimal placeholders. `npm run typecheck` passes.
- `app.json` → `web.output` changed from `server` to `single` (plain SPA for the web preview).
- Added `"typecheck": "tsc --noEmit"` to package.json scripts.
- The PC has no Android SDK/emulator → verification is typecheck + jest + Expo web preview. Native-only features are guarded and listed under "Needs phone test".

<!-- Agent: append D-001 onward below this line -->

## D-011 — Manrope and custom date/time entry  (UI overhaul, 2026-11-13 23:47)
- Question: Which professional font and date/time interaction should replace the existing Plus Jakarta Sans and native picker dialogs?
- Options considered: Keep Plus Jakarta Sans / use Manrope; keep native dialogs / build a shared in-app sheet.
- Chose: Manrope 400–700 for application text, Hind Siliguri 600 for the raised taka glyph, and a shared `DateTimeSheet` with recent dates, month grid, part-of-day chips, and exact time columns. This keeps the visual system consistent and avoids old Android wheel/clock dialogs.
- Easy to reverse? yes — font registrations and token family names are centralized in `src/app/_layout.tsx` and `src/theme/tokens.ts`; picker behavior is isolated in `src/ui/DateTimeSheet.tsx`.

## D-001 — Light & dark color contrast adjustments  (Phase 1, 2026-11-13 01:04)
- Question: Several starting tokens in `ARCHITECTURE.md` §6 failed WCAG AA 4.5:1 contrast against `surface`/`bg`/`surfaceAlt` (`light.textMuted` #6B7570 was 4.44 on bg / 4.25 on surfaceAlt; `light.income` #2E8B57 was 4.25 on surface; `light.expense` #D2604F was 3.80 on surface; `light.warning` #C98A1B was 2.94 on surface; `dark.danger` #F07167 was 4.26 on primarySoft; white text on dark `primary` #5CC49A was 2.14).
- Options considered: Keep exact hexes and violate ≥4.5:1 accessibility / Darken light foregrounds slightly while keeping exact hue & set `onPrimary`/`onDanger` to `#0F1412` in dark mode.
- Chose: Adjust failing foregrounds minimally so every text/semantic color meets ≥4.66:1 across `bg`, `surface`, and `surfaceAlt`:
  - `light.textMuted`: `#6B7570` → `#5E6863` (5.78 on surface, 5.37 on bg, 5.14 on surfaceAlt)
  - `light.income`: `#2E8B57` → `#1F7A4A` (5.33 on surface, 4.96 on bg, 4.75 on surfaceAlt)
  - `light.expense`: `#D2604F` → `#B94536` (5.29 on surface, 4.93 on bg, 4.71 on surfaceAlt)
  - `light.warning`: `#C98A1B` → `#966109` (5.24 on surface, 4.87 on bg, 4.66 on surfaceAlt)
  - `dark.danger`: `#F07167` → `#F28076` (6.62 on surface, 7.20 on bg, 5.91 on surfaceAlt)
  - Added `onPrimary` (`#FFFFFF` light / `#0F1412` dark) and `onDanger` (`#FFFFFF` light / `#0F1412` dark).
- Easy to reverse? yes — single object edit in `src/theme/tokens.ts`, guarded by `src/theme/tokens.test.ts`.

## D-002 — Always-visible Add button placement  (Phase 1, 2026-11-13 01:07)
- Question: Should the Add transaction button sit as a 6th tab slot in the bottom bar or as a floating action button above the bottom-right of the 5-tab bar?
- Options considered: 6-item bottom tab bar with center Add button / 5 equal tabs + floating Add button above bottom-right.
- Chose: 5 equal tabs + floating Add button above bottom-right (`min 56dp` touch target), because on 360dp narrow Android viewports and larger accessibility font scales, 5 equal tabs (72dp each) keep tab labels readable without wrapping or truncation while keeping Add 1 tap away from every primary tab.
- Easy to reverse? Yes — contained inside `src/app/(tabs)/_layout.tsx`.

## D-003 — Protect system fallback categories (`other`, `other_income`) from archiving  (Phase 2, 2026-11-13 01:27)
- Question: Should users be allowed to archive every category including the built-in `Other` (`other`) and `Other Income` (`other_income`) fallback categories?
- Options considered: Allow archiving any category (risking zero active categories for new entries or unassigned quick-entry fallbacks) / Keep `other` and `other_income` protected from archiving while letting all other built-in and custom categories be edited or archived.
- Chose: Protect `other` and `other_income` from archiving in `src/app/settings/categories.tsx`, while still letting them be renamed/re-iconed or toggled as quick chips.
- Easy to reverse? Yes — single `PROTECTED_CATEGORY_IDS` set in `src/app/settings/categories.tsx`.

## D-004 — Budget utilization percentage precision (`41.1%`)  (Phase 3, 2026-11-13 01:29)
- Question: Should budget utilization percentages display as rounded integers (`41%`) or with 1 decimal place when fractional (`41.1%`)?
- Options considered: Integer rounding (`41%`) / 1 decimal place rounded when non-integer (`41.1%`, omitting `.0` so `40%` stays `40%`).
- Chose: 1 decimal place rounded half-up when non-integer (`41.1%` for Scenario A `41.125%`, stripping `.0` for exact integers like `40%` and `100%`), because integer rounding can visually show `"70%"` at `69.6%` while status is still `'ok'`, creating threshold confusion.
- Easy to reverse? Yes — single `formatUtilizationPct` helper in `src/domain/calc.ts`.

## D-005 — Weekdays reminder definition & lazy speech module guard  (Phase 4, 2026-11-13 01:48)
- Question: Which days should `"Weekdays"` schedule for local check-in reminders, and how should `expo-speech-recognition` load so Expo Go doesn't crash when the native module isn't compiled in?
- Options considered: Monday–Friday (`[2..6]`) vs Sunday–Thursday (Bangladesh workweek) / Lazy `require` guarded by `ExecutionEnvironment.StoreClient` check vs static top-level import.
- Chose:
  1. Monday–Friday (`WEEKDAY_NUMBERS = [2, 3, 4, 5, 6]` in Expo Notifications convention where Sunday = 1) as standard `weekdays` repeat option alongside `everyday`.
  2. Lazy guarded `require('expo-speech-recognition')` inside `src/voice/speech.ts` skipping `StoreClient` (Expo Go), because static top-level import throws `Cannot find native module 'ExpoSpeechRecognition'` at bundle eval time in Expo Go even before `isAvailable()` is called.
- Easy to reverse? Yes — `WEEKDAY_NUMBERS` in `src/notifications/reminders.ts` and `loadSpeechModule()` in `src/voice/speech.ts`.

## D-006 — v2 palette WCAG AA contrast tuning  (Phase 7, 2026-11-13 12:31)
- Question: Several starting hexes in `docs/ui-overhaul/DESIGN.md` §3 fell below the 4.5:1 WCAG AA minimum when checked across `{bg, surface, surfaceRaised}` and `accentSoft` / `dangerSoft` (`light.accent` `#0C8A5F` was `4.00` on `#F5F5F7` and `3.86` on `#E4F5EE`; `light.textTertiary` `#8B8F97` was `2.98` on `bg` / `3.24` on `surface`; `light.danger` `#D92D20` was `4.44` on `bg`; `dark.textTertiary` `#71717A` was `3.48` on `#1D1D21`; white text on `dark.danger` `#F87171` was `2.77`).
- Options considered: Leave raw hexes below 4.5:1 / Adjust failing colors minimally along the same hue until every text role × `{bg, surface, surfaceRaised}` and badge/button pair meets ≥ 4.5:1.
- Chose: Minimal hue-preserving contrast tuning in `src/theme/tokens.ts`, plus `onDanger`:
  - `light.accent`: `#0C8A5F` → `#097A52` (`5.36` on `bg`/white, `4.75` on `accentSoft`)
  - `light.textTertiary`: `#8B8F97` → `#6B6F77` (`4.60` on `bg`, `5.01` on `surface`)
  - `light.warning`: `#B45309` → `#B05008` (`4.65` on `accentSoft`)
  - `light.danger`: `#D92D20` → `#CE281D` (`4.89` on `bg`, `5.32` on white)
  - `dark.textTertiary`: `#71717A` → `#86868F` (`5.48` on `bg`, `5.05` on `surface`, `4.66` on `surfaceRaised`)
  - Added `onDanger: '#FFFFFF'` (light) / `'#0A0A0C'` (dark, `7.15:1` on `#F87171`).
- Easy to reverse? Yes — single palette edit in `src/theme/tokens.ts`, enforced by `src/theme/tokens.test.ts`.

## D-007 — Reminder day indexing & Web Sheet transition  (Phase 12, 2026-11-13 14:12)
- Question: `DESIGN.md §4` specifies `ReminderSettings.days` as `0 = Sun .. 6 = Sat`, whereas `DayToggles` (built in Phase 7) and `expo-notifications` `WeeklyTriggerInput.weekday` expect `1 = Sun .. 7 = Sat`, and legacy v1 settings stored `'everyday'` / `'weekdays'`. Separately, RN Web `<Modal animationType="fade">` briefly renders sheets semi-transparent during its CSS opacity fade.
- Options considered: Refactor `DayToggles` and existing Phase 7 tests to `0..6` vs keep `DayToggles`/`expo-notifications` at `1..7` and map `+1`/`-1` at the Settings/Onboarding/Scheduler boundaries; wait longer vs disable Web `Modal` fade animation.
- Chose:
  1. Persist `ReminderSettings.days` as sorted unique `0..6` integers (`0 = Sun .. 6 = Sat`), map legacy `'everyday' -> [0..6]` and `'weekdays' -> [1..5]` (Mon–Fri, matching `D-005`) via `normalizeReminderDays()`, keep `SUN_THU_REMINDER_DAYS = [0..4]` for the `Sun–Thu` preset chip per `DESIGN.md §6.6`, and adapt `d + 1` / `w - 1` at `DayToggles` and `buildReminderTriggerSpecs()`.
  2. Use `animationType="none"` on Web in `Sheet.tsx` (`fade` preserved on native Android/iOS unless `reducedMotion`) so sheets appear opaque immediately without bleed-through from underlying screens or toasts.
- Easy to reverse? Yes — helpers in `src/domain/types.ts` and one platform condition in `src/ui/Sheet.tsx`.

## D-008 — Real-device Android Fabric fixes & Windows CMake path limit  (Phase 13, 2026-11-13)
- Question: Full phone QA on the Galaxy S25 Ultra (`v1.1.0` release APK) uncovered four platform-specific issues not visible on Web: (1) Activity `SectionList` rendered zero rows unfiltered and crashed natively (`java.lang.IndexOutOfBoundsException: index=8 count=7` in `ReactClippingViewManager.addView` / `SurfaceMountingManager.addViewAt`) on filter reset; (2) compact `SegmentedControl size="sm"` beside `"Spending"` on Home stretched via `flex: 1` and clipped `"Month"`; (3) dark-mode `Switch` thumbs (`theme.colors.surface` = `#141518`) blended into tracks and disabled dark primary buttons lacked contrast; (4) Windows `MAX_PATH` broke native `assembleRelease` CMake object paths.
- Chose:
  1. Set `style={styles.flexOne}` and `removeClippedSubviews={false}` on Activity `SectionList` (`src/app/(tabs)/activity.tsx`).
  2. Scope `flex: 1` in `SegmentedControl` to `!isCompact` (`optionFill`), add `flexShrink: 1` on `container`/`option`, `numberOfLines={1}` on labels, and `gap: 8` on Home's `sectionRow` (`src/ui/SegmentedControl.tsx`, `src/app/(tabs)/index.tsx`).
  3. Set `Switch` `thumbColor="#ffffff"` across Settings, Categories, Onboarding Reminder, and Dev Gallery; render disabled dark `variant="primary"` `Button`s with `accentSoft` fill and `'accent'` label at `opacity: 0.72` (`src/ui/Button.tsx`).
  4. Use a scratch Gradle init script (`CMAKE_OBJECT_PATH_MAX=255` on `:app`, `225` on libraries, short `android/b/<slug>` staging dir removed afterward) for Windows `assembleRelease` without dirtying tracked Android config files.
- Easy to reverse? Yes — localized component style/prop changes and standalone scratch Gradle init script.

### D-009 — Standalone `assembleRelease` dev APK & Android SAF subfolder export (2026-11-13)
- Question / Trigger: Running the dev variant (`APP_VARIANT=dev`, `com.hamim.budgetapp.dev`) away from a Metro workstation on physical hardware, plus Android 14+ SAF folder picker restrictions on the root `Download` directory.
- Options considered:
  1. Expo debug APK requiring live Metro bundler over USB/Wi-Fi vs standalone `assembleRelease` APK signed with the debug keystore.
  2. Defaulting SAF export to root `Download` without messaging vs creating/selecting a dedicated subfolder inside `Download` (e.g. `BudgetBackups`) per Android Scoped Storage rules.
- Choice & Why:
  1. Build standalone `APP_VARIANT=dev` APKs with `assembleRelease` (default debug-key signing, `BUDGET_RELEASE_SIGNING` unset) so `Budget Dev` runs self-contained on the phone side-by-side with production `com.hamim.budgetapp` without blocking on Metro or risking the production keystore/signature.
  2. Keep the native Android SAF directory picker (`StorageAccessFramework.requestDirectoryPermissionsAsync`), guiding/saving cleanly into a user-selected subfolder (tested with `Download/BudgetBackups`), matching Android's platform restriction without adding storage permissions.
- Easy to reverse? Yes — dev builds can switch back to Metro debug anytime, and SAF logic lives solely in `src/data/backupFiles.ts`.

## D-010 — TEST-CASES-v1.2 §A transfer-delete balance arithmetic (`1,215,000`)  (Phase 16, 2026-11-13 18:01)
- Question: `docs/v1.2/TEST-CASES-v1.2.md` §A line 34 states `"Delete t1 → its fee row is deleted too → bkash = 1115000, cash = 0, spending = 196900"`, whereas with `t1` (`100000` transfer `bkash -> cash`, `1850` fee) deleted, `bkash` has `opening (1000000) + income e2 (250000) − expense e1 (35000) = 1215000` (and `1115000` on line 35 is the result of editing `t1`'s fee `1850 -> 0` while keeping the `100000` transfer in place).
- Options considered: Special-case or leave deleted transfers subtracting `amountMinor` (violating conservation of money when `cash = 0`) / Assert exact integer conservation: `1,115,000` when `t1`'s fee is edited to `0`, and `1,215,000` when `t1` itself is soft-deleted (`cash = 0`).
- Chose: Assert exact `1,215,000` on `Delete t1` (`cash = 0`, `spending = 196900`) and `1,115,000` on `Edit t1 fee 1850 -> 0` (`cash = 100000`) in `src/domain/accounts.test.ts` (note left doc `TEST-CASES-v1.2.md` untouched as reference spec, documented discrepancy here).
- Easy to reverse? Yes — pure arithmetic check in `src/domain/accounts.test.ts`.

## D-011 — Negative card balance toggle & Ledger fee-row folding  (Phase 17, 2026-11-13)
- Question: Two Phase 17 UX details: (1) Android's `decimal-pad` soft keyboard omits the `-` key, preventing direct negative entry for initial credit card debt (`-5000`); (2) A transfer with a fee stores both a `transfers` row and a linked `'fees'` `transactions` row — showing both separately in unfiltered Ledger/Wallet feeds would visually duplicate the transfer event, while filtering by Category (`Fees & charges`) or Type (`expense`) excludes the parent transfer.
- Options considered: Switch numeric inputs to `numbers-and-punctuation` (inconsistent on Android OEM keyboards) vs keep `decimal-pad` plus an explicit sign toggle (`Tap for negative (−)` / `Amount due (card debt)`); always show separate fee rows vs fold a linked fee transaction into its parent transfer row (`"Cash out · fee ৳ 18.50"`) only when the parent transfer is visible in the current feed.
- Chose:
  1. Keep `decimal-pad` on wallet balance inputs (`src/ui/WalletEditorSheet.tsx`, `src/app/onboarding/wallets.tsx`) and add an accessible explicit sign toggle pill (`"Positive balance (+)"` / `"Tap for negative (−)"` / `"Amount due (−)"`), storing signed `openingBalanceMinor`.
  2. Fold `tx.transferId` rows into their parent transfer row in Ledger (`src/app/(tabs)/ledger.tsx`) and Wallet detail (`src/app/wallets/[id].tsx`) whenever that parent transfer is in the visible list; when filtering by category (`Fees & charges`) or type (`expense`), linked transfers are not loaded so the fee row remains visible and accurate.
- Easy to reverse? Yes — sign toggle state in two wallet components and the `visibleTransferIds` check in Ledger/Wallet detail.

## D-012 — Persisted `people.honorific`, reminder share fallbacks, and Quick Entry draft confirmation  (Phase 18, 2026-11-13)
- Question: Three Phase 18 details needed explicit choices: (1) Whether per-person honorific (`none | bhai | apu`) for EN/BN reminders lives only in component state or is persisted; (2) How the Messenger / WhatsApp buttons on Person detail share reminders on Android without brittle URL scheme failures; (3) How Quick Entry handles `cash out` fees and unknown people/wallets.
- Options considered: Keep honorific in local screen state / Persist `honorific TEXT NOT NULL DEFAULT 'none'` on `people` in schema v4 + backup v4; require `fb-messenger://` scheme query / use `Share.share` + `expo-clipboard` fallback for Messenger & WhatsApp; auto-create wallets/people during parse / keep drafts strictly non-mutating until Save with an actionable `"No Upay wallet yet: add it?"` banner.
- Chose:
  1. Persist `people.honorific` (`'none' | 'bhai' | 'apu'`) in migration v4 (`src/data/migrations.ts`) and backup v4 (`src/data/backup.ts`) so Rafi `ভাই` / Sumi `আপু` choices survive app restarts and backups.
  2. Use WhatsApp deep link (`whatsapp://send` / `wa.me`) with `Share.share` fallback, and system `Share.share` (+ `expo-clipboard` pre-copy) for Messenger in `src/app/people/[id].tsx`.
  3. Keep `src/voice/parser.ts` pure: return `feeMinor: null` + `asksFee: true` on `cash out` (prefilled `0` in review UI), hint missing wallets (`missingWalletHint`), and create new `Person` records only when the user confirms Save in `src/app/quick-entry.tsx`.
- Easy to reverse? Yes — localized to v4 schema/backup normalization, `people/[id].tsx` share handlers, and `quick-entry.tsx` draft submission.

## 2026-11-17 (orchestrated plan, docs/PLAN.md)
- Owner asked for full automation with no gate after each phase; phases now run on without stopping. Phone-data safety rules in AGENTS.md still apply.
- Minimum Android version: option A (keep minSdk 24, Android 7.0), as PLAN.md recommended, plus the performance budget.
- Phase 1 research grouped into six files in docs/research/ instead of one per segment, to limit cost. Habits and "top 3 logs" there are hypotheses, not findings.
- UI rulebook is docs/UI-FOUNDATION.md; where it disagrees with docs/ui-overhaul/DESIGN.md, tokens.ts and the rulebook win.
- Build order: UI foundation audit fixes first, then the backlog in docs/SYNTHESIS.md section 5.
- Live reload: Metro runs without CI=1 (CI mode disables reload) and with APP_VARIANT=dev; the phone is on USB (serial R5CY23M7E6L). The Android SDK is at C:\Users\User\android-dev\sdk, not %LOCALAPPDATA%\Android\Sdk.
