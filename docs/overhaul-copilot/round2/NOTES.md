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

The requested Adjust balance action is not implemented yet; the current editor changes the opening balance rather than recording a separate adjustment entry. This remains a known gap for the final report.

## Verification

`npm run typecheck`, the full Jest suite (24 suites, 146 tests), and the web export pass. Expo lint has no errors and retains the existing wallet-detail hook warning. The current Android debug and release builds are blocked by a Windows Ninja/CMake failure while compiling React Native Reanimated because it cannot create a deeply nested object directory.
