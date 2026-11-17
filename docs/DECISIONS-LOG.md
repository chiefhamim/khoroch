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
- Reviewer findings on 9aeefbb, applied: card enter is now ease-out timing (a spring with a duration ran about 1.5x long); the onboarding coin scene is static; the sheet backdrop is hidden from TalkBack when a header close button exists.
- Deliberate exception to UI-FOUNDATION section 8: the Money count-up stays on the JS thread (about 18 re-renders of one Text, hero and display amounts only, 300 ms). A UI-thread version needs an animated TextInput and worklet formatting; not worth the regression risk now.
- Sheet open and close stay at 220 ms tokens (within the 300 ms ceiling) rather than motion.normal 200.
- Repeat chips fill the form and do not save by themselves (SYNTHESIS task 1 said "saves a matching entry"): one extra tap on Save is the price of never saving an entry by accident.
- Capture shortcuts are one constant-height row above the keypad (repeat chips, pinned amounts, a "Quick amounts" chip that opens a sheet for pinning and removing). Nothing above the keypad may change height while typing. Long-press removal was dropped.
- Money amounts never shrink with adjustsFontSizeToFit; they pick a type size from a width estimate (src/domain/fitMoney.ts) and fall back to compact.
- App lock needs expo-secure-store (installed at ~58.0.3, plugins added in app.config.ts); the dev app was rebuilt for it. The PIN hash, salt and attempt counter live in secure storage only, never in SQLite or backups.

## Due date on dues (schema 6)

- Column `due_entries.due_on TEXT NULL` (local date `YYYY-MM-DD`, same format as `occurred_on`). Additive `ALTER TABLE ... ADD COLUMN`, guarded by a `PRAGMA table_info` check so it is idempotent. `LATEST_SCHEMA_VERSION` and `BACKUP_SCHEMA_VERSION` are now 6; backups from schema 1 to 5 (no `dueOn` key) import with `dueOn` null; an invalid `dueOn` is rejected as `invalid_due_on`.
- A due date is only offered and saved for `lent` and `borrowed` entries. Saving an entry after switching it to a repayment kind clears the date.
- Which entries are "open": the entries that started the current balance (`lent` when the person owes you, `borrowed` when you owe them). Open total is |net|. The repaid part (sum of those entries minus |net|, never below 0) is applied to the oldest due dates first. Undated entries are repaid after dated ones, oldest first. An entry repaid in full is never open and never overdue.
- Overdue means due date strictly before today (due today is "Due today", not overdue). Next due date is the earliest due date among open dated entries, even if already past; days = nextDueOn minus today (negative means days since).
- If an overpayment flips the balance, the old entries are not open and nothing is overdue.
- People list caption: overdue amount wins; otherwise "Due today" or "Due in N days" when the next due date is 0 to 7 days away. No dots, badges or new colours: overdue uses the existing `danger` token, the rest `textSecondary`.
- No notifications in this task.

## Default fee per wallet (schema 7)

- Column `accounts.default_fee_bp INTEGER NULL` with a CHECK of 0 to 10000. Basis points of a percent, two decimals exact (1.85% = 185). Additive `ALTER TABLE ... ADD COLUMN`, guarded by `PRAGMA table_info(accounts)`, one transaction. `LATEST_SCHEMA_VERSION` and `BACKUP_SCHEMA_VERSION` are now 7. No wallet is seeded with a rate. Backups before 7 import with null; a non-integer or out-of-range value is rejected as `invalid_default_fee`.
- `Account.defaultFeeBp` is optional in the type (null or absent means no default) so existing fixtures and callers keep working.
- Fee maths in `src/domain/fees.ts`: `fee = round_half_up(amountMinor * rateBp / 10000)`, computed as integer multiply, add 5000, then an exact quotient using the remainder (no float division). 333.33 at 1.85% = 33333 * 185 = 6,166,605, which is 616.66 poisha, so 617 poisha = 6.17. Largest amount times 10000 is about 1e15, below Number.MAX_SAFE_INTEGER. Rate 0 or null, or an amount of 0 or less, gives 0.
- Rate text parses by digit strings (Latin or Bangla), at most 3 whole digits and 2 decimals, max 100.
- The field shows on every wallet kind in the editor (it only has an effect on transfers out of that wallet). Empty clears it to null; 0 is stored as 0 and treated as no default.
- Transfer form: the fee field is derived, not copied. While the user has not typed a fee and the source wallet has a rate above 0, the field shows the computed fee and follows the amount and the source wallet. Typing a non-empty fee sets "edited" and it stops following; clearing the field returns to the pre-fill. Opening a saved transfer starts as edited, so its stored fee is shown as is. The caption "{rate}% default for {wallet}" shows only while the pre-fill is active and above 0. The saved fee is the parsed text shown in the field.
- Fee text is shown without a trailing zero, as before (`18.5`, `185`).

