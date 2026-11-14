# Khoroch (খরচ) — Round 4 Log

## Section 0 Baseline (2026-11-14)
- Branch: `ui-round3-daybook`
- Pre-round-4 carry-over committed: `aad22d9 WIP: carry-over before round 4` (Khoroch rebrand, EN/BN i18n, Modern Notebook onboarding & homepage work, `docs/mockups/`)
- Baseline checks (clean before touching Round 4 code):
  - `npm run typecheck`: PASS (`tsc --noEmit`, 0 errors)
  - `npm test`: PASS (26/26 suites, 153/153 tests)
  - `npx expo lint`: PASS (0 errors, 1 pre-existing warning in `src/app/wallets/[id].tsx:258` on `hideAmounts`/`showPoisha` dependencies)
- Phone baseline (`R5CY23M7E6L`, Samsung Galaxy S25 Ultra):
  - Initial package check: only `com.hamim.budgetapp` installed; `com.hamim.budgetapp.dev` not yet installed.
  - Observed foreground at start: `com.samsung.android.app.contacts/...ContactDetailActivity` (`mWakefulness=Awake`), so no UI taps were performed yet per Section 1 owner-privacy rule.

## Pages 0a–0c: Shared Tokens, Core Components & Keyboard (2026-11-14)
- **Built & Installed Dev App:** Ran `APP_VARIANT=dev npx expo prebuild -p android` and `.\gradlew.bat assembleDebug --init-script ..\scripts\short-cxx-paths.gradle`; verified `applicationId 'com.hamim.budgetapp.dev'`, `"Khoroch Dev"`, and `android:windowSoftInputMode="adjustResize"`. Installed onto `R5CY23M7E6L` and started local Metro bundler (`localhost:8081` + `adb reverse`). Live `com.hamim.budgetapp` untouched.
- **0a Tokens (`src/theme/tokens.ts`, `src/theme/categoryColors.ts`, `src/ui/motion.ts`):** Added ESB Studio inspired 3-layer surfaces (`bg`/`surface`/`surfaceRaised`/`surfaceSunken`), multi-layer `boxShadow` elevation (`e1`/`e2`/`e3`) across `light`, `dark`, and `black`, `radius.card = 20`, `screenMargin = 16`, Hind Siliguri Bengali font map + zero `letterSpacing` helper, soft tinted category tile backgrounds, and Reanimated 4 stagger/layout transitions (`40ms` step).
- **0b Core Components & Tab Bar (`src/ui/*`, `src/app/(tabs)/_layout.tsx`, `src/app/dev/gallery.tsx`):**
  - Updated `Surface`, `HeroCard`, `Button`, `Chip`, `SegmentedControl`, `ListRow`, `IconTile`, `Money` (count-up animation), `Field` (Bangla font switch), `Sheet`, `Toast`, `IconButton`, and `V2TabBar` (`surface` background, `accentSoft` active icon pill, `accent` `+` squircle).
  - Visual check on S24 Ultra in Light + Dark + Bangla sample in `dev/gallery.tsx`: crisp 3-step elevation separation (`Sunken` -> `e1` -> `e2` -> `e3`), Hind Siliguri rendering cleanly with zero metric fallback, vibrant swatches, zero Dev Client warning overlay after removing redundant `statusBarTranslucent`/`navigationBarTranslucent` props on `KeyboardProvider`.
