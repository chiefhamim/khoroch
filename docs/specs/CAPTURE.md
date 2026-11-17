# Capture design spec (PLAN phase 3)

Date: 2026-11-17. Status: DRAFT for owner approval. No code is changed by this document.

Scope: how an entry gets into Khoroch with the least work. Quick-add templates, the one-hand numpad, Bangla voice, repeat entries, SMS and notification capture, receipts (later).

Rules that bind every task here (from AGENTS.md): money is integer poisha; all totals come from `src/domain/calc.ts`; no network services and no accounts; no ellipsis dots in any user-visible text or i18n string; every tappable element has a role, a label and a 48dp target; nothing is saved without the user confirming; lock-screen notifications never contain amounts.

Evidence labels: SOURCED (URL and date read), CODE (file path, read today), HYPOTHESIS (reasoned, not measured), NOT VERIFIED (could not confirm).

## 1. Goals, non-goals and measurable targets

### Goals

1. The most common entry of each persona takes three taps or fewer from Home, in four seconds or less.
2. A new amount typed with the keypad takes the digits plus at most four other taps, in eight seconds or less.
3. Money that arrives by bKash, Nagad or a bank shows up as a draft the user confirms, without typing.
4. Everything works with no network. Voice is the one stated exception on old phones (section 5).
5. A wrong automatic entry is never saved. A parser that is unsure produces a draft that needs editing.

### Non-goals

- No cloud AI, no server, no account, no analytics on messages.
- No automatic saving of any entry, including SMS drafts and scheduled entries.
- No reading of the full SMS inbox in v1.
- No receipts, party ledgers or business features (parked in SYNTHESIS section 4).

### Targets per persona

The "top 3 entries" come from docs/SYNTHESIS.md section 1 and are HYPOTHESES. The targets are design goals. None has been measured. Task C15 measures them on the owner's phone.

Tap counting rule: start on Home, count every tap including Save. Typing a digit counts as one tap. Choosing a chip counts as one tap.

| Persona | Entry 1 | Entry 2 | Entry 3 | Target |
|---|---|---|---|---|
| 1 Daily earner | Day total income (existing "Worked today" button) | Joma preset amount | Repair by voice or typed | Entry 1: 1 tap, 2 s. Entry 2: 3 taps, 4 s (Add, template, Save). Entry 3: voice, 3 taps plus confirm, 10 s |
| 2 Garment worker | Repeat last remittance | Rent or grocery template | Cash-out draft from SMS | Entry 1 and 2: 3 taps, 4 s. Entry 3: open Inbox, Approve, 2 taps, 3 s |
| 3 Farmer | Input purchase on credit (typed) | Crop sale (typed amount) | Instalment tick (existing bills) | Typed: 4-digit amount plus 4 taps, 8 s. Tick: 2 taps |
| 4 Remittance household | Remittance received (SMS draft) | Loan instalment (bill tick) | Household chip | Draft: 2 taps, 3 s. Chip: 3 taps, 4 s |
| 5 Salaried | Bank SMS draft | Recurring EMI, DPS, rent (bill tick) | Bazar quick-add | Draft: 2 taps. Tick: 2 taps. Bazar: typed, 8 s, or "+" sum (section 4) |
| 6 Freelancer | Client payment (typed, USD later) | Recurring expense (bill tick) | Internet bill template | Typed: 8 s. Template: 3 taps |

Pass rule for a target: three timed runs on the owner's phone, median at or under target, recorded in docs/PROGRESS.md.

## 2. Current state (read from code today)

### Works today

| Capability | Where | Notes |
|---|---|---|
| Add entry with keypad, category chips, description suggestions | `src/ui/FastTransactionEntry.tsx`, `src/ui/Keypad.tsx` | Keypad keys are 48dp high (`keyHeight={48}`), `variant="tonal"`, Latin digits only, 3 columns |
| Keypad rules | `applyKeypadKey` in `Keypad.tsx` | Max 9 characters before the dot, max 2 decimals, no operators, no grouping while typing |
| Repeat chips | `recentDistinctEntries` in `src/domain/captureShortcuts.ts`, shown by `src/ui/CaptureShortcuts.tsx` | Up to 3 distinct (type, amount, category) entries. A chip fills the form and does not save (DECISIONS-LOG 2026-11-17) |
| Pinned amounts | `MAX_PINNED_AMOUNTS = 4` per type in `src/domain/types.ts`, settings field `pinnedAmounts` | Amount only. No category, wallet or label |
| Constant-height shortcut row above the keypad | `CaptureShortcuts.tsx` | One horizontal row, height 48dp, never changes while typing |
| One-tap daily wage | `src/domain/dailyWage.ts`, `src/ui/DailyWageSheet.tsx`, settings `dailyWage` | Amount, category, wallet stored. Second tap the same day asks first |
| Text and voice quick entry | `src/app/quick-entry.tsx`, `src/voice/parser.ts`, `src/voice/speech.ts` | Review list, user confirms, source `voice` or `quick` |
| English number words | `src/voice/parser.ts` (`UNIT_WORDS`, `TENS_WORDS`, `LARGE_SCALE_WORDS`) | Handles "two hundred and fifty", "25 thousand", "2 lakh", "1.5 k" |
| Bangla digits and a few Bangla words | `normalizeDigits` in `src/domain/money.ts`; "টাকা", category keywords; test "parses Bangla multi-clause phrases" | Bangla digits and keywords work. Bangla number words do not exist in the parser (grep for হাজার, লাখ, শ found nothing) |
| Mic, permission explain sheet, speech disclosure | `src/voice/speech.ts`, `quick-entry.tsx` (`speechDisclosureAccepted`) | Asks for on-device recognition when `supportsOnDeviceRecognition()` is true. Recognition language is never passed from quick-entry, so `startListening` always uses `en-US` |
| Notification capture | `plugins/withFinanceCapture.js` (`NotificationCaptureService.kt`) | Notification listener. Filters by a package list plus a keyword regex, drops OTP and promo text, keeps the last 120 items in SharedPreferences, de-duplicates identical text within 15 s |
| Share target | same plugin | Intent filters for `ACTION_SEND` with `text/plain` and `image/*` |
| Statement PDF and CSV import, receipt OCR | same plugin plus `src/app/inbox.tsx` | PDFBox and ML Kit Latin OCR. OCR is already built (see section 8) |
| Inbox of drafts | `src/app/inbox.tsx`, table `pending_drafts` (schema 5) | Approve, dismiss, edit category, approve all, paste text |
| Message parser | `src/capture/parser.ts`, 298-line `parser.test.ts` | One generic parser for every sender. Extracts amount, fee, TrxID, date, time, wallet by sender hint or last4, category |
| Draft de-duplication | `buildCaptureFingerprint`; `fingerprint TEXT UNIQUE` | By TrxID when found, else by date, amount, wallet and description. Only against other drafts |

