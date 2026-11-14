# Copilot CLI prompt: Budget App UI + input overhaul

> How to use: open a terminal in `C:\Users\hamim\Desktop\budget-app`, start Copilot CLI, and paste everything below the line.
> The phone must be on the same Wi-Fi with Wireless debugging on and Stay awake on.

---

You are taking over **Budget App** at `C:\Users\hamim\Desktop\budget-app`. It's a local-first personal budget app for one person in Bangladesh, built with Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6, expo-router, Reanimated 4, Gesture Handler 3 and SQLite. Your job is a **real UI and input overhaul**, tested on the owner's Android phone. The owner thinks the current app is mediocre: "the UI feels meh", "not professional", "input is too complex". You have to change that. A recolour is not enough.

## 0. Read first, in this order
1. `AGENTS.md`: the standing rules, especially **§4b (no ellipsis)**, **§6 (phone safety)** and **§7 (dev app vs owner app)**. They override anything here except where this file explicitly says otherwise.
2. `docs/v1.2/PLAN.md`: data model, wallets, dues, features. Keep the **data model and business logic**; you are redesigning how they look and how they're entered.
3. `docs/PROGRESS.md`: Phases 14–18 are done and Phase 19 is half-done and uncommitted. Don't start Phases 19–25 features; this overhaul comes first.
4. `src/theme/tokens.ts`, `src/ui/*`, `src/app/**`: the current design system and screens.

Before changing anything, run `git status`. If there is uncommitted work, make one checkpoint commit: `git add -A; git commit -m "Checkpoint before Copilot UI overhaul"`. After that, commit at the end of each step below with a clear message. Never `git push`.