- **0c Keyboard Behaviour (`app.config.ts`, `Sheet.tsx`, `Screen.tsx`, `FastTransactionEntry.tsx`, `transaction/new.tsx`, `transaction/[id].tsx`, `transfer/[id].tsx`, `quick-entry.tsx`):**
  - **Phone Bug Found & Fixed:** Opening `Example Bottom Sheet` in `dev/gallery.tsx` and focusing the `Field` input (`gallery-sheet-field`) revealed `KeyboardAwareScrollView` inside `KeyboardAvoidingView` (`behavior="padding"`) inside an Android `Modal` double-offset scroll position, clipping the Sheet body above the viewport (`bottom < top` in `uiautomator` bounds). Replaced the inner scroller in `Sheet.tsx` with plain `ScrollView` + `flexShrink: 1` on `sheetInner`, leaving `KeyboardAvoidingView` (`behavior="padding"`) to lift the sheet cleanly above the soft keyboard. Re-verified visually on S24 Ultra (`sheet-keyboard-light-fixed.png`): heading, copy, focused input, and `"Got it"` CTA all sit clearly above the keyboard.
  - Replaced `'react-native'` `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`) with `'react-native-keyboard-controller'` `KeyboardAvoidingView` (`behavior="padding"`) in `transaction/new.tsx`, `transaction/[id].tsx`, `transfer/[id].tsx`, and `quick-entry.tsx`.
  - Passed `animate={false}` on `FastTransactionEntry` live keypad `<Money>` so typing digits updates instantaneously without `act()` warnings or 400ms lag.
- **Checks after final edit:** `npm run typecheck` (0 errors), `npx expo lint` (0 errors, 1 pre-existing warning in `src/app/wallets/[id].tsx`), `npm test` (26/26 suites, 153/153 tests pass).

## Page 1: Onboarding — All 7 Steps (2026-11-14)
- **Live EN/BN Language Toggle Reactivity (`app.config.ts`, `src/i18n/index.ts`, `src/theme/ThemeProvider.tsx`, `src/app/onboarding/index.tsx`):**
  - Tapping `বাংলা` on Welcome initially highlighted the pill while keeping screen copy in English because `experiments.reactCompiler: true` memoized `t(...)` calls against non-reactive module state. Disabled `reactCompiler` in `app.config.ts`, added `useSyncExternalStore`-backed `useLocale()` in `src/i18n/index.ts`, included `locale` in `ThemeProvider` context deps, and synced `onboardingStore.language` with `locale` in `src/app/onboarding/index.tsx` so cold-starting in Bangla also highlights the `বাংলা` chip accurately.
- **Sample Daybook Surface Corners & Step Progress Bar (`src/ui/Surface.tsx`, `src/ui/OnboardingHeader.tsx`):**
  - Split `Surface` outer shadow/radius container from an inner `overflow: 'hidden'` clip view so child banners (`TODAY · SAMPLE DAYBOOK` on Step 1 and `OPENING STATEMENT` on Step 7) honor 20dp rounded top corners cleanly.
  - Updated active chapter pill and selected `English | বাংলা` pill to `accent` / `onAccent` + `e1` elevation, and added `ScrollView` auto-scroll on active chapter `onLayout` so Steps 6–7 stay scrolled into view.
- **Android 15/16 Fabric Word-Clip & SettingsRow 2-Line Truncation (`src/ui/AppText.tsx`, `src/theme/tokens.ts`, `src/ui/SettingsRow.tsx`):**
  - Added `textBreakStrategy="simple"` in `AppText.tsx` and removed negative `letterSpacing` on `headline` and `bodyStrong` in `src/theme/tokens.ts`, resolving Android Fabric last-word clipping (`TODAY · SAMPLE [DAYBOOK]` and `Open my [notebook]`). Verified Bengali rendering cleanly on device without forcing synthetic line-height multiplication (which regressed 1-line button/pill widths).
  - Removed `numberOfLines={2}` clipping on `SettingsRow` subtitles so Step 5 (`"Notifications stay strictly private — we never show monetary amounts on your lock screen."`) renders all 3 lines in full.
- **Steps 1–7 Walk on S24 Ultra (`com.hamim.budgetapp.dev`):**
  - Verified Light (`step2-light.png`), Dark, Bangla (`step1-bn-clean.png`), and keyboard avoidance across Owner Name (`step2-keyboard.png`), Monthly Budget (`step3-keyboard.png`: `৳30,000` -> `৳1,764.70` safe today across 17 days), and Wallet Balances (`step6-keyboard.png`: Cash `৳3,500` + bKash `৳4,200` + Card `৳8,500` = `৳16,200` across 3 wallets). Completed Step 7 into Home.
- **Checks after final edit:** `npm run typecheck` (0 errors), `npx expo lint` (0 errors, 1 pre-existing warning), `npm test` (26/26 suites, 153/153 tests PASS).
