---
trigger: always_on
---

# Always-on workspace rule

Before doing anything in this workspace, read `AGENTS.md` at the project root in full and follow it.
Then read `docs/PROGRESS.md` to find the current phase.

- `docs/SPEC.md` is the source of truth (its DECISIONS block overrides the rest of it).
- Re-read `AGENTS.md`, the SPEC DECISIONS block, and the SPEC sections listed for the phase at the START of every phase. Do not work from memory.
- One phase at a time, in order. Verify by actually running typecheck/tests/web preview. Commit after each phase.
- The user is asleep: never ask questions, never wait for approval. Log decisions in `docs/DECISIONS-LOG.md`. 3 failed attempts on the same problem → mark BLOCKED in PROGRESS.md and move on.
- Never fake results. Never build items listed as "NOT in v1".