### Permissions declared today

`app.config.ts` blocks SYSTEM_ALERT_WINDOW, READ_EXTERNAL_STORAGE and WRITE_EXTERNAL_STORAGE. `withFinanceCapture.js` adds a notification listener service (`BIND_NOTIFICATION_LISTENER_SERVICE`) and two share intent filters. No READ_SMS or RECEIVE_SMS. The listener also watches Google Messages and Samsung Messages packages, so SMS text can arrive through notifications with no SMS permission.

### Missing or wrong

1. No quick-add template (label, amount, category, wallet together). Only amount-only pins.
2. Keypad: Latin keys only, no grouping while typing, no "+", keys at the 48dp floor.
3. Bangla speech is never requested (`en-US` is hard-coded in effect) and Bangla number words do not parse.
4. No scheduled entries (bills exist but only as "mark paid").
5. Capture gaps that can write a wrong entry, found in `src/app/inbox.tsx` and `src/capture/parser.ts`:
   - Approve falls back to `accounts[0]` when no wallet matched. That can post to the wrong wallet.
   - "Approve all" saves every draft with no per-item look.
   - Draft de-duplication ignores entries the user already typed or saved.
   - The parser never produces a transfer draft (`draftKind` is always `'transaction'`). A cash-out becomes an expense plus a fee expense, so the cash received is not counted as money in hand.
   - `USD_APPROX_BDT_RATE = 122` is hard-coded. Rates must be editable, never hard-coded (payment-channels.md).
   - Rules are one shared regex set. There are no per-sender rules, no versions and no confidence value.
   - Raw message text (600 characters) stays in `pending_drafts.raw_text` after approval.
6. Test fixtures are not provenance-checked. See section 7.5.

## 3. Quick-add templates

### 3.1 Data model: settings JSON, no schema change

`settings` is a key-value table (`src/data/migrations.ts`, line 48), and `pinnedAmounts` already lives there as JSON. Templates follow the same pattern. Reasons: no migration on the owner's real data, travels with backup if the settings export includes the key (a builder check, task C4), simple to normalise like `normalizePinnedAmounts`.

New settings key `captureTemplates`, normalised in `src/domain/types.ts` the way `normalizeDailyWage` is:

```
CaptureTemplate {
  id: string            // uuid, generated on create
  type: 'expense' | 'income'
  label: string         // 1 to 24 characters, user text, shown on the chip
  amountMinor: number | null   // null means "ask me": fills everything but the amount
  categoryId: string    // required
  accountId: string | null
  description: string   // optional, filled into the description field
}
```

Rules enforced by `normalizeCaptureTemplates(raw)`: drop anything invalid, `amountMinor` must be a safe integer from 1 to `MAX_AMOUNT_MINOR` or null, label trimmed and not empty, `categoryId` must be a non-empty string, duplicates by id dropped, maximum length applied. Unknown category or wallet ids stay (archived items still exist) and are checked at use time.

Fallback if a table is ever needed (not recommended now): additive schema 8, `CREATE TABLE IF NOT EXISTS capture_templates (id TEXT PRIMARY KEY, type TEXT NOT NULL, label TEXT NOT NULL, amount_minor INTEGER, category_id TEXT NOT NULL, account_id TEXT, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL, created_at INTEGER NOT NULL)`, with a migration test on a v7-shaped database first (AGENTS section 6). JSON is enough for 8 rows.

### 3.2 Pinned amounts become templates

