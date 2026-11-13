# AGENTS.md — standing rules for the coding agent (READ FIRST, EVERY TIME)

You are building **Budget App**, a local-first personal budget app (Expo / React Native, Android first).
You are working **unattended overnight. The user is asleep.** Nobody will answer questions until morning.

## 0. Where everything is

| File | What it is | When to read it |
|---|---|---|
| `AGENTS.md` (this file) | Rules of work | Start of session, and again at the start of every phase |
| `docs/SPEC.md` | Product spec. **Source of truth.** Its `DECISIONS` block overrides everything below it | The DECISIONS block + the sections listed for the current phase, at the start of every phase |
| `docs/ARCHITECTURE.md` | Folder layout, DB schema, module boundaries, calc API | Start of every phase |
| `docs/TEST-CASES.md` | Exact numeric test cases for money/calc/parser | Phases 1, 3, 4, 5 |
| `docs/PROGRESS.md` | Phase checklist + your log. **Your memory.** | Start of session, start and end of every phase |
| `docs/DECISIONS-LOG.md` | Decisions YOU made without the user | Append whenever you choose something not in SPEC |
| `docs/ui-overhaul/DESIGN.md` + `mockup.html` | **v1.1 UI overhaul spec** (overrides SPEC §3 visuals + ARCHITECTURE §6 tokens) | Every phase from Phase 7 on |

## 1. The loop (follow exactly)

```
START OF SESSION / AFTER ANY CONTEXT RESET:
  read AGENTS.md, docs/PROGRESS.md, `git log --oneline -15`, `git status`
  -> find the first phase that is not [x] and not fully BLOCKED -> that is the current phase
  -> if `git status` shows uncommitted work, inspect it and continue it (do not discard it)

FOR EACH PHASE:
  1. Re-read: AGENTS.md, SPEC DECISIONS block, the SPEC sections listed for the phase,
     docs/ARCHITECTURE.md, and the phase's tasks in PROGRESS.md. Do NOT rely on memory of the spec.
  2. Mark the phase "[~] in progress" in PROGRESS.md.
  3. Implement the tasks, one at a time.
  4. Verify every "Done when" item by ACTUALLY RUNNING it (see section 3).
  5. Fix failures. Re-run. Repeat.
  6. Mark [x], append a Log entry, `git add -A` and `git commit -m "Phase N: <summary>"`.
  7. Go straight to the next phase. Do not wait for the user.

STOP when every phase is [x] or the remaining ones are BLOCKED.
Then write the "Morning summary" at the bottom of PROGRESS.md.
```

## 2. Hard rules

1. **One phase at a time, in order.** Never start phase N+1 before phase N's "Done when" is verified.
2. **Never ask the user anything.** If something is unclear, pick the simplest option consistent with SPEC + DECISIONS, write it in `docs/DECISIONS-LOG.md`, and continue.
3. **3-strike rule.** If the same problem fails 3 attempts, write it in PROGRESS.md as `BLOCKED: <what, error text, what you tried>`, then continue with work that does not depend on it. A blocked task does not block the whole phase unless the phase literally cannot function without it.
4. **Never fake anything.** Do not mark done what you did not run. No fake tests, no `it.skip` to go green, no hard-coded numbers on screens, no invented screenshots, no "should work". If you could not verify, say "NOT VERIFIED" and why.
5. **Do not build v2 items** (listed in SPEC DECISIONS → "NOT in v1"). Not even "quickly".
6. **Money is integer minor units** (poisha). No floats anywhere in money math. All totals come from `src/domain/calc.ts`. UI components never sum money themselves.
7. **Stay inside this folder.** Do not touch files outside `budget-app/`. Do not install global tools. Do not change OS settings.
8. **No secrets, no network services, no accounts.** No API keys, no EAS login, no cloud AI, no backend. Do not `git push` (there is no remote; do not add one).
9. **Keep the type check and tests green at every commit.** `npm run typecheck` and `npm test` must pass before each commit.
10. **Don't rewrite the plan.** You may append to PROGRESS.md Log, DECISIONS-LOG.md, and tick boxes. Do not delete phases, tasks, or "Done when" criteria. Do not edit SPEC.md or AGENTS.md.

## 3. How to verify (what tools you actually have tonight)

This PC (Windows 11, PowerShell) has: Node 26, npm, git, Java 21, and **(since v1.0) the Android SDK** at `%LOCALAPPDATA%\Android\Sdk` with `adb`. There is no emulator. The owner's **Galaxy S25 Ultra** may be reachable over wireless ADB. **Read §6 before touching it.** Web checks below remain the baseline, and the phone is an extra check when it's reachable:

- **Type check:** `npm run typecheck` (= `tsc --noEmit`). Must exit 0.
- **Lint:** `npx expo lint`. Fix errors; warnings are OK if logged.
- **Unit tests:** `npm test` (jest-expo, set up in Phase 1). Must exit 0, no skipped tests.
- **Bundle check:** `npx expo export --platform web --output-dir dist-check` must succeed. Delete `dist-check/` afterwards (it is git-ignored anyway).
- **Visual check:** run the web build in your browser:
  - Start the dev server **as a background process** (it never exits on its own): `$env:CI="1"; npx expo start --web --port 8081`
  - Open `http://localhost:8081`. Check at phone viewport sizes **360×800, 390×844, 430×932**, light and dark.
  - If your browser tool can save screenshots, save them to `docs/screenshots/phase-N/<screen>-<width>-<theme>.png`. If it cannot, write what you checked in the Log. Never claim screenshots you did not take.
  - Stop the dev server when done with it. Never leave two servers fighting over port 8081.
- Native-only features (notifications, speech, haptics, date/time dialogs) stay behind `Platform.OS` / availability guards with web fallbacks. Verify them on the phone (§6) when it's reachable. Otherwise list them under "Needs phone test".