## Due dates review fixes (open amounts and overpayments)

- `computeOpenDueEntries` replays a person's entries chronologically (occurredOn, createdAt, id). Each entry first reduces what is open in the opposite direction at that moment (earliest due date first, undated last); the rest becomes open in its own direction. A repayment therefore never touches loans made after it, and a settled earlier cycle cannot hide a new overdue loan.
- An overpayment with no originating loan entry has no loan to point at. The excess is represented as an open amount on the repayment entry itself (for example the `received_back` entry that exceeded what was owed, open in the "I owe" direction). Such an entry has no due date that counts (a due date only counts on `lent` and `borrowed`), so it is never overdue and never gives a next due date. Later entries in the other direction reduce it the same way as any open amount.
- At the end only the direction of the net balance is open and the open amounts sum exactly to |net|.
- A due date earlier than the entry date is invalid: the entry sheet clears it when the entry date moves past it (with a one-line caption), and `validateNewDueEntry` rejects it (`due_before_entry_date`), so backup import rejects it too.

## Wallet default fee review fixes

- Real transfer paths on screen: (1) Quick entry (`src/app/quick-entry.tsx`), a parsed "cash out" or transfer draft, creates a transfer with a visible fee field. (2) Edit transfer (`src/app/transfer/[id].tsx`) updates one through the legacy form. The add-entry screen renders `FastTransactionEntry`, which has no transfer mode, so `handleSubmitTransfer` in `src/app/transaction/new.tsx` and the Transfer tab in the legacy form's new mode are not reachable from any screen today. They were kept (not removed, out of scope) and use the same fee function.
- One decision function: `resolveTransferFee` in `src/domain/fees.ts` (source wallet, destination wallet, amount in minor units, fee state, `allowDefault`). Quick entry, the legacy form and the save step all call it. Fee state is explicit: untouched (shows the default when one applies), typed (their text, never overwritten) or cleared (empty means no fee, sticks).
- A default applies only for a cash-out: the source is a mobile wallet with a rate above 0 and the destination is a cash wallet. `isCashOutTransfer` is the single definition and also drives the "Cash-out fee?" badge and the Ledger "Cash out" wording. A bank, a card or another mobile wallet gets no pre-fill.
- The wallet editor shows the default fee rate field only for the mobile wallet kind. Saving a wallet of any other kind stores no rate (null), which also clears a rate left on a wallet whose kind was changed.
- The "Use {rate}% default" caption is a 48dp button shown when a default applies but the fee is typed or cleared. It is not offered when editing a saved transfer, which never applies the default and keeps the stored fee even when the amount changes. A stored fee of 0 opens as cleared.
- The legacy form's new-mode save button reads "Transfer {amount} + {fee} fee" when the fee is above zero. Quick entry has no amount on its save button, so the fee is shown in its fee field and the source caption.
- `parseFeeRateInput` strips trailing zeros of the decimal part before the two-decimals check ("1.850" and "1.8500" are 1.85, "1.851" is still rejected).
- `runMigrations(db, targetVersion = LATEST_SCHEMA_VERSION)`: the optional second argument lets tests stop the real chain at an older version. The app calls it with no argument, so production behaviour is unchanged. The v6 to v7 migration test now builds its v6 database with `runMigrations(db, 6)`.

