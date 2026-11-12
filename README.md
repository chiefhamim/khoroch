# Budget App

A local-first personal budget companion for Android (Expo SDK 58, TypeScript, Expo Router, SQLite).
Know where your money goes, log an expense in under 10 seconds (tap or "350 taka lunch"), and see how much is safe to spend today.

- **Humans:** read `START-HERE.md`.
- **Coding agents:** read `AGENTS.md` first, then `docs/PROGRESS.md`.

## Run
```bash
npm install
npx expo start          # scan the QR with Expo Go on Android
npm test                # unit + component tests
npm run typecheck
```

## Docs
- `docs/SPEC.md`: product spec (DECISIONS block on top is authoritative)
- `docs/ARCHITECTURE.md`: structure, schema, calc API, tokens
- `docs/TEST-CASES.md`: exact expected numbers
- `docs/PROGRESS.md`: build phases + log
- `docs/DECISIONS-LOG.md`: decisions made during the build
