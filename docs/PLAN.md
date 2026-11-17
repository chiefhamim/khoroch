# Khoroch Orchestration and Build Plan

Status: DRAFT for owner approval. No code until Phase 6 is approved.

## Brief
Personal finance app, personal use first (business ledger/baki later). It replaces the paper tally-book and manual typing: fast capture, secure, almost no work for the user. Differentiators: UI aesthetics and functionality. Audience: day labourer to CEO. Android first; must run smoothly on phones about 10 years old.

## Baseline (2026-11-17)
- `origin/main` d68d8b7 = prod build (installed 16 Nov 03:08). `origin/dev` 3697564 = dev app. They have diverged by one commit each; reconcile before new work.
- Default branch on GitHub is stale `master`; fix it later, with owner OK.

## Harness roles
| Role | Model | Where |
|---|---|---|
| Planner | Fable (main session, short outputs) | session |
| researcher x N parallel | Sonnet | .claude/agents/researcher.md |
| bulk-worker | Haiku | .claude/agents/bulk-worker.md |
| builder | Sonnet | .claude/agents/builder.md |
| reviewer (read-only) | Opus | .claude/agents/reviewer.md |
| device check | planner session via adb, dev app only | - |

Rules: subagents get only their prompt, so the planner passes paths and decisions explicitly. Builders never push, merge or touch the real app. Every build task goes builder -> reviewer (PASS required) -> phone check -> owner OK.

## Blocking decision: minimum Android version
RN 0.88 / Expo 58 floor is minSdk 24 (Android 7.0, Aug 2016). Phones from 2015 run Android 5/6 and cannot install it. Options:
A. Keep minSdk 24: covers late-2016+ phones; keeps all work done so far.
B. Downgrade to an old RN/Expo to reach minSdk 21: large rewrite risk, loses new-arch/libs.
C. Native Kotlin rewrite for minSdk 21: best performance, discards the existing app.
Recommendation: A, plus a hard performance budget below. Owner decides.

## Performance budget (to be measured on lowest available device)
- APK/AAB: ship per-ABI split or AAB; target under 40 MB per device (current release APK 171 MB).
- Cold start under 3 s on a 2 GB RAM / Android 7 device; idle RAM under 150 MB.
- Scroll lists at 60 fps with 5,000 entries; no blur/glass on list rows; reduce-motion fallback.
- Fully offline, SQLite local; all heavy work off the JS thread.

## Phases (owner gate after each)
1. Research (no code): segments in parallel to docs/research/: jobs (day labourer, rickshaw/CNG, garment, farmer, teacher, govt, freelancer, remittance family, executive), businesses (grocery/dokan with baki, pharmacy, tea stall, tailor, wholesaler, transport, online seller, small manufacturing), payment channels (cash, bKash/Nagad/Rocket, banks, samity/DPS, dena-pawna, loans).
2. Synthesis: persona x money-flow x fastest-input matrix; MVP cut for personal use; business ledger parked as v2.
3. Capture design: quick-add templates, one-hand numpad, voice entry (Bangla), repeat entries, SMS parsing of bKash/Nagad/bank messages (on-device only, opt-in; check Google Play SMS permission policy), receipts later.
4. Insights spec: infographics per persona (where money went, trend, safe-to-spend, who owes me, bills due, goals) with plain-language advice; honest empty/small-data states.
5. Security and sync spec: local encryption/app lock, backup/export, optional cloud sync/backup (design only; options and cost).
6. Gated build on dev in small increments; reviewer PASS + phone check before each next step.

## Budget
Fable (planner) use is small; cap each phase and report token/cost use at its end. Research and bulk work go to Sonnet/Haiku.
