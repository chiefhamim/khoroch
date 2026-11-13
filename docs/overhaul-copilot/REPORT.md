# UI and input overhaul report

## What changed

1. Replaced Plus Jakarta Sans in the app UI with Manrope 400–700. Hind Siliguri remains the dedicated taka glyph font.
2. Added a raised, smaller taka sign in `Money`, with no gap before the amount and consistent negative formatting.
3. Replaced native Android and iOS date/time dialogs with `DateTimeSheet`: recent day strip, earlier month grid, part-of-day choices, and exact time columns.
4. Added `react-native-keyboard-controller`, `KeyboardProvider`, and keyboard-aware scrolling for forms and sheets.
5. Simplified People detail actions to `I gave` and `I got`, mapped to the existing due kinds without changing the database schema.
6. Simplified the People list by removing the open/settled segmented control and placing settled people under a quiet section.
7. Added unit coverage for the gave/got mapping and updated UI tests for the intentional date picker and currency presentation changes.
8. Kept the existing keypad and fast-entry architecture intact so amount entry does not require the system keyboard.

## Font choice

Manrope was chosen over the existing Plus Jakarta Sans because its compact proportions and clearer numeral shapes read more cleanly in the hero amount and dense ledger rows. The taka sign is rendered separately with Hind Siliguri so the glyph remains stable across every font size.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --runInBand`: 24 suites, 146 tests passed.
- `npx expo lint`: 0 errors, 1 pre-existing warning in `src/app/wallets/[id].tsx`.
- `npx expo export --platform web --output-dir dist-check`: passed; output removed.
- Android release build: passed.
- Verified generated application id: `com.hamim.budgetapp.dev`.
- Installed with `adb install -r` to the dev package only.

## Phone check

The dev phone was reachable and the APK installed successfully. The device was locked after launch (`NotificationShade` / keyguard focused and sleeping), so the smoke screenshot was black and no visual screen review or timed walkthrough was claimed. No owner package or owner data was touched.

Not completed: the full light/dark screenshot matrix, keyboard-open screenshots for every sheet, and the seven-entry timed walkthrough require an unlocked dev phone.
