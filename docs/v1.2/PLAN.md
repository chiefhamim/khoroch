# v1.2 — "Money notebook": review, direction, rules

**Authority:** this file + `docs/v1.2/TEST-CASES-v1.2.md` + `docs/v1.2/mockup.html` override `docs/ui-overhaul/DESIGN.md` (v1.1) wherever they conflict. SPEC DECISIONS money rules still apply (integer poisha, calc only in `src/domain`, offline, no cloud).

Before-screenshots of v1.1 (real phone, 13 Nov 2026): `docs/v1.2/before/`.

---

## 1. Review of v1.1 (phone + code, 2026-11-13)

### What the owner said
> "It looks okay, but … it feels like a stock Android app. It has no feelings, emotion, or depth of its context. This isn't only a budgeting app, it's a notepad of money in and out for someone who loses track of his accounts. It lacks the payment methods we use: bKash, Nagad, Upay, cards, bank transfer. It should be simple, easy, yet technical, and give people an accurate financial picture. It should feel personal: customisable theme, and their day, transactions and accounts could be shared with people."

### Visual findings
| # | Finding |
|---|---|
| V1 | **The ৳ sign renders in a fallback font.** Inter has no U+09F3, so Android substitutes another font: thin, a different style, and the wrong size and baseline (`৳4,620` hero; `+৳2,500` in rows). This is the most visible quality problem. |
| V2 | Typeface (Inter at stock weights) plus pure-grey neutrals plus white cards looks like default Material. Nothing is distinctive. |
| V3 | The hero is "Spent this cycle ৳4,620" alone. It gives no picture of what you *have*, and income (৳29,000 this cycle) isn't on Home at all. |
| V4 | The chart is mostly flat dashes with one bar. It takes a full card for very little information on Home. |
| V5 | Top categories show `43.7% ৳2,020`; the percentage and amount compete. Most tiles are grey because "Other" dominates. |
| V6 | Add screen: category labels have uneven widths ("Transportation", "Food & Dining"), there's a dead band between the suggestions and the keypad, and the disabled Save is a washed-out green. |
| V7 | Budget empty state still takes about 45% of the screen. |
| V8 | Insights shows raw averages with decimals (`৳2,487.69` per week) and `৳0` for "Monthly avg" when no complete month exists. It should show `৳2,488` and "—" with "after your first full month". |

### Product gaps
| # | Gap |
|---|---|
| P1 | **No wallets/accounts.** You can't say *where* money came from or went (bKash, Nagad, Upay, Rocket, Cash, Bank, Card), so there are no balances and no "where's my money right now". |
| P2 | **No transfers** (bKash → Cash out, Bank → bKash add money) and **no fees** (cash-out charges are real, frequent spending in BD). |
| P3 | **No dues.** "Repay to Nafees" was logged as an *Other expense*. Lending and borrowing are not spending, and they need a who-owes-whom ledger. |
| P4 | **No backup/export.** The owner's data exists only on the phone (and possibly Google auto-backup). |
| P5 | **Personal touches are missing:** one fixed theme, no privacy hide, no week-start choice (BD weeks start Saturday), no sharing. |