## EMI payoff view (SYNTHESIS section 5, task 9)
- No schema change. `totalInstallments`, `paidInstallments`, `amountMinor`, `dayOfMonth`, `lastPaidPeriod` and `isActive` are enough. The model has no separate last instalment, so every instalment equals `amountMinor`.
- `computeEmiPayoff(bill, period)` in `src/domain/emiPayoff.ts` is the only place the figures are computed. Paid is clamped to 0..total. Finished means paid reached total, regardless of `isActive` (marking the last instalment paid sets the bill inactive).
- End month: one instalment per budget period. If this period is already stamped paid the next one is next period, else this one. If the due day is before the cycle's start day the due date lands in the following calendar month. Year and month come from the period start, formatted with `formatMonthYear`.
- A paused EMI (inactive, not finished) shows "{amount} left, paused" and no end month, since no date can be promised.
- Bills have no detail view, so the payoff sits as a block directly under the EMI row in Plan (bar, "N of M paid", "left/ends" or finished line). The old "{paid}/{total} paid" part of the row subtitle was removed to avoid saying it twice; the `budget.emiProgress` key is left in place unused.
- Amounts in the sentence use `formatMoney` with the hide-amounts and show-poisha settings, as the neighbouring budget rows do, because the figure sits inside a translated sentence.

## Worked today daily wage (SYNTHESIS section 5, task 10)
- Setting `dailyWage` is `{ amountMinor, categoryId, accountId | null }` or null, stored as JSON under settings key `daily_wage`, the same way `pinnedAmounts` is (no table change). `normalizeDailyWage` in `types.ts` is the one reader: anything invalid reads as unset. It is in backup export; import throws `Settings: invalid dailyWage.` for a present but invalid value, and an absent or null value imports as unset. `BACKUP_SCHEMA_VERSION` stays 7 because the field is optional and additive.
- Identifying wage entries without a schema change: the `source` column has `CHECK (source IN ('manual','quick','voice','capture','sample'))`, so no new source value. The entry uses the allowed source `quick` plus a fixed note marker, two U+2063 invisible separators (`WAGE_NOTE_MARKER` in `domain/dailyWage.ts`). `quick` alone is not enough (Quick entry and budget flows also write it); the note is free text; the marker carries no words so it needs no translation, shows as an empty note, and survives `trim()`. Editing amount, category, wallet, description or date keeps it. Only clearing the note removes it, after which the entry no longer counts as the day's wage (accepted; the button then comes back and the person can undo or add again).
- Entry description is the category name (as the add-entry form does), not a translated phrase, so stored text never depends on the language.
- "Recorded today" is read with `repo.listTransactionsInRange(today, tomorrow)` in Home, not from the five-row recent list, so a busy day cannot hide it. The button is swapped for the quiet line at the moment of the tap (before the insert returns), with a ref guard, so a second tap cannot land. Undo calls `softDeleteTransaction(id)` for exactly that id and bumps the data version; the day read then finds no wage and the button returns.
- Home shows the wage row only when the saved category still exists, is an income category and is not archived. A wage whose wallet is gone or archived files with no wallet. While wallets are still loading the saved wallet id is used.
- The spec said second tap "asks first" in SYNTHESIS; the task for this build replaced that with the quiet line, which is what was built.
- The wage row is a fixed-height strip (button height plus two small spacings) between the Daybook header and its content, rendered for both button and quiet line, so the card content below never moves. The button is a PressableScale with tabular digits rather than `Button`, because `Button` cannot set tabular numerals and was off limits.
- One shared `DailyWageSheet` (amount field, income category chips, wallet picker sheet) serves Settings (row in the Personal group, after the cycle row) and the add-entry screen. Category is a chip group inside the sheet, not a second sheet, because there are few income categories. It loads its own categories, wallets and the last 150 income entries and starts from the most used income category and wallet, falling back to the first active ones.
- The "Set daily wage" chip leads the existing constant-height shortcuts row (no vertical shift), shows on the Received side only, and only while no wage is set. A new `common.undo` string was added for the toast action.