## 1. Hard rules (breaking any of these fails the job)
- **Owner's real data is sacred.** The owner's app is `com.hamim.budgetapp` and holds real money records. **Never** install to it, launch it, uninstall it, `pm clear` it, or touch its data. Every phone action uses the **dev app `com.hamim.budgetapp.dev`** ("Budget Dev"). Double-check the package name in every adb command.
- Always `adb install -r`. Never `-d`, never uninstall. If an install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, stop and tell me.
- DB migrations are **additive only** (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`). Never drop, rename or recreate tables. The current schema is v4 in `src/data/migrations.ts`.
- **No ellipsis anywhere:** no `...` or `…` in user-visible text, no truncation ellipsis (`numberOfLines` must use `ellipsizeMode="clip"`, or wrap), no three-dot menu icons, no typing/loading dots.
- **No dotted or dashed borders or lines.** Separators are solid hairlines.
- **No "AI slop" look:** no gradients, glows, glassmorphism, neon, floating pill tab bars, big drop shadows or emoji-as-icons. The owner previously rejected a gradient fintech look ("all fintech looks the same") **and** a paper-notebook/handwriting skeuomorphic look ("absolutely horrendous"). Aim for calm, precise, flat, confident: think Linear, Things 3 or Revolut's newer flat screens. Hierarchy should come from type, spacing and one accent colour.
- Money is integer poisha. All totals come from `src/domain/calc.ts`; UI never sums money itself.
- All user-visible strings go through `t()` in `src/i18n`.
- Every tappable element needs `accessibilityRole` and `accessibilityLabel`, and a touch target of at least 48dp.
- Respect reduced motion (the `reducedMotion` flag from `useTheme()`).

## 2. What the owner complained about (fix all of these)
1. **The whole UI feels mediocre and unprofessional.** Do a full visual overhaul (see §3).
2. **Input is too complex.** The owner tried to enter the last 7 days of spending (when, on what, how they paid) and it was a chore. Entering a past expense must take **at most 4 taps plus typing the amount**.
3. **The time picker is the old Android wheel/clock dialog** ("looks like 2016"). Replace the native `@react-native-community/datetimepicker` dialogs with a custom in-app picker (see §4.2).
4. **Wallets have no starting point.** There is no clear way to say "my bKash has ৳4,200 right now". Add a proper opening-balance flow (see §4.3).
5. **Lending / Settled (dues, People tab) is too complex.** Simplify it (see §4.4).
6. **The ৳ sign must be a superscript at the top-left of the number**, like a price tag: smaller, raised, and aligned to the top of the digits. Example: ⁽৳⁾2,418 with the ৳ at about 45–55% of the digit size, top-aligned with the cap height. Apply this everywhere an amount shows (hero, lists, inputs, keypad display, sheets), in light and dark, positive and negative (`−৳20` becomes a minus sign followed by the superscript ৳ and 20).
7. **The font looks unprofessional.** The current font is Plus Jakarta Sans. Replace it (see §3.2).
8. **The keyboard covers the amount inputs on some screens.** Every input must stay visible above the keyboard on every screen and sheet (see §4.5).

## 3. Visual overhaul

### 3.1 Geometry and system (keep it balanced and consistent)
- Use one spacing scale (4pt base: 4, 8, 12, 16, 20, 24, 32, 40) and one radius scale: 8 for chips and inputs, 14 for cards, 20 for sheets, and full for avatars. Use the same radius for the same role everywhere.
- Keep one consistent screen gutter (20) and one card padding (16). Align everything to it: icons, text and amounts share left and right edges across cards and screens.
- Icon tiles are one size (40) with one corner radius. Icons are one family (the current `AppIcon` set) at 1.75 stroke and 20–22px, and none are filled.
- Keep the existing code architecture: routes in `src/app`, primitives in `src/ui`, tokens in `src/theme/tokens.ts`, logic in `src/domain` and `src/state`. Improve the primitives rather than adding per-screen one-off styles. Use no magic numbers; everything comes from tokens.

### 3.2 Typography
- Pick a more refined, professional sans for the whole app. Candidates available as `@expo-google-fonts/*`: **Geist**, **Inter Tight**, **Manrope**, **Onest**, **Figtree**. Before choosing, render the Home screen with your top 2, look at the phone screenshots side by side, pick one, and note why in `docs/DECISIONS-LOG.md`. Install with `npx expo install`.
- Numbers use tabular figures and a slightly tighter tracking at large sizes. The hero amount should feel crisp and confident at 44–52px.
- Use at most 4 text styles per screen. Set a clear type scale in tokens (display, title, body, caption, and an amount style) and use only that.
- The new font won't contain ৳ (U+09F3). Adapt `scripts/patch-taka-font.py` (it copies ৳ from Hind Siliguri into the TTFs in `assets/fonts/` and is loaded in `src/app/_layout.tsx`) to the new font, **or**, because ৳ is now a superscript rendered by `src/ui/Money.tsx`, render it in a font that has it (`HindSiliguri_600SemiBold`). Either way, ৳ must look identical everywhere, including plain sentences like "fee ৳18.50".

### 3.3 Screens to redesign (all of them, light and dark)
Home (`(tabs)/index.tsx`), Ledger, Plan (+ Insights inside it), People + person detail, Wallets list + wallet detail, Add/Edit transaction (`transaction/new.tsx`, `transaction/[id].tsx`, `TransactionForm.tsx`, `Keypad.tsx`), Quick entry, Transfer, Settings, Onboarding, all sheets (`Sheet.tsx`, `DueEntrySheet`, `PersonEditorSheet`, `WalletEditorSheet`, `WalletPickerSheet`).
- Home must answer three questions at a glance: how much can I spend today, how much is in my wallets, and what did I just spend. Remove anything that doesn't serve those.
- The hero card is a solid accent colour (no gradient) with strong typographic hierarchy.
- Lists: one line for the title, one quiet line for meta, and the amount right-aligned. Rows wrap instead of truncating.
- Motion: keep the spring press-scale (`PressableScale`), the spring sheets with drag-to-close (`Sheet.tsx`, RNGH `usePanGesture`), the sliding `SegmentedControl` thumb and the native slide transitions. Make them consistent and fast (enter 220–280ms, springs critically damped, no wobble). Add shared-element-feeling continuity where it's cheap, for example when a list row opens its detail.

## 4. Core functionality fixes

### 4.1 Fast entry (the main complaint)
Redesign Add transaction around the keypad:
- The amount is big at the top and the keypad is always visible, so no system keyboard is needed for the amount.
- Below the amount is **one row of quick chips**: Category (recent 5 + "All"), Wallet (last used is preselected), and When (Today / Yesterday / pick).
- Note is optional and collapsed into a small "Add note" row.
- **Save + add another** keeps the same date and wallet, so entering 7 days of back-dated spending is fast. Show a small running list of what was just added in this session.
- Edit uses the same screen. Delete is a labelled button (no three-dot menu).

### 4.2 Modern date and time picker (replace the wheel)
- Build `src/ui/DateTimeSheet.tsx`, opened from the When chip:
  - **Date:** a strip of the last 14 days as tappable day chips (weekday + date) that scrolls horizontally, plus "Earlier" which opens a clean month grid in the same sheet.
  - **Time:** part-of-day chips (Morning 9:00, Noon 13:00, Evening 18:00, Night 21:00) plus an "Exact time" option with two compact scrollable columns (hour, minute in 5-minute steps) styled like the rest of the app. It must **not** use the Android clock or wheel dialog.
- Remove every use of the native `DateTimePickerAndroid` / `@react-native-community/datetimepicker` from the UI (`DateField.tsx`, `TimeField.tsx`, or wherever it's used). Leave the package installed.

### 4.3 Wallet starting point
- Every wallet has an opening balance and an "as of" date. The columns `opening_balance_minor` and `opening_date` already exist in `accounts`.
- Onboarding and the wallet editor ask in plain words: "How much is in bKash right now?" Use the keypad, with date defaulting to today.
- On Home and the Wallets list, a wallet with no opening balance set shows a clear inline prompt ("Set starting balance") that opens that flow directly.
- Add **"Adjust balance"** to the wallet detail screen: the owner types what the wallet actually shows, and the app records the difference as an adjustment (use or extend the existing logic; additive migration only if needed). This fixes drift without editing history.

### 4.4 Simplify dues (People tab)
- One list of people, each showing **one number**: "owes you ৳X" (green) or "you owe ৳X" (red) or "settled" (quiet).
- On a person's screen, show two big buttons: **"I gave"** and **"I got"** (the app works out lent / paid back / borrowed / received back from the current balance direction). Below them is a simple timeline.
- No "Settled" tab. Settled people sink to the bottom under a quiet "Settled" section header.
- Keep the existing `due_entries` kinds in the DB; only the UI and mapping change. Add unit tests for the gave/got → kind mapping (for example, "I gave" when they owe me nothing yet = `lent`; "I got" when they owe me = `received_back`; "I got" when nothing is owed = `borrowed`; "I gave" when I owe them = `paid_back`; overpaying flips the direction correctly).

### 4.5 Keyboard never covers inputs
- Install `react-native-keyboard-controller` with `npx expo install` and wrap the app in its `KeyboardProvider`.
- Use `KeyboardAwareScrollView` in scrolling forms and keyboard-aware bottom padding in sheets, so the focused input sits above the keyboard with 16dp of space.
- Test every screen and sheet that has a text input on the phone with the keyboard open, and screenshot each one.

## 5. Build, install and verify on the phone (dev app only)
```powershell
cd C:\Users\hamim\Desktop\budget-app
adb connect 192.168.0.154:38657  # last known address; if it fails: adb mdns services, then adb connect <ip:port> (port changes often)
adb devices
$env:PHONE="192.168.0.154:38657" # or whatever adb devices shows
$env:CI="1"; $env:APP_VARIANT="dev"
npx expo prebuild -p android     # REQUIRED first: android/ is currently generated for the OWNER app; this regenerates it for the dev app
Select-String android\app\build.gradle -Pattern applicationId   # must say com.hamim.budgetapp.dev, or STOP
cd android; .\gradlew.bat assembleRelease --console=plain --init-script ..\scripts\short-cxx-paths.gradle; cd ..
adb -s $env:PHONE install -r android\app\build\outputs\apk\release\app-release.apk
adb -s $env:PHONE shell monkey -p com.hamim.budgetapp.dev -c android.intent.category.LAUNCHER 1
```
- The `--init-script` is required on this PC (Windows path-length limit in the native C++ build). Keep `$env:APP_VARIANT="dev"` set in every terminal you build from.
- For faster loops, `assembleDebug` plus `adb reverse tcp:8081 tcp:8081` plus `npx expo start --port 8081` (in the background) gives live reload. Do a release build at the end.
- **Screenshots:** don't use `adb exec-out screencap >` in PowerShell (it corrupts the PNG). Use `adb -s $env:PHONE shell screencap -p /sdcard/ui.png; adb -s $env:PHONE pull /sdcard/ui.png docs\overhaul-copilot\<screen>-<theme>.png`. **Look at every screenshot** and fix what looks off before moving on.
- **Tapping:** the screen is 1440×3120 px at density 560 (1dp = 3.5px). Find elements with `adb -s $env:PHONE shell uiautomator dump /sdcard/ui.xml`, pull it, and tap the centre of the bounds. Don't guess coordinates.
- Switch themes only through the app's own Settings → Appearance, and set it back to System afterwards. Don't change phone settings.
- Sample data in the dev app is fine. Never "Delete all data" in anything except the dev app.

## 6. Done when
- `npm run typecheck` exits 0, `npx expo lint` has no errors, and `npm test` passes with no skipped tests (including `src/__tests__/no-ellipsis.test.ts`). Add tests for the new mapping and pickers, and update tests broken by intended UI changes. Never delete a test just to go green.
- The dev app is installed on the phone with every screen in §3.3 screenshotted in light and dark mode under `docs/overhaul-copilot/`.
- You recorded a timed walkthrough: entering 7 back-dated expenses across 3 days and 2 wallets, with taps counted per entry (target ≤4 plus the amount), written in `docs/overhaul-copilot/REPORT.md`.
- `REPORT.md` lists what changed per complaint (§2, items 1–8), the font chosen and why, before/after screenshots, and anything not finished, stated honestly.
- **Do not install to the owner's app `com.hamim.budgetapp`.** The owner will decide after reviewing the dev app.
