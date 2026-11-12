# START HERE — for you (the human), not the agent

This folder is a ready-to-run overnight build for AGY (Antigravity). The plan lives in files, not in the chat, so if the agent's context resets it just re-reads them and carries on.

```
budget-app/
├─ START-HERE.md            ← you are here
├─ AGENTS.md                ← the agent's rules (Antigravity/Gemini read this)
├─ GEMINI.md                ← pointer to AGENTS.md (for Gemini-based tools)
├─ .agent/rules/            ← Antigravity always-on workspace rule → "read AGENTS.md"
├─ docs/
│  ├─ SPEC.md               ← ChatGPT's full spec + YOUR DECISIONS block on top (overrides it)
│  ├─ ARCHITECTURE.md       ← folders, DB schema, calc API, design tokens
│  ├─ TEST-CASES.md         ← exact numbers the maths/parser must produce
│  ├─ PROGRESS.md           ← 7 phases (0–6) with "Done when" + the agent's log
│  └─ DECISIONS-LOG.md      ← where the agent writes choices instead of waking you
└─ src/app/                 ← clean Expo SDK 58 baseline (typecheck passes)
```

## 1. Before you go to bed (5 minutes)

**In Antigravity settings** (names can differ slightly by version):
- Terminal command auto-execution → **Always proceed / Turbo**
- Agent review policy → **Always proceed** (otherwise it stops at the first "approve this plan?")
- Allow the agent's browser to open `localhost` (it uses the web preview to check screens)
- Pick your strongest model and **Planning** mode (not Fast)

**Keep the PC awake** (run in PowerShell; undo commands in the morning section):
```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```
Keep it plugged in and online. Leave Antigravity open.

## 2. Kick it off

Open the **`budget-app` folder** as the workspace in Antigravity (File → Open Folder → `Desktop\budget-app`), start a new agent conversation, and paste this:

```
Read AGENTS.md, then docs/PROGRESS.md, docs/SPEC.md, docs/ARCHITECTURE.md and docs/TEST-CASES.md in full.

Then start at the first unfinished phase in docs/PROGRESS.md and keep going through every phase,
following AGENTS.md exactly: re-read the listed SPEC sections at the start of each phase, verify
"Done when" by actually running the checks, commit after each phase, then continue to the next.

I am asleep until morning. Do not ask me anything and do not wait for approval. Log your own
decisions in docs/DECISIONS-LOG.md. If something fails 3 times, mark it BLOCKED and move on.
Stop only when every phase is done or blocked, then write the Morning summary in docs/PROGRESS.md.
```

If it stops partway through the night anyway (it happens), the same prompt resumes it. It picks up from PROGRESS.md and `git log`.

## 3. In the morning, check in this order

1. `git log --oneline`: you want one commit per phase. Zero commits means it got stuck early.
2. `docs/PROGRESS.md` → **Morning summary**, then any `BLOCKED:` lines.
3. `docs/DECISIONS-LOG.md`: anything you disagree with? Tell it to change it.
4. Run the tests yourself: `npm test` and `npm run typecheck` in the folder.
5. **Try it on your phone:** install **Expo Go** from the Play Store, then in the folder run `npx expo start`, and scan the QR with Expo Go (phone and PC on the same Wi-Fi). Add an expense, kill the app, reopen it, and check that the expense and totals are still right.
6. Go through `docs/PHONE-TEST.md` (the agent writes it in Phase 6).

Realistic expectation: Phases 0–3 done properly, maybe 4. If it claims everything is perfect, test it harder.

Turn sleep back on (30 minutes is the usual desktop default; use your own number if it was different):
```powershell
powercfg /change standby-timeout-ac 30
```

## 4. What's deliberately NOT in v1
No cloud AI (Gemini/Hydrogen), no accounts/transfers, no recurring, no export/backup, no encryption/app lock, no Bangla UI. These are listed in SPEC → DECISIONS → "NOT in v1". Voice uses a local parser, so "350 taka lunch" works offline and costs nothing. The mic button only appears on a development build (Expo Go doesn't include speech recognition), and typing the same sentence works everywhere.

When v1 is solid, the next step is a v2 plan: add Gemini behind a Cloudflare Worker proxy, plus accounts, recurring and export.
