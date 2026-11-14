# Round 2 overhaul report

## Implemented

- The taka sign now uses Hind Siliguri semibold at roughly 60% of the numeric font size, raised to the digit cap height with a hairline gap.
- Add transaction is keypad-first with a large amount, one row of Category, Wallet, and When chips, collapsed note input, and `Save + add another`.
- The wallet chip opens the wallet picker and the date chip opens the custom `DateTimeSheet`.
- Wallet setup exposes opening balance and an as-of date. Zero-balance wallets expose `Set starting balance`.
- Wallet detail includes `Adjust balance`, recording the difference as an income or expense entry.
- Home, People, Wallets, Settings, appearance, date sheet, wallet editor, and fast-entry screens were reviewed on the dev phone. The final live Add transaction keyboard state is captured in `round2/step6-keyboard-note-final.png`.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --runInBand`: 24 suites, 146 tests passed.
- `npx expo lint`: 0 errors, 1 pre-existing warning in `src/app/wallets/[id].tsx`.
- `npx expo export --platform web --output-dir dist-check`: passed; output removed.
- Android debug build passed with `scripts/short-cxx-paths.gradle`.
- Verified `applicationId 'com.hamim.budgetapp.dev'`.
- Installed with `adb install -r` and launched only `com.hamim.budgetapp.dev`.
- Fresh Metro was started on port 8081 after stopping the stale listener; the phone used `adb reverse tcp:8081 tcp:8081`.

## Remaining gaps

- The seven-entry, three-day/two-wallet timed walkthrough and measured tap counts were not completed.
- The full light/dark screenshot matrix and keyboard-open sheet matrix were not completed.
- The month-grid and exact-time DateTimeSheet states were not separately captured; the visible day-strip state was verified.
- The dev phone theme was restored to System after review.

The owner package `com.hamim.budgetapp` was not installed, launched, cleared, or modified.