## Worked today, review fixes
- The invisible U+2063 note marker is gone. "Recorded today" is now the settings value `dailyWageLast` ({ id, day }, JSON in the settings store, key `daily_wage_last`) plus a repo read of that entry: same local day, entry exists, not deleted, still dated that day. New wage entries have an empty note. No migration: old entries still carrying the marker are cleaned by `stripInvisibleNoteMarks`, applied wherever a note enters an editor (TransactionForm, FastTransactionEntry) and in the Repeat chip, so they clean on the next save. Old entries are no longer recognised as "today's wage" (they have no pointer); on the day of the update the button may offer one more entry if the old build recorded one that day.
- `dailyWageLast` is never exported and is always null after an import (the ids are device local). It reuses the `Settings` type, so the backup validator returns null for it.
- Recorded state starts unknown (null). While unknown, after a failed read, or while a different day's value is held, the strip keeps its height and shows nothing tappable. The record function re-reads through the repo just before inserting (first entry of the day only) and is guarded by a ref. The day and time come from one `new Date()` taken at the tap. Home passes `useToday()` (focus plus foreground refresh) into the dashboard unless a test overrides it.
- Wallet is resolved from the repo at tap time (`listAccounts` including archived), not from screen state, so it never depends on a half-loaded screen. Missing or archived wallet saves with no wallet and the toast says so.
- A failed insert, or a failed pointer write after the insert (the entry is soft-deleted again so nothing is half done), shows a danger toast (`dailyWage.failedToast`) and the button stays available.
- Second shift: the quiet line plus a text action "Add again" opens a Sheet that asks first; confirm inserts a second entry without the recheck and moves the pointer to it. Undo soft-deletes only that entry and puts the pointer back to the previous one (so the day stays recorded); Undo of the first entry clears the pointer.
- Wage button is flat: no elevation, hairline `cardBorder` border, transparent fill. "Set daily wage" in the shortcuts row is a text-style button (role button, 48dp) placed last in the row. The Settings Daily wage row follows hide-amounts and show-poisha. DailyWageSheet no longer keeps an archived category or wallet silently: defaults show with a visible note (`dailyWage.fallbackNote`) until the person picks.

## Bill due reminders (SYNTHESIS section 5, task 5)
- New setting `billReminders { enabled, leadDays }` (key `bill_reminders`, default off, lead 1; leadDays is 0, 1 or 3). It lives in the existing settings key-value table, so there is no schema change and no migration. Backup exports it, validation rejects a malformed value, and an old backup without the key imports as off.
- Reminder time: the daily check-in time is reused only when the daily check-in is switched on. Otherwise the stored 21:00 is only an untouched default and is too late for a bill, so the reminder goes out at 09:00.
- Reminders cover this period's due date and the next period's (it cannot be paid yet), so they keep coming if the app is not opened for a month. Instalment plans never get more reminders than instalments left. A due date already past is not reminded about.
- Paid rule is calc.ts `isBillPaidInPeriod` (stamp equals period start) and outstanding rule is `isExpenseBillOutstanding`, the same as the Plan screen, so a reminder never disagrees with what Plan shows. The date-based `isPaidInPeriod` in emiPayoff.ts is not used because it would show a bill as unpaid on Plan and paid here after a cycle-day change.
- Cap: 30 scheduled reminders, soonest first (Android allows about 500 alarms per app on some phones, and the daily check-in shares that budget). The list is rebuilt on every start, foreground, data change and settings change, so later ones roll in.
- Identifier `bill-due:<billId>:<fireDate>`. Only ids with that prefix are cancelled by this feature. The daily check-in sync used to call `cancelAllScheduledNotificationsAsync`, which would have wiped bill reminders; it now cancels only ids without the bill prefix. Delete all data still cancels everything.
- One sync hook in the root layout (`useBillReminderSync`) reacts to `dataVersion`, settings, language and the app returning to the foreground, instead of wiring every bill mutation. A run is skipped when the scheduled ids and text already match.
- Permission: asked only when the switch is turned on, via the existing `requestNotificationPermission`, without the daily explainer sheet (its wording is daily-specific). If refused the switch stays off and a plain line plus a System settings button show. The sync never asks. If permission is later revoked the Settings screen turns the switch off, as it does for the daily reminder.
- Tap opens the Plan tab through in-app routing (`router.push('/(tabs)/plan')`), the way the check-in tap works; no URL scheme is involved, so dev (`khoroch-dev`) and main (`khoroch`) behave the same.
- Text carries the bill name and timing only ("Rent is due today", "is due tomorrow", "is due in 3 days"), never an amount; a test checks every `billReminder.*` string in both languages for amount placeholders.
- Delivery uses a DATE trigger with the default best-effort delivery, so Android may delay it by a few minutes under battery saving. No exact-alarm permission was added.

