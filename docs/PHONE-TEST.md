# Phone Verification Checklist (Android — v1.1)

Automated unit tests, RNTL component tests, and Playwright web Chromium tests cannot verify native Android SQLite persistence across app force-kills, OS notification alarms, Material native date/clock dialogs, native microphone capture, haptic feedback, or hardware cutouts. Run through this checklist on your Galaxy S25 Ultra.

> **Protecting your real data:** Never uninstall (`adb uninstall`), run `pm clear`, or restore-wipe the app on your phone. Always upgrade over the top using `adb install -r` so your SQLite transactions, categories, and preferences stay intact.

---

## 0. Install Release APK or Start Dev Server

### Option A — Standalone Release APK (recommended, no PC needed to open)
```powershell
adb connect <phone-ip-or-tailscale>:<port>
adb -s <device> install -r android\app\build\outputs\apk\release\app-release.apk
```
Stop any Metro bundler, swipe the app away, and cold-start **Budget App** from the launcher. Confirm it opens immediately with your real data intact and **Settings → About** reads **`Version 1.1.0 · Offline · No tracking`**.

### Option B — Live Metro Dev Client / Expo Go
```powershell
$env:CI="1"; npx expo start --port 8081
```
*(If plugged over Tailscale/ADB, forward port 8081 first: `adb -s <device> reverse tcp:8081 tcp:8081`.)*

---

## 1. Navigation & Home Dashboard

1. Verify bottom navigation shows **`Home · Activity · [ + ] · Budget · Insights`** with the floating green circle `+` centered (Settings is no longer a tab).
2. Tap top-right avatar badge **`(H)`** on Home → confirm it pushes **Settings**, then navigate back.
3. On Home:
   - [ ] Check hero **Left to spend** amount, status pill (`On track` / `Watch` / `Over`), `Safe today | Spent | Income` row, and cycle date label (e.g. `10 Nov – 9 Dec` for cycle day `10`).
   - [ ] Tap **`⋯`** on the hero card → verify formula explanation **Sheet** opens cleanly with crisp backdrop scrim.
   - [ ] Switch chart inline between **`Day | Week | Month`** and confirm smooth bar highlight + axis labels ending on `Today`.

---

## 2. Add, Edit, Delete & Native Pickers

1. Tap center **`+`** → confirm **Add transaction** opens with **no preselected category**, ordered `4×2` category tiles (most recent/frequent first + `All…`), and keypad docked above `Save expense`.
2. Tap the Date pill (`Today`) and Time pill → confirm native **Android Material calendar & clock dialogs** open (do not save a fake entry unless you delete it afterwards).
3. Tap the **`What was this for?`** description field → verify the numeric keypad hides automatically so your OS keyboard isn't cramped.
4. Pick a category (or create a custom one inside `All…` → `+ New category`) and verify suggestion chips below the input match **only** that `(type, category)`.
5. Optional temporary entry test *(clean up immediately)*: save one test entry named **`UI TEST – delete me`**, reopen it from Activity, tap top-right **`⋯`** → **Delete** → confirm two-step sheet removes it cleanly and shows the `Deleted` toast.
6. Long-press center **`+`** (or tap **Say or type it** on Home) → verify **Quick Entry** parses `"350 lunch and 120 rickshaw"` into two editable draft cards without touching totals until confirmed.

---

## 3. Activity, Filters & Cycle-Aligned Insights

1. Open **Activity**:
   - [ ] Scroll past several days → verify sticky uppercase date headers + daily net totals (`−৳...` / `+৳...`) and `Category · 9:40 PM` subtitles.
   - [ ] Tap **Filter** icon → open **Filters bottom sheet** → test Type segmented control, multi-select category tiles, Date presets / two `DateField`s, min/max amount, and `Show N results` footer.
2. Open **Insights**:
   - [ ] Tap top-right period dropdown (`This cycle`) → confirm 7-option bottom sheet opens cleanly.
   - [ ] Verify the **Last complete cycle** card reads exact billing cycle dates (e.g. **`10 Oct – 9 Nov vs 10 Sep – 9 Oct`** for cycle start day `10`, not calendar month names).
   - [ ] Scroll through `Averages`, `Biggest`, `Changes`, and `History` chart; tap any category row → verify Activity opens pre-filtered.

---

## 4. Budget, Settings, Categories & Daily Reminders

1. Open **Budget**:
   - [ ] Verify hero `ProgressRing`, single `Edit` button, single `+ Add category budget` dashed row, and collapsible **Past cycles**.
2. Open **Settings** (via Home avatar):
   - [ ] Open **Name**, **Budget cycle starts** (`DayOfMonthGrid` 1–28 with live `Current cycle:` preview), and **Appearance** (3 visual swatch cards: `System`, `Light`, `Dark`).
   - [ ] Verify **Reminders** shows Toggle switch, **Time** row (tapping opens Android native clock dialog), **`S M T W T F S`** circular day toggles, and **`[Every day]` / `[Sun–Thu]`** chips.
   - [ ] If you test toggling reminder days or time, **revert it back to your preferred schedule** (e.g., Every day, `21:00` / `9:00 PM`) before leaving Settings.
   - [ ] Confirm Appearance is set back to **System** when done checking Light & Dark themes.
3. Open **Settings → Categories**:
   - [ ] Switch `Expense | Income`, tap a category to verify the edit sheet (live preview, **13 color swatches**, **24 Lucide icons**, `Archive category` button), and check that **`Other`** / **`Other Income`** hide the archive button cleanly.

---

## 5. Offline Persistence, Check-in & Hardware Hygiene

1. **Force-kill persistence:** Completely swipe **Budget App** from Android Recent Apps, reopen it offline (Wi-Fi/mobile data off if desired), and confirm Home, Activity, Budgets, Insights, and Settings load with zero changes lost.
2. **Notifications without amounts:** Verify check-in reminder copy on lock screen never shows any currency amounts and tapping it deep-links to `/check-in` (`Today` hero + `Spent | Income | Entries` + `Done for today`).
3. **Display scaling & cutouts:** Check top status-bar punch-hole padding and bottom 3-button / gesture navigation clearance on Home, Add, Filters sheet, Budget, Insights, Settings, and Categories in both Light and Dark themes.