### Security & integrity (code review; no Critical issues; SQL parameterised everywhere; migrations additive and transactional; no secrets; 94/94 tests passing)
| Sev | # | Finding | Fix |
|---|---|---|---|
| High | S1 | Release builds are signed with the **template `debug.keystore`**, which many projects share. Anyone with it can build an "update" for `com.hamim.budgetapp` that Android will accept, and it can then read the DB. Play Store publishing is impossible with it. | Phase 14: private keystore + signing plugin. **The switch on the owner's phone needs export → uninstall → install → import, done by the owner using the runbook.** The agent never does it. |
| High | S2 | No export or backup, so any key change or phone loss = data loss. | Phase 14: JSON backup export/import. |
| Med | S3 | `src/data/db.ts:11-23` caches a rejected `repoPromise`, so "Retry" after a DB failure can never succeed. | Reset `repoPromise = null` in the catch block, plus a test. |
| Med | S4 | Delete-all (`src/app/settings/index.tsx:242`) doesn't cancel scheduled reminders. | Call `cancelAllReminders()`, plus a test. |
| Med | S5 | Unneeded permissions: `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`. | `android.blockedPermissions` in app config. |
| Med | S6 | `allowBackup=true` with no rules, so the DB goes to Google auto-backup (E2E-encrypted when the phone has a lock screen). That's currently the *only* off-device copy. | **Decision: keep it on for v1.2** (safety net) and document it in Settings → Privacy. Revisit once in-app backup exists. |
| Low | S7 | No `maxLength` on description, note, or quick-entry input; nothing checked in the repo either. | description 120, note 500, quick-entry 300, category name 32. Validate in `validation.ts` too. |
| Low | S8 | `sqliteRepo.ts:456` calls `JSON.parse` on a settings value without try/catch. | Use a safe parse with a default. |
| Low | S9 | Delete-all doesn't `VACUUM`, so deleted data stays recoverable from free pages/WAL. | `VACUUM` + `wal_checkpoint(TRUNCATE)` after delete-all. |
| Low | S10 | Speech recognition may go to Google's online recogniser. | Use `requiresOnDeviceRecognition: true` when supported; otherwise show a one-time disclosure. |
| Low | S11 | DB unencrypted at rest. | v1.3 (SQLCipher + secure-store key; re-encrypting real data needs its own careful migration). The app lock in Phase 19 covers casual access. |

---

## 2. Product direction (what v1.2 is)

A **personal money notebook** that answers four questions at a glance:
1. **What do I have?** Wallets and balances (Cash, bKash, Nagad, Upay, Rocket, Bank, Card).
2. **What moved?** Money in, money out, and transfers between wallets, each tagged with its wallet.
3. **Who owes what?** Dues: lent to and borrowed from people, settled over time.
4. **Am I on plan?** The budget (optional) and insights.

It stays simple: the wallet is **optional** on every entry, and everything still works for someone who logs only "350 lunch". It's technical where it matters: balances, fees and dues are exact and tested.

**Navigation (owner-approved 2026-11-13, see `mockup.html`):** `Home · Ledger · [ + ] · Plan · People`. Ledger is the old Activity. Plan is the old Budget and now holds, as sections on one scrolling screen: Budget/payday split, Bills, Bazar lists, Occasions, and **Insights** (the old Insights tab, reached from Plan's "Insights" row and from Home's card). People is the dues list (old plan had it under Settings). Wallets are reached from Home's wallet list ("Manage").

**Day-to-day features (owner-approved, §8):** close the day with a cash count, bazar lists, monthly bills, people with a polite reminder, payday split into envelopes, occasions, and home-screen widgets.

---

## 3. Visual system v1.2 (see `mockup.html`)

- **Typeface:** **Plus Jakarta Sans** (`@expo-google-fonts/plus-jakarta-sans`, weights 400/500/600/700/800). Numbers use `fontVariant: ['tabular-nums']`. Verify on the phone that figures don't shift width when they change; if the font lacks `tnum`, switch to **Manrope** and log it.
- **The ৳ sign:** render it with **Hind Siliguri SemiBold** (`@expo-google-fonts/hind-siliguri`), which draws ৳ properly and is Bangla-ready for later. Build one `TakaSign` path inside `Money`: size = 0.72 × number size, opacity 0.8, baseline nudged so its top aligns with the figures' cap height, tuned per size bucket (12/15/17/28/40). Never let Android fall back for ৳. Verify on the phone at every size (Phase 15 Done-when).
> **The owner rejected the first gradient draft as "AI slop" (every fintech app looks like it).** The approved look is the refined `mockup.html`; the old one is kept as `mockup-draft1-gradient.html` for reference only. **Do not reintroduce:** gradients, glow, glass/translucent tiles, drop shadows, tinted coloured icon squares, horizontal card carousels, pill rows, a floating tab bar, masked numbers with dots.

