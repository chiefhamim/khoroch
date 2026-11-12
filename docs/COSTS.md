# Usage & Infrastructure Cost Breakdown

This document implements **SPEC §19.3** (Usage and infrastructure reporting).

---

## Summary: v1 Cost = $0 / Month (100% Local)

In **v1**, Budget App makes **zero network calls** at runtime and uses **no paid services, servers, proxies, analytics SDKs, or cloud AI APIs**. Everything needed for full daily budgeting works offline on the user's device.

| Capability | Where it runs in v1 | Network used? | Recurring cost |
| :--- | :--- | :--- | :--- |
| Transactions, budgets & category database | Local SQLite (`expo-sqlite`) / browser IndexedDB WASM on web | **No** | **$0** |
| Money math, comparisons & Insights engine | On-device TypeScript (`src/domain/*`) | **No** | **$0** |
| Quick Entry sentence parser (`"350 taka lunch"`) | Local regex + dictionary parser (`src/voice/parser.ts`) | **No** | **$0** |
| Microphone voice recognition *(optional dev build)* | OS on-device / platform speech recognizer via `expo-speech-recognition` | Handled by OS speech service when installed | **$0** (OS API) |
| Daily check-in reminders | Local scheduled OS notifications (`expo-notifications`) | **No** | **$0** |
| Fonts & icons | Bundled via `@expo-google-fonts/inter` & `@expo/vector-icons` | **No** (at runtime) | **$0** |
| Crash/analytics telemetry | None installed | **No** | **$0** |

> Because v1 never relies on internet connectivity or remote APIs, onboarding, transaction creation, budget tracking, Insights, and local reminders keep working seamlessly in airplane mode or spotty mobile networks.

---

## Optional Infrastructure & Cost Drivers Planned for v2

None of the services below are active in v1. If/when v2 capabilities are enabled, each introduces the dependencies and cost drivers documented below:

### 1. Natural-Language AI Fallback / Smart Insights (Optional in v2)
- **What it would do:** Handle complex conversational transcripts (`"split 1200 dinner with two friends"`) or natural-language queries that go beyond the local deterministic parser.
- **Components required:**
  - LLM API (e.g., **Google Gemini API**) — **never embedded directly in the mobile client**, always kept behind a thin stateless proxy.
  - Serverless API proxy (e.g., **Cloudflare Workers**) with rate limiting and authentication.
- **Free vs Paid Tiers (estimate / check current provider pricing before enabling):**
  - *Gemini API:* Free tier with strict RPM/RPD rate limits for development; pay-per-token billing on higher quotas or commercial use.
  - *Cloudflare Workers:* Generous free tier (e.g., 100k requests/day); paid plan starts around $5/month if exceeded.
- **Cost drivers:** Number of monthly active users × daily voice/AI parses per user × average prompt + response token count. Using local deterministic parsing first (v1 `src/voice/parser.ts`) avoids sending simple phrases like `"350 taka lunch"` to an AI API at all, cutting potential v2 AI volume dramatically.
- **Graceful offline fallback:** App must continue falling back to the local parser whenever offline or when quota/network errors occur (no infinite retry loops).

### 2. Automated Cloud Builds & OTA JS Updates (Optional for Distribution)
- **What it would do:** Build standalone Android `.apk`/`.aab` or iOS builds in the cloud (`EAS Build`) and push hotfixes (`EAS Update`).
- **Free vs Paid Tiers:** Expo EAS offers a free starter tier with monthly build/update limits; paid plans apply for higher build concurrency or bandwidth.
- **Alternative ($0):** Local Android Gradle / Android Studio build (`npx expo prebuild --platform android` + Gradle) on the developer's machine requires zero SaaS fee.

### 3. Encrypted Cloud Backup / Multi-Device Sync (Optional in v2)
- **What it would do:** Sync local SQLite snapshots across devices or recover after phone loss.
- **Cost drivers:** Storage size per user + database read/write operations + bandwidth (e.g., object storage / Supabase / Cloudflare D1/R2 — each has free starter tiers and usage-based paid tiers).
- **Alternative ($0):** Manual JSON/CSV file export to the phone's Downloads/Drive folder (scheduled for v2 without recurring server cost).

### 4. Local-Only App Lock & Encrypted Storage (v2)
- **Dependencies:** `expo-local-authentication` / SQLCipher — **100% on-device, $0 recurring cost**.
