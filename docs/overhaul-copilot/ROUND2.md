# Round 2: the real overhaul (Copilot, read all of this first)

Round 1 (commit 8e11148) only did a light touch-up and skipped the visual work. The owner's verdict was "bruh". Screens look the same as before, Add transaction is unchanged, wallets still have no starting balance, and nothing was checked on the phone. This round fixes that.

The full brief is still `docs/overhaul-copilot/BRIEF.md`. Read it, then `AGENTS.md` §4b, §6 and §7. Every rule there still applies, especially:
- **Dev app only** (`com.hamim.budgetapp.dev`). Never install to, launch or touch `com.hamim.budgetapp`.
- Use `install -r` only. Never uninstall or `pm clear`.
- Migrations are additive only.
- No `...` or `…`, no three-dot icons, no dashed or dotted lines.
- No gradients, glow or glass.

The phone is `192.168.0.154:38657` (if that fails, run `adb mdns services`). It is unlocked and awake right now. If a screenshot comes back black, run `adb -s $PHONE shell input keyevent KEYCODE_WAKEUP` once, wait 2s, and retry. **Never try to unlock a PIN.** If it stays locked for 3 tries, stop and write BLOCKED in the report. Do **not** carry on building UI blind.

## How to work this round (mandatory)
Work in **steps**. For each step:
1. Make the change.
2. Use live reload for speed. Build a debug APK once with `APP_VARIANT=dev`, install it with `install -r`, run `adb -s $PHONE reverse tcp:8081 tcp:8081`, and run `npx expo start --port 8081` in the background. Check `android\app\build.gradle` says `com.hamim.budgetapp.dev` before every install.
3. Navigate to the screen on the phone using `uiautomator dump` bounds, not guessed coordinates.
4. Take a screenshot (`shell screencap -p /sdcard/ui.png` then `pull` to `docs/overhaul-copilot/round2/<step>-<screen>-<theme>.png`), **open and look at it**, and write 2–3 honest lines in `docs/overhaul-copilot/round2/NOTES.md` on what still looks weak. Fix it and re-shoot until it looks like a top-tier app.
5. Run typecheck and tests, then `git commit -m "Overhaul round 2 step N: <what>"`.

A step without a reviewed phone screenshot is **not done**.

## Steps, in order

**Step 1: ৳ sign.** Right now it is too small and reads like a "b". Make it about **58–62% of the digit size**, top-aligned to the digits' cap height, the same colour as the number, with a hairline gap after it. Use semibold in Hind Siliguri. For negatives, show a true minus (−) before the ৳, sized like the digits. Check the hero, a list row, and the keypad display.

**Step 2: Add transaction (the biggest complaint).** Rebuild `transaction/new.tsx`, `TransactionForm.tsx` and `Keypad.tsx`:
- A big amount at the top, with the keypad always visible.
- **One row of chips**: Category (recent 5 + All), Wallet (last used is preselected), and When (Today / Yesterday / opens `DateTimeSheet`).
- A collapsed "Add note" row.
- Two buttons: **Save** and **Save + add another**. The second keeps the date and wallet, resets the amount and category, and shows a small list of entries added in this session.
- Then add 7 back-dated sample expenses in the dev app across 3 days and 2 wallets, count the taps per entry (target ≤4 plus the amount), and write the result in NOTES.md.

**Step 3: DateTimeSheet.** Screenshot it open (the day strip, the month grid and exact time). It must look custom and modern, never like the Android wheel or clock. Polish until it does.

**Step 4: Wallet starting balance.**
- Wallet editor and onboarding: "How much is in <wallet> right now?" with the keypad and an as-of date.
- Wallets with no starting balance show an inline "Set starting balance" row on Home and the Wallets list.
- Wallet detail gets **Adjust balance**: you type the real balance and the difference is recorded as an adjustment (additive migration only if needed, with tests).

**Step 5: Visual redesign, one screen per sub-step**, light and dark each:
- (a) Home: answers "can spend today / in wallets / just spent". Solid accent hero card with strong type, and a chart that uses the accent colour, not grey.
- (b) Ledger
- (c) Plan + Insights
- (d) People + person detail
- (e) Wallets + wallet detail
- (f) Settings
- (g) Every sheet

Use one spacing scale, one radius per role, one icon size, and at most 4 text styles per screen, all from `tokens.ts`. Make it look **deliberately designed**: think Linear, Things 3 or Revolut's flat screens. The old layout with new colours is not acceptable.

**Step 6: Keyboard.** Open every text input and sheet with the keyboard up, take a screenshot, and confirm nothing is covered.

**Step 7: Final.**
- Build a release with `APP_VARIANT=dev` and `--init-script ..\scripts\short-cxx-paths.gradle`, and install it with `install -r` to the dev app.
- Run typecheck, lint and tests (no skips).
- Rewrite `docs/overhaul-copilot/REPORT.md` with before/after screenshot pairs per screen, the tap counts, and an honest list of anything not done.
- Switch the app's theme back to System (in-app Settings → Appearance). Delete any `UI TEST` entries you created only if they're in the dev app.

Never `git push`. Never touch the owner app.