- **Colour:** warm neutrals (light `bg #F6F5F1`, `surface #FFFFFF`, `line #E5E2DB`; dark `bg #0B0B0C`, `surface #151517`, `line #26262A`), one accent, category colours, wallet brand-ish colours. Exact tokens are in the mockup's `[data-theme]` blocks; copy them into `tokens.ts` and keep the contrast tests (text roles ≥ 4.5:1).
- **Depth:** flat. Cards are `surface` with a 1 px `line` border and **no shadow**. The only filled block is the **hero card** (Home total, occasion summary, share card): one **solid** colour per accent theme (Forest `#123227` light / `#13241D` dark), no gradient, no highlight, no ring. `expo-linear-gradient` is not needed.
- **Category icons:** the icon carries the category colour on a neutral `sunken` tile (`#EEEDE8` / `#1C1C1F`). Never a tinted tile.
- **Lists, not carousels:** wallets are a vertical list with balances. Ledger wallet filters are underlined words. Add-screen wallet and time are tappable rows, not chips.
- **Primary actions use "ink":** the main buttons and the + are near-black (light) or near-white (dark). Accent is for meaning (money in, active, selected), not decoration.
- **Tab bar:** flush at the bottom, `bg` colour, 1 px top hairline, 64 dp tall, the + as a 46 dp rounded square (radius 14). Not floating.
- **Wallet identity:** monogram tiles (bK, N, U, R) on brand-like colours (bKash `#E2136E`, Nagad `#F15A22`, Upay `#0F4C9C`, Rocket `#8C3494`), plus icon tiles for Cash (`wallet`), Bank (`landmark`) and Card (`credit-card`). **No official logos** (trademarks). Colours are editable.
- **Copy & feeling:** time-aware greeting (Morning / Afternoon / Evening / Night), plain words, small human touches ("All caught up for today ✓" after check-in). Never cutesy.
- **Numbers:** averages display as whole taka (`৳2,488`); missing values show "—" with a reason. Decimals are shown only if the user turns on "Show পয়সা", or the amount was entered with decimals.