## Worked today, fixes round 2
- The pointer is now `{ day, ids[] }`; the old `{ id, day }` reads as a one-element list (no migration, same settings key). The day counts as recorded when any listed id is a live entry dated that day (`pruneWageLast`, read through the repo). A new entry appends its id and Undo removes only its own id.
- "Record again" confirm: a ref set on the first press and reset only when the sheet is opened again, plus the button disabled while saving. Tests keep the sheet mounted with a stand-in Sheet because the real one unmounts in jest.
- Backup restore keeps the local pointer ids that are live entries dated today in the restored data (`restoreBackupPayload` takes an optional `today`), otherwise sets none. A failure writing the pointer there is swallowed, since the restore itself succeeded and the button just offers the wage again.
- Half-failed save (entry inserted, pointer write and rollback both failed): toast `dailyWage.checkEntriesToast`, and the day counts as recorded for the session through a ref.
- Midnight with Home open: `useTodayWithRefresh` exposes `refresh`; Home calls it after a successful record whose day differs from the screen's today.
- Bangla strip: the recorded label wraps to two lines (`flexShrink: 1`, clip) and "Add again" is `flexShrink: 0`. Two label lines are 36 against a 66 strip (button height 50 + 2 x 8), so no string was shortened.
- DailyWageSheet: when the lists fail to load the existing error line shows `dailyWage.loadFailed` and Save stays disabled.

## Bill reminders, review fixes (2026-11-17)
- Delivery is inexact: without the exact-alarm permission Android may deliver a bill reminder late, by up to roughly an hour. The app does not request exact-alarm permission.
- A reminder whose fire time passes while the phone is switched off is dropped, not delivered at the next boot. The next app open schedules the following ones.
- Fire times are fixed in absolute time when scheduled, so after a timezone change the reminders keep their old moment until the app next opens and reschedules them (the diff sees the new local time and reschedules only what moved).
- Bill names on the lock screen: the setting `billReminders.hideNames` (optional, absent means off) hides them; app lock being on forces it on, shown as on and disabled with a caption. The bill channel is created with private lock-screen visibility. Android lets the user override a channel's visibility, and an existing channel keeps the visibility it was first created with, so the generic text is the real protection.
- The reminder body no longer says "still unpaid" (the bill may have been paid early as a plain entry); it asks the person to open Plan and mark it paid if they already paid.
- One paid-this-period rule for bills: `isPaidInPeriod` in `src/domain/calc.ts` (payment stamp on or after the period start, by date), used by `isBillPaidInPeriod`, the Plan badge and button, bills totals, reminders and the EMI payoff.

