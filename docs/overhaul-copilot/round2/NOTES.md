# Round 2 phone review

## Step 1

The hero and wallet row now use a clearly raised taka glyph at about 60% of the number size, with a visible hairline gap. The glyph is still visually heavier than the Manrope digits at small sizes, but it reads as a currency mark rather than a lowercase letter.

The People screen was used for the list-row check, and Home was used for the hero check. Negative amounts retain a true minus before the raised mark; keypad coverage is checked in Step 2.

## Step 2

The fast entry screen is materially simpler: amount, one chip row, collapsed note, always-visible keypad, and two save actions. The wallet chip now opens the wallet picker and the note row accepts text instead of being decorative.

The seven-entry walkthrough is not yet complete; the remaining phone work is to enter seven back-dated expenses across three days and two wallets, count taps per entry, and record the measured counts here.

## Step 3

The date picker is a custom bottom sheet with a horizontal day strip and no Android wheel or clock dialog. The visible sheet has strong hierarchy and a solid action button.

The month grid and exact-time state still need a separate phone capture and visual pass; the current date-sheet screenshot does not prove those states.

## Step 4

The wallet editor now presents the opening balance as a first-class amount with an in-sheet keypad and an as-of date. The Wallets list has an explicit starting-balance action for zero-balance wallets.

Wallet detail now has an Adjust balance action that records the difference as a dated income or expense adjustment, while opening-balance editing remains separate.

## Step 5

Home, Wallets, Settings, the appearance sheet, and the fast-entry sheet were reviewed on the dev phone in light mode. The flat surfaces, restrained borders, solid hero, and accent icons read as a deliberate system rather than a recolour.

Settings and the appearance sheet were also reviewed in dark mode. Contrast is usable, but the dark appearance screenshot was taken with the modal scrim active, so it is not a clean full-screen dark-mode pair for every route.

## Step 6

The wallet opening-balance editor and transaction note input are keyboard-capable and use the app's keyboard-aware form primitives. A complete keyboard screenshot matrix for every text-input sheet was not completed; this remains listed as not done in the final report.

## Verification

`npm run typecheck`, the full Jest suite (24 suites, 146 tests), and the web export pass. Expo lint has no errors and retains the existing wallet-detail hook warning. The Android debug build passed with `scripts/short-cxx-paths.gradle`; the standard Gradle invocation still hits the Windows Ninja path-length failure.

## Live phone review

The dev APK was installed after verifying `com.hamim.budgetapp.dev`, and only that package was launched. The live Home and keypad-first Add transaction screens were captured and reviewed. Metro was already running on port 8081 and the phone used `adb reverse tcp:8081 tcp:8081`.

The dev app theme was restored to System after the visual review.