### Command hygiene (Windows, unattended)
- Always set `$env:CI="1"` before `expo` commands so nothing waits for keyboard input.
- Never run interactive commands (anything that asks Y/n, opens an editor, or a `readline` prompt).
- Long-running commands (dev server, watchers) → background only. Tests → `npm test` (configured with `--watchAll=false`).
- If a port is busy, find and stop your own old server rather than picking random ports.

## 4. Expo has changed — do not trust your training data

This project is **Expo SDK 58** (`expo ~58.0.x`, React Native 0.88, React 19.3, TypeScript 6). APIs you remember may be renamed, moved, or removed.

1. Before using any Expo / React Native API, fetch the versioned docs: `https://docs.expo.dev/versions/v58.0.0/`
2. Index of all Expo docs + corrections to common LLM mistakes: `https://docs.expo.dev/llms.txt`
3. **Install packages with `npx expo install <pkg>`** (never plain `npm install <pkg>`) so versions match SDK 58.
4. `npx expo-doctor` diagnoses dependency problems; `npx expo install --fix` repairs versions.

Rules:
- Expo Router; routes live in `src/app/` only. Every file there is a screen. Non-route code lives elsewhere in `src/` (see ARCHITECTURE.md).
- No `ios/` or `android/` folders. Configure native behaviour through `app.json` + config plugins only.
- Expo Go only has its bundled native modules. Prefer modules that work in Expo Go. Anything needing a development build must degrade gracefully (see SPEC DECISIONS → voice).
- `@/*` resolves to `src/*` (tsconfig paths).

## 5. Quality bar reminders (from SPEC, the ones agents usually skip)
- Every button, filter, toggle on screen must work. If it cannot work yet, it must not be on screen.
- Spacing only from tokens (`src/theme/tokens.ts`). No magic numbers in StyleSheets except `0`, `1` (hairlines), and flex values.
- Amounts use tabular numerals (`fontVariant: ['tabular-nums']`).
- All user-visible strings go through `t()` (`src/i18n`).
- Every tappable element: `accessibilityRole` + `accessibilityLabel`, min 48dp touch target.
- Lock-screen notifications never contain amounts.

## 6. The owner's phone — rules (v1.1 onward)

The phone at `$PHONE` (the address is given in the kickoff prompt, e.g. `192.168.0.154:45999`) is the owner's **daily phone with their REAL budget data** in `com.hamim.budgetapp`. Treat that data as irreplaceable: release builds are not debuggable, so there is no backup.

**Never, under any circumstances:**
- `adb uninstall`, `pm clear`, `pm uninstall`, `adb install` without `-r`, `-d` downgrades, or anything that wipes app data
- Call "Delete all data", "Clear sample data", or "Load sample data" on the phone
- Write a migration that drops, renames or recreates a table that holds data. Migrations are **additive only** (`ALTER TABLE … ADD COLUMN`, `INSERT … WHERE NOT EXISTS`) and must be tested on a v1-shaped DB first
- Change phone system settings (display, dark mode, font size, developer options, wifi), or try to unlock a locked phone
- Leave test data behind. The only allowed test entry is one transaction named exactly `UI TEST – delete me`, deleted right after checking it

**If `adb install -r` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (signature mismatch): STOP all phone work, mark it BLOCKED, and never uninstall to "fix" it.**

**Connect:** `adb connect $PHONE`, then `adb devices`. The phone is normally reached over **Tailscale** (`100.120.102.83:5555`, enabled by the owner with `adb tcpip 5555` over USB; it's relayed, so expect slow installs and allow 5+ minutes). On home Wi-Fi it may instead be a wireless-debugging address. If the connection drops, retry `adb connect` up to 3 times over a few minutes, then continue web-only. The port reset after a phone reboot can't be fixed from here. If it doesn't connect, or the phone is locked (a screenshot is black, or `dumpsys window` shows focus on `NotificationShade`/keyguard), skip the phone, continue web-only, and note it in the Log. Always pass `-s $PHONE`.

**Build & install** (`android/` is generated by prebuild, git-ignored, never hand-edited; signing uses the template `debug.keystore` for both debug and release, so builds install over each other with data kept):
```powershell
$env:CI="1"; npx expo prebuild -p android          # after adding/removing native modules (no --clean unless it fails)
cd android; .\gradlew.bat assembleDebug; cd ..      # dev build: loads JS from Metro (live reload)
adb -s $PHONE install -r android\app\build\outputs\apk\debug\app-debug.apk
adb -s $PHONE reverse tcp:8081 tcp:8081             # then run Metro in the background: npx expo start --port 8081
# final build in Phase 13 only:
cd android; .\gradlew.bat assembleRelease; cd ..
adb -s $PHONE install -r android\app\build\outputs\apk\release\app-release.apk
```
Launch: `adb -s $PHONE shell monkey -p com.hamim.budgetapp -c android.intent.category.LAUNCHER 1`

**Screenshots:** don't use `adb exec-out screencap > file` in PowerShell, because it corrupts the PNG. Use:
`adb -s $PHONE shell screencap -p /sdcard/ui.png; adb -s $PHONE pull /sdcard/ui.png docs\ui-overhaul\after\phase-N\<screen>-<theme>.png`
Then **look at every screenshot** and compare it with `mockup.html`.

**Tapping:** the screen is 1440×3120 px at density 560 (1 dp = 3.5 px). Find elements with `adb -s $PHONE shell uiautomator dump /sdcard/ui.xml` and pull it, then tap the centre of the element's bounds (`adb shell input tap x y`). Don't guess coordinates. Switch themes through the app's own Settings → Appearance, and set it back to **System** when done.