### Personalisation (Settings → Appearance)
- **Accent themes:** Forest (default), Ocean, Plum, Saffron, Graphite. Each defines the accent + the solid hero colour for light and dark (swatches in the mockup's Appearance screen).
- **Mode:** System / Light / Dark / **Black** (true-black AMOLED surfaces).
- **Privacy & format toggles:** "Hide amounts when the app opens" (amounts replaced by the word `Hidden` until you tap the hero card; never dots or asterisks, AGENTS §4b); "Show পয়সা (decimals)"; "Compact numbers" (৳48.3k on cards only, never in the ledger); "Week starts on" (Saturday default, then Sunday, Monday).
- **Home sections:** show/hide and reorder Wallets, Dues, Budget, Today, Spending chart.

---

## 4. Data model v1.2 (additive migrations only; AGENTS §6)

```sql
-- migration v3: wallets + transfers
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                                -- 'bKash', 'City Bank', 'Cash'
  kind TEXT NOT NULL CHECK (kind IN ('cash','mobile_wallet','bank','credit_card','other')),
  provider TEXT,                                     -- 'bkash'|'nagad'|'upay'|'rocket'|'cellfin'|NULL
  color_key TEXT NOT NULL, monogram TEXT,            -- 'bK'
  last4 TEXT,                                        -- cards only, 4 digits, optional
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,  -- may be negative (card owed)
  opening_date TEXT NOT NULL,                        -- 'YYYY-MM-DD'; balance counts entries ON/AFTER this date
  include_in_total INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
ALTER TABLE transactions ADD COLUMN account_id TEXT REFERENCES accounts(id);   -- NULL = no wallet
ALTER TABLE transactions ADD COLUMN transfer_id TEXT;                           -- set on a transfer's fee expense
CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  from_account_id TEXT NOT NULL REFERENCES accounts(id),
  to_account_id   TEXT NOT NULL REFERENCES accounts(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  occurred_on TEXT NOT NULL, occurred_time TEXT, note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER,
  CHECK (from_account_id <> to_account_id)
);
CREATE INDEX idx_tx_account ON transactions (account_id, occurred_on);
CREATE INDEX idx_tr_date ON transfers (deleted_at, occurred_on);
-- seed category 'fees' ("Fees & charges", receipt icon, gray) with INSERT OR IGNORE

-- migration v4: people & dues
CREATE TABLE people (id TEXT PRIMARY KEY, name TEXT NOT NULL, color_key TEXT NOT NULL,
  archived_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE due_entries (
  id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES people(id),
  kind TEXT NOT NULL CHECK (kind IN ('lent','borrowed','received_back','paid_back')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  account_id TEXT REFERENCES accounts(id),           -- optional
  occurred_on TEXT NOT NULL, occurred_time TEXT, note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
```
**Existing transactions keep `account_id = NULL`.** Don't auto-assign them. The wallet setup asks for the balance **as of today** (opening_date = today), so old entries can't double-count. Offer an optional "Tag older entries" helper that only sets `account_id` and never changes balances (they're before the opening date).

### Money rules (exact; tests in TEST-CASES-v1.2)
- **Wallet balance** = opening_balance + Σ income(account, date ≥ opening_date) − Σ expense(account, ≥ opening_date) − Σ transfers out(amount) + Σ transfers in(amount) − Σ fee expenses (they're ordinary expenses on the *from* account) − Σ dues `lent` + `paid_back` from it + Σ dues `borrowed` + `received_back` into it, counting only entries on or after opening_date and not deleted.
- **Transfers are never spending or income.** A transfer **fee** is saved as a linked **expense** (category `fees`, account = from, `transfer_id` set). It *is* spending. Deleting or editing the transfer deletes or updates its fee row in the same DB transaction.
- **Dues are never spending or income.** Person balance = lent − received_back − borrowed + paid_back (positive = they owe you).
- **Total across wallets** = Σ balances of wallets with `include_in_total = 1`, not archived. A credit card with a negative balance is shown as "৳5,600 due" and reduces the total.
- Budgets, insights and every existing calc are unchanged: they already only look at `expense`/`income` transactions.

---

## 5. Sharing (offline, private by default)
There's no server, so sharing creates a file and hands it to Android's share sheet (`expo-sharing`). Nothing is uploaded by the app.
- **Snapshot card (image):** period summary rendered off-screen (`react-native-view-shot`) like the mockup. Toggles: show amounts (on), show wallets & balances (**off**), include transaction list (**off**).
- **CSV:** the current Ledger filter, with columns date,time,type,amount,currency,category,wallet,description,note.
- **PDF statement:** monthly statement (`expo-print`) per wallet or for all wallets.
- **Live shared books** (family or partner seeing the same ledger) need a sync server and auth. **That's out of scope for v1.2.** Note it in the summary as the v2 candidate.

## 6. Backup & restore (Phase 14, before anything else)
- **Export:** one versioned JSON (`{ app:'budget-app', schema: N, exportedAt, data:{ categories, transactions, budgets, settings, day_reviews, accounts?, transfers?, people?, due_entries? } }`). Save via the share sheet or Android's file picker (Storage Access Framework). Warn that the file is unencrypted.
- **Import:** parse → validate every row (types, amounts, dates, foreign keys) → show a preview ("1 Nov – 13 Nov · 12 transactions · 19 categories") → **Replace all** in ONE DB transaction (rolls back on any error) → bump dataVersion → reschedule reminders.
- Round-trip test: export → delete all → import → deep-equal data.
- A monthly nudge on Home: "Last backup: never · Back up now".
- **Release-key runbook** (`docs/v1.2/KEY-SWITCH.md`, written in Phase 14): the owner's step-by-step to export → install the new-key build (uninstall needed) → import → verify the counts match. The agent writes it and never executes it.

## 7. Dev app (protects the owner's data)
Add `app.config.ts` with `APP_VARIANT=dev`, which gives `com.hamim.budgetapp.dev` named "Budget Dev" with its own icon tint. **All e2e, destructive, sample-data and screenshot testing on the phone uses the dev app.** The owner's `com.hamim.budgetapp` only receives `install -r` of release builds signed with the *current* key in the final phase, after a successful export was verified on the dev app.

## 8. Day-to-day features (owner-approved 2026-11-13; screens 4–9 and 12 in `mockup.html`)

These turn the app from "a budget" into a money notebook someone actually keeps. Each one must work without wallets set up (falls back to "no wallet") unless noted. All new money maths lives in `src/domain/` with tests in TEST-CASES-v1.2 §F.

### 8.1 Close the day: cash count (mockup screen 4)
- Entry points: Home notice "Count your cash before bed" (shown after 6 pm when a Cash wallet exists and today isn't closed), the evening reminder notification, and Ledger's "Today" header.
- Denomination steppers for BD notes **1000, 500, 200, 100, 50, 20, 10, 5, 2** plus a "Coins" amount field. Counted = Σ note × count + coins.
- Expected = the Cash wallet's balance at end of today (`accounts.ts`). Difference = counted − expected.
- Outcomes: **match** (just close); **short** → "Write ৳X as lost track" creates an expense in a new seeded category `untracked` ("Lost track", icon `circle-help`, gray) from Cash, or "I forgot one, add it" opens Add prefilled with the amount from Cash; **over** → "Write ৳X as found" creates income `other_income` with note "Found when counting", or add the missing income.
- Saves a `cash_counts` row. Closing is optional and never blocks anything. Without a Cash wallet the screen offers to create one with the counted amount as its opening balance.

### 8.2 Bazar lists (screen 5)
- A list has a title ("Friday bazar"), optional place, optional wallet, items (name, quantity text, price optional, checked).
- Items can be added before shopping without prices. Ticking an item asks for its price (keypad sheet).
- "Save as one entry" creates **one** expense (category `groceries`, wallet of the list, description = title, amount = Σ checked prices) and links the list to it; the Ledger row shows "8 items" and opens the list. Unchecked items can be carried to a new list.
- **Price memory:** when an item name matches (case-insensitive, trimmed) an item in a previous saved list, show the last price and the change ("up ৳10 a kg since last week") only if the quantity text has the same unit. No price database, only the user's own history.
- "Use last list again" copies item names and quantities.

### 8.3 Monthly bills (screen 6)
- A bill = name, category (default `utilities`), optional wallet, due day (1–31, clamped to month length), amount (fixed) **or** variable (shows "usually ৳X" = median of its last 3 payments).
- Plan → Bills lists this month's bills split into "Due soon" (sorted by due date, the next 7 days highlighted) and "Paid". Progress "4 of 7 paid · ৳2,980 still to pay" (variable unpaid bills count at their usual amount; with no history they're left out and the line says "+ 1 variable").
- "Paid" opens a short sheet (amount prefilled, wallet, date today) and creates the expense + a `bill_payments` row for that month. Undo removes both in one DB transaction.
- Optional reminder the day before the due date (text without amounts: "DESCO electricity is due tomorrow").
- This is not a recurring-transaction engine: nothing is created automatically.

### 8.4 People reminder (screen 7, extends Phase 18)
- Person detail gets "Remind" with an **English | বাংলা** toggle and a polite prefilled message the user can edit before sending. Amount in the chosen language (Bangla digits for বাংলা):
  - EN: "Hi {name}, just a reminder about the ৳{amount} from {date}. No rush, whenever it suits you."
  - BN: "{name}{honorific}, সালাম। {date} এর ৳{amount} টাকার কথা মনে করিয়ে দিলাম। তাড়া নেই, সুবিধামতো দিও।" Honorific per person: none (default, so no gender is assumed), " ভাই" or " আপু".
- Buttons: WhatsApp (`whatsapp://send?text=`), Messenger (share sheet), Copy (clipboard). If WhatsApp isn't installed, fall back to the share sheet. Nothing is sent automatically.

### 8.5 Payday split (screen 8)
- When an income in category `salary` is saved (or from Plan → "Split my salary"), offer "Split it": envelope lines (name, amount, optional linked expense category, kind `spend`|`save`|`send`). The first time, lines are suggested from the categories with budgets; afterwards, last month's split is copied.
- "Placed ৳X of ৳Y" must reach Y to start, or the user taps "Leave ৳Z unplaced".
- "Start the month" writes the cycle's **budgets** (existing `budgets` table): total = Σ `spend` lines, per-category budgets for lines with a category. `save`/`send` lines are plans shown in Plan with "Mark done", which creates a transfer (to a savings wallet) or an expense (`family`, "Send home").
- During the month each spend envelope shows left = amount − spent in its category this cycle (existing calc).

### 8.6 Occasions (screen 9)
- An occasion = name, place, date, amount set aside, "Keep out of my monthly budget" (default on), closed flag.
- Any expense can be tagged with an occasion (Add screen row "Occasion", shown only while an occasion is open). Occasion page: set aside / spent / left + its entries.
- **With "keep out" on, tagged expenses are excluded from the monthly budget, safe-to-spend and Insights totals**, and Insights shows them as a separate "Occasions" line. Wallet balances always include them (the money really left).

### 8.7 Home-screen widgets + evening reminder (screen 12)
- Android widgets via `react-native-android-widget` (config plugin; dev build only): **Today** (spent today, Cash balance, buttons Out / In / Bazar list deep-linking into the app), **Person owes** (largest open due), **Next bill**. "Hide amounts on widgets" setting replaces amounts with `Hidden`.
- The evening reminder text becomes "Close today? {n} entries today. Count your cash before bed." Never amounts.
- If the widget library can't build on SDK 58 after 3 tries: BLOCKED, keep the notification part.

### 8.8 Data model (migration v5, additive only)
```sql
CREATE TABLE cash_counts (id TEXT PRIMARY KEY, account_id TEXT REFERENCES accounts(id), counted_on TEXT NOT NULL,
  counted_minor INTEGER NOT NULL, expected_minor INTEGER NOT NULL, notes_json TEXT NOT NULL,   -- {"500":1,"200":1,"coins":500}
  outcome TEXT NOT NULL CHECK (outcome IN ('match','lost_track','found','added_entry','skipped')),
  transaction_id TEXT, created_at INTEGER NOT NULL);
CREATE TABLE shopping_lists (id TEXT PRIMARY KEY, title TEXT NOT NULL, place TEXT NOT NULL DEFAULT '',
  account_id TEXT REFERENCES accounts(id), transaction_id TEXT, saved_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER);
CREATE TABLE shopping_items (id TEXT PRIMARY KEY, list_id TEXT NOT NULL REFERENCES shopping_lists(id),
  name TEXT NOT NULL, qty_text TEXT NOT NULL DEFAULT '', price_minor INTEGER, checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE bills (id TEXT PRIMARY KEY, name TEXT NOT NULL, category_id TEXT NOT NULL, account_id TEXT REFERENCES accounts(id),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31), amount_minor INTEGER, is_variable INTEGER NOT NULL DEFAULT 0,
  remind INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, archived_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE bill_payments (id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES bills(id), period TEXT NOT NULL,  -- 'YYYY-MM'
  transaction_id TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE (bill_id, period));
CREATE TABLE pay_splits (id TEXT PRIMARY KEY, cycle_start TEXT NOT NULL, income_minor INTEGER NOT NULL,
  income_transaction_id TEXT, started_at INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE pay_split_lines (id TEXT PRIMARY KEY, split_id TEXT NOT NULL REFERENCES pay_splits(id), name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0), category_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('spend','save','send')), done_transaction_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE occasions (id TEXT PRIMARY KEY, name TEXT NOT NULL, place TEXT NOT NULL DEFAULT '', on_date TEXT,
  budget_minor INTEGER NOT NULL DEFAULT 0, exclude_from_monthly INTEGER NOT NULL DEFAULT 1, closed_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
ALTER TABLE transactions ADD COLUMN occasion_id TEXT REFERENCES occasions(id);
ALTER TABLE transactions ADD COLUMN shopping_list_id TEXT REFERENCES shopping_lists(id);
-- seed category 'untracked' ("Lost track", circle-help, gray) with INSERT OR IGNORE
```
Backup export/import includes every new table (§C round-trip must still pass).
