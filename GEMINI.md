# GEMINI.md

The rules for this project live in **`AGENTS.md`**. Read it now, in full, and follow it.
Then read `docs/PROGRESS.md` to find where you are.

Short version (if you read nothing else):
- `docs/SPEC.md` is the source of truth; its DECISIONS block overrides the rest.
- `docs/PROGRESS.md` is your checklist and memory. One phase at a time. Re-read the listed SPEC sections at the start of each phase.
- Verify by actually running typecheck, tests, and the web preview. Commit after each phase.
- Never ask the user questions (they are asleep). Log decisions in `docs/DECISIONS-LOG.md`. 3 failed attempts → mark BLOCKED, move on.
- Never fake results. Never build "NOT in v1" items.