Do not keep two similar things. At read time, if `captureTemplates` is absent, derive amount-only templates from `pinnedAmounts` (label is the formatted amount, category is the most recent category used with that amount, else the type's "other" category). Do not delete `pinnedAmounts`; keep writing it until the next release, so a rollback loses nothing. The "Quick amounts" sheet in `CaptureShortcuts.tsx` is renamed "Quick entries".

### 3.3 Creating a template from an existing entry

- Entry detail screen gets a labelled button "Save as quick entry". No overflow menu.
- It opens a small sheet with label (default: description, else category name), the amount with a switch "Remember the amount", and Save.
- On the Add screen, the existing "Quick amounts" sheet gets the same action for the form as typed ("Save this as quick entry"), enabled when category and amount are set.
- Limit: 8 templates in total, plus the existing 3 repeat chips. At 8, the sheet says "You have 8 quick entries. Remove one to add another." with a Remove button per row.

### 3.4 Ordering and display

- Order: the user's order. New templates go to the end. The sheet has "Move up" and "Move down" buttons (no drag, so it works on weak phones and with TalkBack).
- In the shortcut row, the order is repeat chips first (they change), then templates of the current type (stable), then the "Quick entries" chip. Templates do not reorder themselves by use. Predictable position beats clever order for a daily earner who taps by position.
- A template chip shows label and, when set, the amount (`Money` component, tabular numerals).

### 3.5 Where they appear without shifting the keypad

Only inside the existing constant-height row in `CaptureShortcuts.tsx` (48dp, horizontal scroll). The row never changes height, so the keypad below never moves. Nothing is inserted above it while typing. Tapping a template fills category, wallet, description and (if set) amount, and leaves the cursor on the amount. It does not save. This follows DECISIONS-LOG 2026-11-17 (a chip never saves by accident).

Home does not get template chips in v1. The one-tap entry on Home stays the daily wage button.

## 4. One-hand numpad

### 4.1 Layout rules

- Keypad is the lowest block on the Add screen. Save sits directly above it, full width. The amount display is above that. The thumb reaches the keypad and Save without moving the grip.
- Three digit columns across the full content width. At 360dp wide with 16dp screen margin and 8dp gaps (tokens `screenMargin` 16, `spacing.sm` 8), each key is (360 - 32 - 16) / 3 = 104dp wide.
- Key height: 56dp on windows 640dp high or taller, 48dp on shorter windows. Today it is 48dp (`keyHeight={48}`), which is the minimum and the first thing to go wrong with a large finger or a cracked screen. Four rows at 56dp plus three 8dp gaps is 248dp. At 640dp window height that leaves about 390dp for the rest. HYPOTHESIS: needs a check on a 360x640 phone.
- Key height is never below `theme.touch.min` (48dp). `Keypad.tsx` already enforces that with `Math.max`.
- The row of shortcuts (48dp) stays above Save, or above the keypad if Save is a header button. Whichever the current layout does, it must not change.

### 4.2 What must never move

1. Digit positions (1 to 9, then ".", 0, Back). Muscle memory.
2. The keypad's top edge while typing, saving, or when a toast appears. Toasts must overlay, not push.
3. The Save button position.
4. The shortcut row height.
5. The decimal key stays in the bottom-left, Back in the bottom-right.

Test: a render test measures the keypad's `y` before and after typing digits, selecting a chip and showing an error, and asserts it is equal (extend `src/ui/FastTransactionEntry.test.tsx`).

### 4.3 Left-handed option

Decision: do not build it now. The keypad spans the full width, so every key is within reach of either thumb. Mirroring the digits would break the shared mental model of the phone dialler and the calculator. If a left-handed tester later reports a reach problem, the only mirrored items would be the side of the Back key and the alignment of secondary buttons. Recorded in section 10 as decided. HYPOTHESIS; test with two left-handed users before building.

### 4.4 Amount formatting while typing

- Internal value stays a Latin-digit string (`applyKeypadKey` unchanged in meaning). Only display changes.
- Display groups with the Bangladeshi system: 12,34,567 (last three digits, then pairs). Grouping applies to the whole-number part only. Decimal part untouched. Typing "1000" shows "1,000"; "123456" shows "1,23,456".
- With locale `bn`, display with Bangla digits (`toBnDigits` in `src/i18n/displayText.ts` already exists) and Bangla keypad labels (০ to ৯). The key's accessibility label stays the spoken digit.
- The cursor never jumps: display is derived from the string, not edited.
- The 9-digit limit becomes a limit on the amount (`MAX_AMOUNT_MINOR`), not a character count, so grouped text cannot overflow. The amount text uses `fitMoney` sizing (DECISIONS-LOG: no `adjustsFontSizeToFit`).
- New pure function `formatAmountInput(raw, locale)` in `src/domain/amountInput.ts`, with tests: "", "0", "0.", "1000", "123456", "1234567.5", Bangla output of the same.

### 4.5 Is "+" worth it?

Yes, one operator only: "+". Reason: a bazar trip is several small amounts (120 + 80 + 45). Without "+", the user opens a phone calculator or logs three entries. HYPOTHESIS; the shop owner and household personas are the likely users.

Design:

- A fourth column (a narrow one) holding "+" in the first row and Back in the second. Digit columns shrink from 104dp to (328 - 3 * 8) / 4 = 76dp each if all four columns share width. 76dp stays above 48dp. Digit positions inside their columns do not change.
- The amount display shows "120 + 80 + 45" and a smaller line "= 245". Save uses the sum. Maximum 6 terms. All sums are integer poisha; the sum is capped at `MAX_AMOUNT_MINOR` and Save is blocked with a message if it would exceed it.
- No "=" key and no other operator. Save evaluates. A trailing "+" is ignored.
- If this makes the keypad feel crowded on a 360dp phone in the owner's test, fall back to leaving the "+" out. It is a separate task (C3) so it can be dropped.
- The sum logic lives in `src/domain/amountInput.ts` (`sumTerms`), not in a component (AGENTS rule 6).

## 5. Voice entry in Bangla

### 5.1 What recognition is realistically available

All items verified from the library README on 2026-11-17 unless marked.

| Fact | Source | Status |
|---|---|---|
| expo-speech-recognition on-device recognition needs Android 13 or newer; unsupported on Android 12 and below | https://github.com/jamsch/expo-speech-recognition (read 2026-11-17) | SOURCED |
| On Android it needs a downloaded language model; `androidTriggerOfflineModelDownload()` opens a system dialog on 13, can download or schedule on 14+ (may wait for Wi-Fi) | same | SOURCED |
| `getSupportedLocales()` is unavailable on Android 12 and below; its installed-locales list may be empty unless the `com.google.android.as` service is queried | same | SOURCED |
| On Android 12 and below the default service is the Google app (`googlequicksearchbox`); the README says it could not verify on-device recognition on an Android 12 emulator | same | SOURCED |
| With `requiresOnDeviceRecognition` false, audio goes to Google's servers and needs a network | general behaviour of Android's recognizer; the README only says on-device keeps audio off the network | NOT VERIFIED for exact data handling |
| A Bangla (bn-BD) offline model exists and can be installed | no source found | NOT VERIFIED |
| Quality of Bangla recognition of numbers and mixed Bangla-English | no source found | NOT VERIFIED; needs a phone test |
| Samsung or Xiaomi phones from about 2016 to 2018 (Android 7 to 9, the project floor is Android 7 per DECISIONS-LOG) use the online path | follows from the first row | derived |

Honest summary: on the phones the project targets (about 10 years old, Android 7 to 9) there is no on-device Bangla recognition. Voice there is online, through Google, and works only with a connection and the Google app installed. On Android 13 or newer, on-device may work if the user installed the Bangla model; that is NOT VERIFIED.

Offline engines bundled in the app (Vosk, whisper.cpp) are rejected: model size works against the 40 MB per-device budget (PLAN) and Bangla model availability is NOT VERIFIED.

### 5.2 Behaviour

- Language: add a setting "Voice language" with Bangla (`bn-BD`) and English (`en-US`), defaulting to the app language. `quick-entry.tsx` passes it to `startListening({ lang })`. Today it passes nothing.
- Mode: `supportsOnDeviceRecognition()` true means use on-device and say so ("Stays on your phone"). False means online. The existing disclosure sheet (`speechDisclosureAccepted`) stays and its wording must say plainly: "On this phone, your voice is sent to Google to be turned into text. Nothing else leaves your phone." Wording is the owner's to approve (question 2).
- A switch in Settings "Voice only on this phone" (default off on phones that cannot do it; on by default where `supportsOnDeviceRecognition()` is true). When on and unsupported, the mic button is hidden and typing remains.
- The mic button is always accompanied by the text box. Typing works with no setup.

### 5.3 Grammar the parser accepts

Today: English words and Bangla/Latin digits. Add Bangla number words.

Amount forms to accept:

| Form | Example (HYPOTHETICAL phrasing, for the approach only) | Value |
|---|---|---|
| Latin or Bangla digits | 500, ৫০০ | 500 |
| Digits with unit word | 5 hajar, ৫ হাজার, 2 lakh, ২ লাখ | 5,000; 200,000 |
| Bangla number words 0 to 99 | পঁচিশ, পাঁচ | 25, 5 |
| Hundreds | পাঁচশো, পাঁচ শ | 500 |
| Compound | দুই হাজার পাঁচশো | 2,500 |
| Half forms | সাড়ে তিনশো, দেড় হাজার, আড়াই হাজার | 350; 1,500; 2,500 |
| Mixed speech | "bazar e five hundred taka", "পাঁচশো টাকা bazar" | 500 |
| English words | existing | existing |

Implementation notes:

- Bangla number words 1 to 99 are irregular, so use a lookup table of all 100 words (not a rule), kept in `src/voice/bnNumbers.ts`, with alternate spellings (পাঁচ and পাচ, এগারো and এগার). The builder must write the table from a reliable reference and a Bangla reader must check it; this is a bulk-worker plus owner review task.
- Scales: শ and শো (100), হাজার (1,000), লাখ and লক্ষ (100,000), কোটি (10,000,000).
- Recognisers often return digits for spoken numbers. HYPOTHESIS, not verified for Bangla. The parser must accept both.
- Currency words already handled: টাকা, tk, taka, ৳.
- Category words: existing `CATEGORY_KEYWORDS` (34 lines contain Bangla). Add Bangla words for the common local spend: বাজার, ভাড়া, বিদ্যুৎ, গ্যাস, মোবাইল রিচার্জ, রিকশা, সিএনজি, জমা, কিস্তি, বেতন, মজুরি. Each added word needs a test.
- Verbs that set direction: expense (খরচ, দিলাম, কিনলাম, দিয়েছি), income (পেলাম, পেয়েছি, আয়). Existing parser has `INCOME_VERB_RE` and `EXPENSE_VERB_RE`; extend, do not replace.
- Digit-versus-word conflict: a phrase with two amounts and one category (500 and 200) is two entries, as today.

Exactness rule: never guess an amount. If a number phrase cannot be read with full confidence, set `needsAmount` (already supported) and leave the field empty. Ambiguity examples: "পাঁচ দশ" (could be 5 10 or 15), a number word the table does not know.

### 5.4 Error handling and confirm step

- The confirm step already exists: parse produces drafts with `requiresConfirmation: true`, shown in a review list; nothing saves until the user confirms. Keep it. The raw heard text is shown above the review list so the user sees what the recogniser heard.
- Errors map to plain messages (existing `mapSpeechErrorMessage` in `speech.ts` is English strings in code; they must move to `t()` per AGENTS section 5): no network, no speech heard, permission denied, language not installed, recogniser unavailable. Each ends with "Type it instead" and keeps the text box focused.
- `language-not-supported` (README mentions it for unsupported locales): offer English, or typing.
- Permission denied twice: do not show the mic; show a Settings link.

### 5.5 Fallback when speech is unavailable

Mic hidden, text box stays, and the same parser runs on typed text. This is already how Expo Go and web behave (`isAvailable()` false).

## 6. Repeat entries

### 6.1 Exists

Up to 3 repeat chips (`recentDistinctEntries`) that fill the form. Keep as is.

Improvement in task C4: a chip shows its wallet when the user has more than one wallet, so the user can see where the repeat goes. Currently the chip carries the wallet silently.

### 6.2 Scheduled recurring entries: leave out

Reasons:

1. Recurring bills (`recurring_bills`, mark paid, due reminders) already cover rent, EMI, DPS and instalments, which are the fixed outflows every persona shares.
2. An entry created without the user would break the rule "nothing is saved without confirmation".
3. Income that repeats on a fixed rhythm (salary) varies in date and amount in this market (SYNTHESIS: lumpy and uneven). A wrong automatic entry is worse than a one-tap prompt.
4. The daily wage button and bills "Mark paid" already cover the repeating cases with one tap.

If the owner later wants it: a bill's "Mark paid" can create the expense entry with a confirm sheet. That is a bills feature, not a capture feature.

## 7. SMS and notification capture

### 7.1 Facts about Play policy (read 2026-11-17)

Source A: https://support.google.com/googleplay/android-developer/answer/10208820 (read 2026-11-17).

- SMS and Call Log permissions are for the default SMS, Phone or Assistant handler. Non-default apps may get a temporary exception only if the permission enables a listed core function and there is no alternative method for it. Exceptions are reviewed case by case.
- "SMS-based money management" is a listed exception covering READ_SMS, RECEIVE_MMS, RECEIVE_SMS and RECEIVE_WAP_PUSH, with the example "apps that track and manage budget". Budgeting apps may not exfiltrate or share non-financial or personal SMS history.
- Apps declare through the Permissions Declaration Form in Play Console.
- The page shows no "last updated" date. It mentions a change effective 2027-01-27 on account verification by phone call under READ_CALL_LOG, which does not affect Khoroch.
- The page names the SMS Retriever API and the SMS User Consent API as alternatives.

Source B: Play Help search results (https://support.google.com/googleplay/android-developer/answer/9047303 and the same page above, read through a search summary 2026-11-17, not fetched directly): the form asks you to choose the core functionality from a list and to provide a video demonstration; review can take up to several weeks and is extended; a form response can say a feature is not necessary for core functionality. NOT VERIFIED: I could not fetch the form itself, and the "several weeks" and "video" details come from a search summary, not the page text.

Source C: https://developers.google.com/identity/sms-retriever/overview (read 2026-11-17). The SMS Retriever API verifies a phone number by delivering a server-sent message tagged with the app's hash. The page does not say it can read general messages, and by design it does not.

Source D: https://developers.google.com/identity/sms-retriever/user-consent/overview (read 2026-11-17). The User Consent API gives the app one message after the user agrees, for that message only. The prompt appears only if the app is already listening before the message arrives. The page is written for one-time codes. It does not state a rule limiting it to codes, but a message from before the app began listening is not delivered. Not usable for reading past bKash messages. NOT VERIFIED: sender restrictions and time limit are not stated on the page.

Source E: https://developer.android.com/reference/android/service/notification/NotificationListenerService (read 2026-11-17, first 100,000 of about 300,000 characters). The service needs the `BIND_NOTIFICATION_LISTENER_SERVICE` permission. It receives posted and removed notifications and can list active ones. It cannot be bound on low-RAM devices running Android 10 (Q) or below. NOT VERIFIED from this page: the page excerpt did not describe the user enabling access in Settings, though the existing code relies on it (`openNotificationListenerSettings`).

Source F: third-party summaries of Android 13 "restricted settings" (https://droidwin.com/?p=28677, https://dev.to/ahmmedrejowan/android-13s-restricted-setting-a-stronghold-against-malicious-apps-1ea9, https://kaspersky.com/blog/android-restricted-settings/49991, read as search results 2026-11-17, not fetched). Apps installed outside a store's installation API (including adb and file installs) are blocked from enabling notification access until the user opens the app's App info page and chooses "Allow restricted settings" in its overflow menu. The option may only appear after one failed attempt. Behaviour varies by phone maker. NOT VERIFIED against Google's own documentation. Relevant because the owner's build is installed with `adb install -r`.

NOT VERIFIED, and important: whether Google Play applies extra review to an app that uses a notification listener to read other apps' notifications. I found no Play policy page naming it in this research. Check "Sensitive permissions" and "User Data" policy pages before a Play submission, and treat the review risk as unknown, not zero.

### 7.2 Decision table

| Option | Play policy risk | Permission prompt | Reliability | Battery | Verdict |
|---|---|---|---|---|---|
| A. READ_SMS or RECEIVE_SMS with Play declaration | High and slow: exception is case by case, needs a declaration and demo. Approval not guaranteed (Source A) | Runtime SMS permission, a scary prompt | Highest: sees every message, past and new | Low: broadcast on arrival | Not in v1. Revisit only if B fails in the field and the owner wants to apply |
| B. Notification listener (built) | NOT VERIFIED, likely lower than A because SMS and READ_SMS are not requested | User enables "Notification access" in Settings, one screen | Medium: only sees what is posted. Fails if the user dismisses the SMS app's notifications, disables them, hides content on the lock screen (NOT VERIFIED), or the phone maker's task killer unbinds the service. `requestRebind` exists for recovery | Low: system-bound, no polling | Recommended for both builds |
| C. User shares or pastes the message into Khoroch (built: share target and paste) | None. No permission | None | Depends on the user remembering | None | Recommended as the always-available fallback |
| D. SMS Retriever API | n/a | none | Unusable: needs a server to send a message with an app hash | n/a | Rejected |
| E. SMS User Consent API | Low | One prompt per message | Unusable: one message, listener must already be running, built for one-time codes | n/a | Rejected |
| F. Accessibility service reading the screen | High: restricted by Play policy (NOT VERIFIED here, widely known) | Settings, scary | Fragile | Higher | Rejected |
| G. Become the default SMS app | Low for policy, very high for users | System role | Complete, but replaces the user's SMS app | n/a | Rejected |
| H. Read the bKash or Nagad app's own notification (B with package filter) | Same as B | Same as B | Better than reading an SMS app when the wallet app posts the notification | Low | Use together with B |

### 7.3 Recommended path

- Play-distributed build: B plus C, no SMS permission. The opt-in screen says why access is needed and what is read. Review the Play listener policy before the first submission (section 7.1).
- Side-loaded build (the owner's phone): the same B plus C. Add a one-time help screen for Android 13 and newer: "Allow restricted settings" (Source F, NOT VERIFIED, test on the owner's phone). No READ_SMS, so both builds behave the same and one parser serves both.
- A later, optional "import old messages" using READ_SMS belongs to a separate flavour and is not planned.

### 7.4 On-device pipeline

```
source (listener / share / paste)
  -> sender filter (allow-list per provider file; unknown senders dropped)
  -> parser (per-sender rule file, versioned) -> draft + confidence
  -> dedupe (TrxID, then same wallet, amount and a 10-minute window)
  -> draft saved in pending_drafts (status pending)
  -> Inbox: user edits, then Approve or Dismiss
  -> only Approve writes a transaction or transfer
```

Rules:

1. Nothing leaves the phone. No network call in the capture module. Capture code may not import a networking API (a test greps for `fetch(`, `XMLHttpRequest` and `WebSocket` under `src/capture/`).
2. The sender filter is the first step, not a keyword regex across all notifications. Today the listener keeps anything from a messaging app that matches the keyword regex, which can capture a personal chat that mentions "tk 500". The notification title for an SMS is normally the sender. Filter: the sender or app package must be on the provider allow-list. Drop the rest before it is stored. The same filter runs in Kotlin (so unwanted text is never written to SharedPreferences) and in TypeScript (the real rule).
3. Dedupe: existing fingerprint rule by TrxID, plus a new check against saved transactions: same TrxID in the note (`TrxID: X`, already written by `handleApproveDraft`), or same wallet, same amount, within 10 minutes. A near match produces a draft flagged "Looks like an entry you already made" rather than being dropped.
4. Retention: after Approve or Dismiss, blank `raw_text` after 7 days. Notification buffer in SharedPreferences is drained on app open (exists) and capped at 120 (exists).
5. Approve never silently chooses a wallet. If no wallet matched, the draft shows "Choose wallet" and Approve is disabled until the user picks. Remove the `accounts[0]` fallback.
6. "Approve all" applies only to drafts whose confidence is `high` and that have a wallet. Other drafts need their own review.
7. A draft always shows the raw message under a "Show original" toggle, so the user can check the parse.

### 7.5 Samples: there are none, and nothing is trusted yet

The project has no real bKash, Nagad, Rocket, Upay or bank SMS samples (docs/PROGRESS.md line 573: "No real SMS samples found"; payment-channels.md section 2: no official template found, only an unofficial community gist). The messages in `src/capture/parser.test.ts` are written as test inputs and some test names say "real". I cannot confirm where they came from, and no sample file exists in docs/. Treat every existing fixture as HYPOTHETICAL until the owner confirms its source.

Collection kit (task C9, needs the owner's phone):

1. The owner opens the messages from each provider (bKash, Nagad, Rocket, Upay, one or two banks, the mobile operator for recharge) and for each kind of event: send money out, received, cash in, cash out, payment to a merchant, bill pay, recharge, fee, failed transaction, balance check, OTP (to learn what to drop), promo (to learn what to drop). Ten to twenty messages per provider, including Bangla-language ones if any exist.
2. Share each message to Khoroch (the share target works today) or copy it to a text file on the PC.
3. A script `scripts/redact-sample.mjs` replaces phone numbers with `01XXXXXXXXX`, names with `NAME`, account and card numbers with `XXXX` keeping the last 4 only when the parser needs them, and keeps amounts, fees, balances, TrxID shape (letters and digits pattern), dates and every word and punctuation mark. TrxID: replace characters but keep length and the letter-digit pattern.
4. Redacted samples go to `src/capture/fixtures/<provider>.json` as `{ id, provider, redacted, expected: { type, amountMinor, feeMinor, trxIdShape, kind } }`, where `expected` is written by a human from the original.
5. The owner reviews the redacted file before it is committed. The unredacted originals never enter the repo.

No parser rule file is trusted until it passes its fixtures. Rules written before the samples exist are marked `unverified` and produce drafts with confidence `low`.

HYPOTHETICAL shape, to explain the approach only. These are not real messages and must never be used as a fixture:

```
<PROVIDER>: <Verb> Tk <AMOUNT> <preposition> <COUNTERPARTY> successful. Fee Tk <FEE>. Balance Tk <BALANCE>. TrxID <ID> at <DD/MM/YYYY HH:MM>
```

The approach: each provider file lists the verbs it knows ("cash out", "received", "payment of") and the field patterns, and maps each verb to a kind. A message with a verb the file does not know produces a low-confidence draft, not a guess.

### 7.6 Parser design

Per-provider rule files in `src/capture/rules/`, one file per sender:

```
ProviderRules {
  id: 'bkash' | 'nagad' | 'rocket' | 'upay' | 'bank_xxx'
  version: number                // bump on any change; stored on the draft
  senders: string[]              // SMS sender ids and notification titles
  packages: string[]             // app package names
  verified: boolean              // true only when fixtures exist and pass
  matchers: Matcher[]            // ordered; first full match wins
}
Matcher { kind, pattern, fields }   // kind: send, receive, cash_in, cash_out, payment, bill, recharge, fee_only
```

Behaviour:

- Order: the provider file, then the generic parser (`src/capture/parser.ts`) as a fallback. The fallback result is always `confidence: 'low'`.
- Confidence: `high` means the provider is `verified`, a matcher matched in full, amount parsed, and (where the kind needs it) TrxID found. `low` means anything else. Only `high` can be approved in bulk.
- Safe failure: if the amount cannot be read, there is no draft at all (a draft needs `amount_minor > 0`, as the table constraint says). If anything else is uncertain, the draft is saved with `confidence low`, the uncertain field empty, and a short reason line ("Wallet not found", "Message format not recognised") shown in Inbox. The user edits it. The parser never picks a category or wallet to look sure.
- Money parsing uses integer poisha only (`parseMoneyInput`). Fee is read from the message when present, never computed from a rate, except as a suggestion shown but not saved (below).
- Drop rules stay per provider: OTP, promo, balance-only, login alerts.
- Tests: one jest case per fixture, run by a loop over `src/capture/fixtures/*.json`. A provider flips to `verified: true` only in the same commit that adds its passing fixtures. A test fails if `verified` is true and the provider has fewer than five fixtures.
- Versioning: the draft stores `parser_id` and `parser_version` so a later fix can be traced. Needs an additive schema 8 (below).

Additive schema 8, for the draft columns only (tested on a v7-shaped database first, per AGENTS section 6):

```
ALTER TABLE pending_drafts ADD COLUMN parser_id TEXT;
ALTER TABLE pending_drafts ADD COLUMN parser_version INTEGER;
ALTER TABLE pending_drafts ADD COLUMN confidence TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('high','low'));
ALTER TABLE pending_drafts ADD COLUMN review_note TEXT;
```

Each guarded by `PRAGMA table_info(pending_drafts)` like the schema 6 and 7 steps. Existing drafts read as `low`. The `LATEST_SCHEMA_VERSION` and `BACKUP_SCHEMA_VERSION` constants move to 8 with the same import handling used for schema 7 (DECISIONS-LOG "Default fee per wallet").

### 7.6.1 Transfers, cash-out and fees

Facts from code: `NewTransfer` has `fromAccountId`, `toAccountId`, `amountMinor`, `feeMinor`. Transfer fees are ordinary expense rows on the from-wallet, and transfers count only `amountMinor` (`src/domain/accounts.ts` line 86 comment). A wallet has `defaultFeeBp` (schema 7) and `src/domain/fees.ts` computes a default fee.

Mapping:

| Message kind | Draft | On approve |
|---|---|---|
| Cash out at an agent | `draftKind transfer`, from the wallet to the user's Cash wallet, `amountMinor` = cash received, `feeMinor` = fee in the message | `repo.createTransfer` plus a fee expense row on the from-wallet, the same way `src/app/transfer/[id].tsx` does it |
| Cash in at an agent | transfer from Cash wallet to the wallet, fee usually 0 | same |
| Send money to a person | expense on the wallet (money left the user's books), category chosen by user | `insertTransaction`; fee as separate expense with category `fees` (exists today) |
| Money received | income on the wallet | `insertTransaction` |
| Payment to a merchant, bill, recharge | expense | `insertTransaction` |
| Transfer between two of the user's own wallets (for example bank to bKash "iBanking") | transfer | `createTransfer` |

- If the user has no Cash wallet, the cash-out draft falls back to an expense plus a fee expense (today's behaviour) and says so.
- If the message has no fee but the wallet has a `defaultFeeBp`, the draft shows the computed fee as a suggestion on the edit sheet, empty by default. Never write a fee the message did not state without the user pressing Save.
- Fees are never hard-coded. The numbers in payment-channels.md (for example Tk 18.50 per 1,000) are research only.
- USD: remove `USD_APPROX_BDT_RATE`. A message in USD gets a draft with the amount empty and the review note "Foreign amount. Enter the taka amount". This keeps integer poisha rules and respects no hard-coded rates.

### 7.7 Privacy notes

- What is read: only notifications that pass the sender filter. Messages from other senders are dropped in Kotlin before storage.
- What is stored: draft fields and the original text (cleared after 7 days from approval or dismissal). Backups (`src/data/backup.ts`) must not include `pending_drafts.raw_text`. Builder verifies (task C12); if they do, strip on export.
- Nothing is sent anywhere. The Play data-safety form can state no data is collected (NOT VERIFIED against the current Play form wording; check at submission).
- The unredacted samples never enter the repo, backups or screenshots.
- The listener sees all notifications once enabled. The opt-in screen says so, and the filter discards the rest immediately. Be honest about that sentence; do not claim "only reads bKash".
- Capture is off until the user turns it on, and each provider has its own switch.

### 7.8 Opt-in flow wording

Plain text, English first, Bangla through `t()`. No ellipsis. Wording is a draft for the owner to approve.

Screen "Capture from messages" (Settings, then Capture):

- Title: "Add entries from payment messages"
- Body: "Khoroch can read payment notifications from bKash, Nagad, your banks and similar senders, and turn each one into a draft in your Inbox. You check every draft before it is saved. Khoroch does not send anything off your phone."
- Honest detail: "To do this, Android asks you to give Khoroch access to notifications. That access lets Khoroch see all notifications. Khoroch ignores everything except payment messages from the senders you choose here, and does not keep the rest."
- Per-sender switches: bKash, Nagad, Rocket, Upay, Banks (each off until chosen).
- Button: "Turn on". It opens the Android notification access screen (`openNotificationListenerSettings`).
- After return: the screen checks `isNotificationListenerEnabled()` and shows "On" or "Not on yet. Open settings again".
- Android 13 and newer, sideload only: second paragraph "If Android says this setting is restricted, open Khoroch in App info, choose Allow restricted settings, then try again." Wording needs a phone check.
- Always visible: "You can also share or paste a payment message into Khoroch any time. No access needed."
- Off switch: "Turn off" opens the same Android screen, and the app stops listening for its own filter immediately.
- Health: on app open, if capture is on but `isNotificationListenerEnabled()` is false, show a banner in Inbox: "Payment capture is off. Turn it on again".

## 8. Receipts (later)

Why later: OCR is already built (ML Kit Latin text, `recognizeImageText`) but receipts are the least regular input. Bangladeshi bazar receipts are often handwritten or absent (payment-channels.md section 1: most daily spending is cash and has no receipt), and Latin OCR does not read Bangla. The ML Kit dependency and PDFBox also add size to an app with a 40 MB budget; confirm their cost before shipping to old phones.

What would be needed: real receipt photos from the owner (supermarket, pharmacy, electricity bill), a Bangla-capable OCR decision (NOT VERIFIED which on-device option fits the size budget), a totals parser with fixtures, and a review screen showing the photo next to the draft. Until then the existing "Scan receipt" button stays as is and its drafts use confidence `low`.

## 9. Task list in build order

Each task is one builder session. After each: reviewer PASS, `npm run typecheck`, `npm test`, `npx expo lint`. Tasks marked PHONE need the owner's phone (dev app only, AGENTS sections 6 and 7). Tasks marked SAMPLES need collected, redacted messages.

| # | Task | Files | Depends | Done when | Needs |
|---|---|---|---|---|---|
| C1 | Capture safety fixes | `src/app/inbox.tsx`, `src/capture/parser.ts`, `src/data/repo.ts`, `src/data/sqliteRepo.ts`, `src/data/memoryRepo.ts`, i18n | none | Test: a draft with no wallet cannot be approved until one is chosen. Test: "Approve all" skips drafts without a wallet. Test: a draft whose TrxID matches `TrxID: X` in a saved transaction is flagged "Looks like an entry you already made". Test: a USD message yields a draft with no amount and a review note. `grep -rn "USD_APPROX_BDT_RATE" src` finds nothing | none |
| C2 | Amount display: grouping and Bangla digits | new `src/domain/amountInput.ts` plus test, `src/ui/Keypad.tsx`, `src/ui/FastTransactionEntry.tsx`, i18n | none | Tests: "1000" shows "1,000", "123456" shows "1,23,456", "0." stays "0.", Bangla output for the same. Typing never moves the keypad (render test) | none |
| C3 | Keypad key height 56dp on tall windows | `src/ui/Keypad.tsx`, `src/ui/FastTransactionEntry.tsx` | C2 | Render test at 360x640 gives 48dp keys and at 360x800 gives 56dp; no key under 48dp; keypad top edge unchanged across typing | check on phone: PHONE (optional) |
| C4 | Templates: domain and storage | `src/domain/types.ts` (`CaptureTemplate`, `normalizeCaptureTemplates`), new `src/domain/captureTemplates.ts` plus test, settings repo, `src/data/backup.ts` | none | Tests: normalise drops invalid entries, limit 8, null amount allowed, pinnedAmounts derive when key absent. Export and import round trip keeps templates. No schema change | none |
| C5 | Templates: UI | `src/ui/CaptureShortcuts.tsx`, entry detail screen, new sheet, i18n | C4 | A template chip fills category, wallet, description, amount and does not save. "Save as quick entry" creates one from an existing entry. At 8 templates the add button explains and offers Remove. Shortcut row height unchanged (existing layout test). No overflow menu or ellipsis (no-ellipsis test) | PHONE for a look at 360dp |
| C6 | "+" key | `src/domain/amountInput.ts` (`sumTerms`), `src/ui/Keypad.tsx`, `FastTransactionEntry.tsx`, i18n | C2, C3 | Tests: 120+80+45 saves 24500 poisha; over `MAX_AMOUNT_MINOR` blocked; trailing "+" ignored; six term cap; four-column keys are at least 48dp at 360dp. Digit positions unchanged | PHONE to judge crowding; drop if crowded |
| C7 | Bangla number words | new `src/voice/bnNumbers.ts`, `src/voice/parser.ts`, `src/voice/parser.test.ts` | none | Tests: পাঁচশো = 500, দুই হাজার পাঁচশো = 2500, সাড়ে তিনশো = 350, দেড় হাজার = 1500, আড়াই হাজার = 2500, ২ লাখ = 200000, a mixed Bangla-English sentence parses, an unknown word gives `needsAmount`. The 0-to-99 table is reviewed by a Bangla reader | owner review of the word table |
| C8 | Bangla category and verb words | `src/domain/categories.ts`, `src/voice/parser.ts`, tests | C7 | One test per added word (section 5.3 list) | none |
| C9 | Voice language and fallbacks | `src/voice/speech.ts`, `src/app/quick-entry.tsx`, settings, i18n | C7 | Setting "Voice language" is passed to `startListening`. Error messages come from `t()`. Mic hidden when unavailable. Test with a mocked module for each error code | PHONE: check Bangla recognition on the owner's phone, record whether on-device works (fills the NOT VERIFIED rows) |
| C10 | Sample collection kit | new `scripts/redact-sample.mjs` plus test, new `docs/capture/SAMPLES.md` (checklist), `src/capture/fixtures/` | none | Script test: phone numbers, names and account numbers are replaced; amounts and wording are kept. Owner supplies at least ten redacted messages for each provider they use | SAMPLES from the owner's phone |
| C11 | Provider rule files and fixtures | new `src/capture/rules/*.ts`, `src/capture/parser.ts` (fallback), `src/capture/parser.test.ts`, fixtures test | C1, C10 | One test per fixture; `verified: true` only with at least five passing fixtures; fallback drafts are `confidence low`; existing parser tests still pass or are re-labelled HYPOTHETICAL | SAMPLES |
| C12 | Draft columns and confidence | `src/data/migrations.ts` (schema 8), `src/domain/types.ts`, `src/data/backup.ts`, tests, `src/app/inbox.tsx` | C11 | Migration test on a v7-shaped database keeps rows; backup before schema 8 imports; `raw_text` is not exported; raw text blanked 7 days after approve or dismiss; Inbox shows the review note and the "Show original" toggle | none |
| C13 | Transfer drafts | `src/capture/rules/*.ts`, `src/app/inbox.tsx`, `src/data/repo.ts`, tests | C11, C12 | Cash-out fixture creates a transfer from wallet to Cash plus a fee row; balances change by amount plus fee on the wallet and amount on Cash (test on `calc.ts`); with no Cash wallet it falls back to expense plus fee | none |
| C14 | Sender filter in Kotlin and TypeScript | `plugins/withFinanceCapture.js`, `src/capture/nativeCapture.ts`, `src/capture/syncCapture.ts`, tests | C11 | A notification from a messaging app whose title is not on the allow-list is never stored (unit test on the TypeScript filter; manual check for Kotlin). Test that `src/capture/` has no network API calls | PHONE (needs a prebuild and a dev build) |
| C15 | Opt-in screen and health banner | new settings screen, `src/app/inbox.tsx`, i18n (en and bn) | C14 | Per-sender switches persist; "Turn on" opens the Android screen; Inbox banner shows when access is off; no ellipsis (test) | PHONE: check the Android 13 restricted settings path |
| C16 | Timing run against targets | `docs/PROGRESS.md` only | C2 to C9 | Section 1 table filled with three timed runs per entry on the owner's phone | PHONE |

C1 comes first because it removes ways to write a wrong entry in code that is already on the owner's phone. C10 can start at any time and has the longest wait, so ask the owner early.

## 10. Open questions for the owner (six)

1. Will Khoroch go on the Play Store?
   Recommended default: not yet. Build and test for the side-loaded phone, with no SMS permission, so a later Play submission needs no redesign.
2. Is voice allowed to send audio to Google on phones that cannot do on-device recognition (most Android 7 to 12 phones)?
   Recommended default: yes after a clear disclosure sheet, with a Settings switch "Voice only on this phone" to turn it off. Typing always works.
3. Can you share ten to twenty messages per provider you use (bKash, Nagad, Rocket, a bank, recharge), including failed and promo ones, so they can be redacted and used as fixtures?
   Recommended default: yes, using the share button and the redaction script. No parser is marked trusted before this.
4. Should capture read messaging-app notifications at all, or only the wallet and bank apps' own notifications plus pasted messages?
   Recommended default: allow SMS-app notifications only from a sender allow-list (provider names as the notification title), drop everything else immediately.
5. Add a "+" key to the keypad?
   Recommended default: yes, as a separate task that is dropped if it crowds the keypad on a 360dp phone.
6. Should a cash-out SMS become a transfer from the wallet to your Cash wallet (fee as a separate expense), instead of an expense?
   Recommended default: yes, when a Cash wallet exists, because it keeps your cash-in-hand number correct.

Decided in this spec without a question (reversible): templates live in settings JSON with no schema change; no left-handed keypad until a user needs it; no scheduled entries; receipts later.