## Weekly period option (2026-11-17)
Decisions A to E were made by the owner's coordinator; recorded here as built.
- A. New settings `periodKind` ('month' default | 'week'), `weekStartDay` (0 = Sunday to 6 = Saturday, default 6) and `weeklyBudgetMinor` (null until set), in the settings key-value store (keys `period_kind`, `period_week_start_day`, `weekly_budget_minor`). No table change, no schema version bump: backups carry the three keys when present, validate them when present, and an old backup imports as monthly, Saturday, no weekly budget. The existing `weekStartsOn` (saturday/sunday/monday, used by the calendar and Insights) is a separate setting and is left alone.
- B. `getSpendingPeriod` (week or month) and `getBillPeriod` (always the monthly cycle) in `src/domain/period.ts`. In monthly mode both equal `getPeriod`. The week is pure civil-date arithmetic from the date string (no clock, no UTC).
- C. Budgets do not convert. The monthly total and category budgets stay in the `budgets` table keyed by the monthly period start; weekly mode reads `weeklyBudgetMinor`. Switching modes writes nothing. In weekly mode the budget rows for the monthly cycle are still seeded forward (`ensureBudgetsForPeriod` with the bill periods) so switching back finds this month's amounts.
- D. Bills, the paid badge, Mark paid, EMI payoff and bill reminders use the monthly bill period. In weekly mode "Left after unpaid bills", Safe today and the Plan "after bills" line subtract only unpaid bills whose due date (due day clamped to the month length) is inside the week. An occurrence counts as paid by the monthly bill period that contains its due date, so a November payment does not pay the December bill.
- E. Settings: "Budget period" row (Monthly, Weekly), "Week starts on" row only while Weekly (Saturday listed first), the cycle-day row stays and is relabelled "Month starts, for bills and monthly budgets" while Weekly.
Beyond A to E:
- Past weeks (Plan): the last six finished weeks that have spending, each measured against the one current weekly amount (there is no per-week budget history).
- Home chart in weekly mode: Day = the 7 days of the week, Week = the last six weeks (numbered 1 to 6, oldest first), Month = the usual six monthly cycles. Monthly mode is unchanged.
- The "New cycle started" notice is monthly only; it is off in weekly mode.
- In weekly mode the "Where it went" rows are plain rows (no "Set budget" tap), because category budgets are edited only in monthly mode.
- Insights, the Activity date presets, the category-budget screens of onboarding and the bill reminders stay monthly. The category detail screen opened from Home follows the spending period.
- A weekly amount of 0 is stored as unset (null).

## Review fixes: paid-in-period bounds, restore keeps hide-names, wage undo queue
- Paid in a period is now bounded: period start <= stamp < period end (exclusive), by date. `isPaidInPeriod` takes the end as a required third argument. A stamp from a future period (clock ahead, restored data) no longer makes earlier periods read as paid; its reminder stays scheduled and its amount stays in the unpaid total. `countBehindPeriods` is unchanged and returns 0 for a future stamp.
- Restore keeps the device's "Hide bill names" when it is on; a backup may turn it on, never off (same idea as the app lock keys).
- Bill reminder sync: when hiding names turns on (setting or app lock) the sync runs at once with no debounce. When the sync turns the switch off for missing permission it also sets `notificationPermissionDenied` so the blocked row explains it.
- Scheduled bill reminders carry `fireMs` (milliseconds, no user text) in their data. When the OS trigger has no absolute date (iOS interval) the diff compares that value. Reminders scheduled by an older build have none, so they are rescheduled once on iOS.
- Worked today: record and Undo run through one serial queue (`createSerialQueue`); Undo removes only its own id from the freshly read pointer (`undoWageEntry`). Fallback "recorded today": a live quick income entry of today with the wage's category and exact amount, used only when the pointer has no live id; it shows the recorded line with "Add again" (which confirms).
- Settings subtitle for bill reminders no longer says "if it is still unpaid", matching the neutral notification body.

## Weekly mode, review fixes
- Weekly unpaid bills (Home after-bills, Safe today, Plan) count only occurrences due inside BOTH the current week and the current bill period (`summarizeUnpaidBillsDueInPeriod` gets an optional 4th argument `currentBillPeriod`; omitted keeps the old behaviour for callers and tests). The weekly set is therefore a subset of what Plan shows unpaid, and Mark paid always clears it. A bill due on the 2nd, seen on 29 Nov, is not held back yet.
- One week start: `getEffectiveWeekStart({ weekStartDay, weekStartsOn })` in `src/domain/period.ts` returns 0..6. No schema change, so "has the user set it" cannot be stored; instead a `weekStartDay` other than the default 6 wins, otherwise the older `weekStartsOn` maps (sunday 0, monday 1, saturday 6). The Settings row writes `weekStartDay` and, for Saturday, Sunday and Monday, also `weekStartsOn`, so choosing Saturday again over an old Monday is not misread. Known edge: a legacy value of Sunday or Monday with an untouched weekStartDay now also moves the weekly Home week (it used to ignore the legacy value); monthly users who never touch the row see nothing change.
- Consumers (Home, Plan, category page, Ledger preset, day book calendar, Insights) read the selector. `getStartOfWeek`, `getWeekRange`, `getCalendarWeekdayLabels`, `resolveInsightsWindow`, `buildInsightsReport` and `DateTimeSheet` accept a legacy name or a number 0..6. The other date pickers (DateField, DueEntrySheet, TransactionForm) still use the default Saturday calendar; not changed.
- The Settings "Week starts on" row is visible in both period modes. Two existing test expectations in `weekly-period.test.tsx` changed because of that (the row is no longer hidden in monthly mode).
- Weekly captions: new keys for the Home hero line, the Home per-day strip label, the Plan per-day banner, the Past weeks caption and the Insights monthly-cycles note, English and Bangla. Monthly strings untouched.
- `normalizeWeeklyBudgetMinor` (shared by the SQLite repo, backup and, now, the memory repo) caps at `MAX_AMOUNT_MINOR`; larger reads as unset.

