# Phone Verification Checklist (Android)

Automated unit tests, RNTL component tests, and Playwright web Chromium tests cannot verify native Android SQLite persistence across app force-kills, OS notification alarms, native microphone capture, haptic feedback, or hardware cutouts. Run through this checklist on your physical Android phone in the morning.

---

## 0. Start the Dev Server

1. Make sure your PC and Android phone are on the **same Wi-Fi network**.
2. Install **Expo Go** from the Google Play Store.
3. In `Desktop\budget-app`:
   ```powershell
   npx expo start
   ```
4. Scan the QR code with **Expo Go**.

---

## 1. Core Flows & Force-Kill SQLite Persistence (Critical)

1. Walk through all **6 onboarding steps** (Name, Currency `BDT ৳` + start day, Monthly budget e.g. `40000`, Categories, Daily reminder, Summary).
2. Confirm **Overview** renders your name, remaining budget, and safe-to-spend/day.
3. Tap **`+`** (or **Say or type it**) to add one **Expense** (e.g. `350` for Lunch) and one **Income** (e.g. `50000` Salary).
4. **Kill Expo Go completely** from Android Recent Apps (swipe it away).
5. Reopen Expo Go and open **Budget App**:
   - [ ] Does it go straight to Overview (skipping onboarding)?
   - [ ] Are both the Expense and Income still visible in **Activity**?
   - [ ] Do **Overview** remaining budget (`Monthly budget - Expenses`) and Income total still match exact numbers?

---

## 2. Local Daily Reminders & Deep Link (Items in `Needs phone test`)

1. Open **Settings → Daily Check-in Reminder**.
2. Toggle the reminder **ON**:
   - [ ] Does the app show an explanation modal **before** the Android system notification permission prompt?
3. **Test happy path (Allow permission):**
   - [ ] Pick a time **1–2 minutes in the future** (using the custom `HH:MM` field and **Save**), wait for the notification.
   - [ ] Verify the notification text is friendly and does **not** expose any Taka/dollar amounts on the lock screen.
   - [ ] Tap the delivered notification → verify it opens directly to the **`/check-in`** screen!
4. **Test zero-spend Check-in:**
   - If testing on a day with 0 expenses, open **Daily Check-in** from Overview → tap **"Nothing spent today — mark reviewed"** → verify the **Reviewed** badge appears without creating any fake ৳0 transaction.
5. **Test Permission Denied recovery:**
   - Revoke notification permission in Android App Settings for Expo Go, return to **Settings** in Budget App, and try toggling the reminder back ON → verify it displays the non-crashing **"Enable in system settings"** button cleanly instead of nagging silently.

---

## 3. Voice Entry vs Expo Go Fallback

1. On **Expo Go** (standard Play Store build):
   - Open **Quick Entry** (Overview → *Quick entry* pill or `+` → *Say or type it*).
   - [ ] Verify the screen does **not** crash on startup!
   - [ ] Verify the **Mic button is hidden** automatically with a short note saying typed quick entry works offline.
   - [ ] Type `"350 taka lunch"` → tap **Parse** → verify draft shows `৳ 350`, `Food & Dining`, `Lunch`, and **Overview stays unchanged until you tap Confirm**.
   - [ ] Type `"Spent 500 on Uber and 200 on coffee"` → verify 2 drafts appear, edit one amount/description, then tap **Confirm & Save**.
   - [ ] Type `"lunch"` → verify it asks `"How much?"` without saving; type `"hello"` → verify friendly empty-parse message.
2. *(Optional — requires native Development Build via `npx expo run:android`, not Expo Go):*
   - [ ] Verify Mic button appears, shows explanation before mic permission prompt, streams live transcript into the input box, and lets you review/confirm drafts.

---

## 4. Budget & Insights Sanity

1. Open **Budget**:
   - [ ] Tap **Edit budget**, change monthly budget → confirm Overview & Budget both update immediately.
   - [ ] Add a per-category budget (e.g. `Food & Dining`) → check **Allocated vs Remaining to allocate** banner.
   - [ ] Try deleting/archiving a category via **Settings → Manage categories** → verify existing transactions keep displaying properly.
2. Open **Insights**:
   - With sample data loaded *(Settings → Developer tools → Load sample data ~150 items)*:
   - [ ] Cycle presets (`This week`, `This month`, `Last month`, `3 months`, `6 months`, `This year`, `Custom`).
   - [ ] Tap **Highest spending category** or a **Spending pattern** sentence → confirm it opens **Activity** already pre-filtered with matching active filter chips!
   - *(Clean up afterwards via Settings → Clear sample data or Delete all data if needed.)*

---

## 5. Tactile, Accessibility & Hardware Layout Checks

1. **Haptics:** Verify light tactile feedback triggers subtly on primary saves / Confirm & Save / Done actions without feeling jarring.
2. **Dark Mode:** In **Settings → Appearance**, test **System**, **Light**, and **Dark** against your Android system theme toggle — verify readable contrast and crisp borders on all 5 tabs.
3. **Large OS Text Scaling:** Go to **Android Settings → Display → Display size and text → increase Font size to Large / Largest**, reopen Budget App:
   - [ ] Check Overview headline balance, 2×2 metric cards, Quick Entry cards, Insights cards, and Tab Bar labels for clipping or overlapping text.
4. **Safe Areas & Cutouts:**
   - [ ] Check top camera punch-hole / status bar padding on Overview, Add Transaction (`New`), Check-in, Quick Entry, and Category detail screens.
   - [ ] Check bottom gesture bar / 3-button Android navigation bar does not overlap the bottom tab bar or modal Confirm/Save buttons.
   - [ ] Open the keyboard inside **New Transaction** and **Quick Entry** and verify `KeyboardAvoidingView` keeps the amount/description inputs and Submit button reachable.
5. **TalkBack *(quick spot-check)*:** Swipe through Overview balance, chart (`accessibilityLabel` narrative summary), Activity search/filters, and `+` button — verify every interactive control announces a clear role and label.
