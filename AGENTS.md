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

This PC (Windows 11, PowerShell) has: Node 26, npm, git, Java 21.
It does **NOT** have the Android SDK, an Android emulator, or a connected phone. So:

- **Type check:** `npm run typecheck` (= `tsc --noEmit`). Must exit 0.
- **Lint:** `npx expo lint`. Fix errors; warnings are OK if logged.
- **Unit tests:** `npm test` (jest-expo, set up in Phase 1). Must exit 0, no skipped tests.
- **Bundle check:** `npx expo export --platform web --output-dir dist-check` must succeed. Delete `dist-check/` afterwards (it is git-ignored anyway).
- **Visual check:** run the web build in your browser:
  - Start the dev server **as a background process** (it never exits on its own): `$env:CI="1"; npx expo start --web --port 8081`
  - Open `http://localhost:8081`. Check at phone viewport sizes **360×800, 390×844, 430×932**, light and dark.
  - If your browser tool can save screenshots, save them to `docs/screenshots/phase-N/<screen>-<width>-<theme>.png`. If it cannot, write what you checked in the Log. Never claim screenshots you did not take.
  - Stop the dev server when done with it. Never leave two servers fighting over port 8081.
- **Android device testing is NOT possible tonight.** For anything that only works natively (notifications, speech recognition, haptics), build it behind a `Platform.OS` / availability guard, unit-test the logic, and list it under "Needs phone test" in the Morning summary.

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