## Closing review fixes
- Restore: a backup may turn a privacy setting on but never off. `hideAmountsOnOpen` joins `billReminders.hideNames` (device value kept when true). The app lock keys are always kept from the device. No other setting is privacy-protective (`speechDisclosureAccepted` is a consent flag, left as it was, taken from the backup).
- Bill reminder sync result gains `permission: 'denied' | 'undetermined'` (with `permissionMissing`). Denied means the OS refused and cannot ask again (same rule as `getNotificationPermissionStatus`). The hook turns the switch off for both, but records `notificationPermissionDenied` only for denied. The old test that mocked `permissionMissing` alone now mocks `permission: 'denied'`, and one billReminders.test expectation gained the `permission` key (`toEqual`).
- Mark paid with a stamp on or after the current bill period end: pure `decideMarkBillPaid` in calc.ts. The hook only re-stamps to the current period (no transaction, no instalment) and resolves `'already_recorded'`; Plan shows `budget.billAlreadyPaidToast`. The return type went from `Promise<void>` to a string union, which callers ignoring it still accept.
- Home hero caption row: new `heroSubRowWrap` style (flexWrap) with no line limit on either caption. The fees caption is no longer rendered as an empty string when there are no fees; the after-bills caption then keeps the right edge with `marginLeft: 'auto'`. `heroSubRow` is unchanged for its other user.
- Date pickers: `DateTimeSheet` now defaults its week start from the app context (`getEffectiveWeekStart`) when the caller passes none, and keeps Saturday outside the context. That covers every user at once (DateField, TimeField, DueEntrySheet, TransactionForm, FastTransactionEntry, WalletEditorSheet, Ledger and Insights range fields, quick entry); DayBookView still passes it explicitly.
- Insights: the weekly note now sits after the range caption, which keeps its negative margin under the preset row.
- The daily wage serial queue is module-level (`dailyWageQueue`, exported for the test) so one queue serves the whole app session. Trade-off: a task that never settles would block later wage records until the app restarts.

## 2026-11-17 Capture C1 (safety fixes)
- Approve never defaults a wallet: a draft with no wallet shows "Choose wallet", Approve is disabled until one is picked (`canApproveDraft` in `src/capture/draftChecks.ts`).
- "Approve all" is now "Approve clear ones (N)", behind a confirm sheet that states N. Eligible: wallet and category matched, a real transaction id (5 to 24 letters or digits, not "Ref" or "Card"), not a scanned receipt, not a likely duplicate. The spec's `confidence` column does not exist before C12, so "has a real TrxID" stands in for "high".
- Likely duplicate: a saved, non-deleted entry with the same TrxID in its note, or the same type, amount and day (and wallet when the draft's wallet is known). Day, not the spec's 10 minutes, per the task. The draft stays; its Approve button becomes "Save anyway".
- USD: the spec wants a draft with an empty amount, but `pending_drafts.amount_minor` is `CHECK (> 0)` and a schema change is out of scope, so a USD-only message makes no draft. Revisit in C12.
- Raw text: `updatePendingDraftStatus` blanks `raw_text` as soon as a draft is approved or dismissed (the spec says 7 days, which needs a timestamp column; C12). The row stays so the fingerprint still blocks the same message.
- Sender allow-list is not touched (C14).
