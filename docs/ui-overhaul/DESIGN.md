# UI OVERHAUL v1.1 — audit + design system + screen layouts

**This file overrides SPEC §3 (visual direction) and ARCHITECTURE §6 (tokens) for everything visual.** The SPEC DECISIONS block (money rules, v1 scope, no cloud) still applies, except where §4 below explicitly changes something.

Visual reference: open `docs/ui-overhaul/mockup.html` in your browser. It shows Home, Add, Budget, Activity and Settings in **light and dark**. Match its hierarchy, spacing and colour roles. It's a guide, not pixel law: when the mockup and this file disagree, this file wins.

Before screenshots of the current app (real phone, S25 Ultra, dark mode) are in `docs/ui-overhaul/before/`.

---

## 1. Audit — what's wrong today (from the phone, 2026-11-13)

### Visual
| # | Problem | Where (screenshot) |
|---|---|---|
| V1 | Every element is the same outlined dark box (cards, buttons, inputs, chips, keypad keys). Nothing has hierarchy, so it reads as a template rather than a product. | all |
| V2 | Green-tinted greys everywhere (`#0F1412`, `#171D1B`…). It looks muddy rather than premium. Light mode has the same tint. | all |
| V3 | No hero. On Overview the biggest thing is an empty-state card ("No budget set") that takes up half the screen. | 01-overview |
| V4 | The 2×2 metric cards wrap their labels ("Safe to spend / day", "Income this month") and show `—` or `৳ 0` in big type. They're noisy and add little. | 01-overview |
| V5 | Expense amounts are all bold `−৳ 2,000`, which is heavy. Only income is coloured, and icon tiles are all the same grey circle. Categories have no colour identity. | 02, 05 |
| V6 | Mixed icon styles (filled wallet, outline repeat, dots), all in one grey tile. | 02, 05 |
| V7 | Empty states are oversized (Budget's "No category budgets" block is ~600 px tall). | 06-budget |
| V8 | Chart x-axis labels collide (`8 9`). The empty chart is a large blank box. | 02 |
| V9 | Insights period chips are cut off at the edge with no affordance, and the copy uses jargon ("No spending in prior comparison window"). | 07-insights |
| V10 | Settings is one long form of raw controls: a `-`/`+` stepper for the month start day, and reminder time as chips labelled "24h HH:mm". | 08-settings |
| V11 | Add screen: keypad in the middle of a scrolling page, Save off-screen, category chips cut off, a big "Say or type it" banner competing with the amount. | 09-add |

### Functional
| # | Problem | Where |
|---|---|---|
| F1 | **The floating "+" covers content on every tab**: recent amounts, the Monthly segment, the "Add category" button, Settings controls. It also shows on Settings, where it makes no sense. | 01, 02, 06, 07, 08 |
| F2 | Settings appears twice: a header gear on Overview and a Settings tab. | 01 |
| F3 | **"Pick date" is a text box where you type `2026-11-13`.** Time is typed as `HH:mm`, and reminder time is chips. No real date or clock pickers anywhere. | 10-add-pickdate, 08 |
| F4 | **Cycle labels are misleading when the budget month starts on the 10th.** Insights says "Oct 2026: ৳4,600", but those expenses were on **9 Nov** (cycle 10 Oct – 9 Nov). Overview shows Expense ৳0 with no hint that a new cycle just began. | 07, 01 |
| F5 | Duplicate calls to action: Budget has both a "Set budget" link and a "Set budget" button, and both an "Add category" link and an "Add category" button. | 06 |
| F6 | The month start day can only change one day per tap (up to 27 taps). | 08 |
| F7 | "Weekdays" reminders are Mon–Fri, but the Bangladesh work week is Sun–Thu. | 08, D-005 |
| F8 | The Add form preselects **Food & Dining**, so a quick save files the expense in the wrong category without the user noticing. | 09-add |
| F9 | Description suggestions mix income and expense (expense mode suggests "Rent Narsingdi", which is income). | 09-add |
| F10 | No time is recorded unless typed, so lists can't show "9:40 PM". | 05 |
| F11 | No income category fits rent received (the user files it as "Other Income"). | 05 |

---

## 2. Design principles
1. **One hero per screen.** Home = "Left to spend". Budget = the cycle ring. Add = the amount. Everything else is quieter.
2. **Tone, not outlines.** Cards are separated from the background by surface colour, not borders. Borders appear only on inputs (focus) and as hairline list dividers.
3. **Neutral base, one accent, category colour.** Greys are true neutral (zinc). Emerald is the only brand accent. Colour otherwise comes from category identity and status (over budget).
4. **Expenses are neutral, income is accent.** Expense rows use the primary text colour with `−`. Income rows use accent with `+`. Red is reserved for *over budget* and destructive actions.
5. **Native pickers, never typed dates.** Date = Material calendar dialog. Time = Material clock dialog. Choices = bottom sheets.
6. **Compact empty states.** At most about 160 dp: icon tile, one line, one button.
7. **Nothing floats over content.** Add lives in the tab bar, and every scroll view has bottom padding equal to the tab bar height plus 16.

---

## 3. Design tokens v2 (replace `src/theme/tokens.ts` values; keep the token names where possible, add new ones)

### Colour
| role | light | dark | notes |
|---|---|---|---|
| `bg` | `#F5F5F7` | `#0A0A0C` | app background |
| `surface` | `#FFFFFF` | `#151518` | cards, sheets |
| `surfaceRaised` | `#FFFFFF` | `#1D1D21` | sheet on sheet, pressed rows, keypad keys |
| `surfaceSunken` | `#EEEEF1` | `#101013` | inputs, segmented track, progress track |
| `separator` | `#E6E6EA` | `#232327` | hairline (`StyleSheet.hairlineWidth`) |
| `text` | `#0B0B0D` | `#F4F4F5` | primary text, expense amounts |
| `textSecondary` | `#5C5F66` | `#A1A1AA` | labels, meta (must pass 4.5:1 on surface & bg) |
| `textTertiary` | `#8B8F97` | `#71717A` | placeholders, disabled only (exempt from 4.5:1, never essential info) |
| `accent` | `#0C8A5F` | `#34D399` | brand, income, active tab, primary button bg |
| `onAccent` | `#FFFFFF` | `#04241A` | text on accent |
| `accentSoft` | `#E4F5EE` | `#10291F` | selected chip bg, positive pill bg |
| `warning` | `#B45309` | `#FBBF24` | 85–100% |
| `danger` | `#D92D20` | `#F87171` | over budget, delete |
| `dangerSoft` | `#FDECEA` | `#2A1414` | over-budget pill bg |
| `scrim` | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.6)` | behind sheets/dialogs |

Light cards get a soft shadow (`0 1 2 rgba(16,24,40,.04)`, `0 1 3 rgba(16,24,40,.06)`, elevation 1 on Android). Dark cards get **no shadow**. Update `tokens.test.ts` contrast checks for every text role × {bg, surface, surfaceRaised}, and accent text on surface. If a hex fails, adjust it minimally and log a D-entry.

### Category identity (new: `src/theme/categoryColors.ts`)
Each category gets a `colorKey`. The tile background is the colour at **14% opacity** (light) or **18%** (dark), and the glyph is the full colour.

| colorKey | light | dark | default categories |
|---|---|---|---|
| orange | `#E8590C` | `#FF922B` | food_dining |
| green | `#2F9E44` | `#69DB7C` | groceries |
| blue | `#1C7ED6` | `#4DABF7` | transportation, business |
| pink | `#D6336C` | `#F783AC` | shopping, personal_care |
| violet | `#7048E8` | `#9775FA` | housing_rent, rent_income |
| amber | `#E67700` | `#FFD43B` | utilities |
| red | `#E03131` | `#FF8787` | health |
| grape | `#AE3EC9` | `#DA77F2` | entertainment, gifts |
| indigo | `#4263EB` | `#748FFC` | education |
| cyan | `#0C8599` | `#3BC9DB` | travel |
| teal | `#099268` | `#38D9A9` | subscriptions, salary |
| lime | `#5C940D` | `#A9E34B` | family |
| gray | `#6B7280` | `#9CA3AF` | other, other_income, gift_received |

Users can change a category's colour and icon in Settings → Categories (pick from these 13 swatches and the icon list).

### Icons
Use **`lucide-react-native`** (JS-only, uses the installed `react-native-svg`) for *all* icons, at 1.75 stroke width and 20/24 px. If it fails with RN 0.88 after 3 tries, use `Ionicons` **outline** variants only and log it. Never mix filled and outline styles.

Category icons: food_dining `utensils` · groceries `shopping-basket` · transportation `car` · shopping `shopping-bag` · housing_rent `house` · utilities `zap` · health `heart-pulse` · entertainment `clapperboard` · education `graduation-cap` · travel `plane` · subscriptions `repeat` · personal_care `sparkles` · family `users` · gifts `gift` · other `circle-ellipsis` · salary `banknote` · business `briefcase` · gift_received `hand-heart` · rent_income `building-2` · other_income `circle-plus`.
UI icons: tabs `house`, `list`, `pie-chart`, `chart-column`; plus `plus`, `search`, `sliders-horizontal`, `calendar`, `clock`, `mic`, `chevron-right`, `chevron-down`, `x`, `check`, `pencil`, `trash-2`, `lock`.

### Typography (Inter, already loaded; add `Inter_700Bold` if needed)
| token | size/line | weight | tracking | use |
|---|---|---|---|---|
| `hero` | 44/50 | 600 | −1.2 | the screen's one hero number |
| `display` | 30/36 | 600 | −0.6 | amount on Add, ring centre |
| `title` | 22/28 | 600 | −0.3 | screen titles |
| `headline` | 17/24 | 600 | −0.2 | section titles, card titles |
| `body` | 15/22 | 400 | 0 | default |
| `bodyStrong` | 15/22 | 500 | 0 | row titles, amounts in lists |
| `label` | 13/18 | 500 | 0 | field labels, meta |
| `caption` | 12/16 | 500 | +0.2 | axis labels, tab labels (11/14 for tabs) |

**Money component:** the currency symbol is rendered at 0.6× the number size in `textSecondary`, baseline-aligned, with a 2 dp gap. Always `tabular-nums`. Negative = `−` (U+2212), not hyphen.

### Geometry
Spacing: keep the 4-pt scale. Screen margin **20**, card padding **20**, list row height **64** (icon tile 40), section gap **28**, gap between cards **12**.
Radius: card **20**, sheet top **28**, button **14**, input **14**, icon tile **12**, chip pill, keypad key **16**.
Buttons: height **52** (primary/secondary), **40** (small), full-width primary in sheets. Primary = accent fill, secondary = `surfaceSunken` fill, tertiary = text-only accent.
Touch targets ≥ 48.

### Motion
Press feedback: scale 0.97 plus opacity 0.9, 120 ms. Sheets: native/spring. Hero number counts up 300 ms when it changes (skip if reduce motion is on). `expo-haptics`: light impact on keypad, success notification on save.

---

## 4. Navigation & behaviour changes (these update SPEC/DECISIONS)

- **Tab bar: 4 tabs + a centre Add button.** `Home · Activity · [ + ] · Budget · Insights`. The + is a 56 dp accent circle in the bar (not floating over content). **Tap** opens Add. **Long-press** opens Quick Entry ("Say or type it"). This reverses D-002, because the floating + covered content on every screen.
- **Settings moves to an avatar button** (user initial in a 36 dp circle) at the top-right of Home. Activity, Budget and Insights have no gear. Remove the Settings tab.
- **Add form has no preselected category.** Save is disabled until amount > 0 **and** a category is chosen. The most recently used category is shown first in the grid, but not selected.
- **Time is auto-filled** with the current local time on new transactions (still editable, still optional). Lists show `Category · 9:40 PM`.
- **New income category `rent_income` ("Rent income", building-2, violet)**, added by migration if missing.
- **Reminder days:** replace everyday/weekdays with 7 day toggles plus presets **Every day** and **Sun–Thu**. Default: every day. Stored as `days: number[]` (0 = Sun … 6 = Sat). Read the old `everyday`/`weekdays` values and convert them; don't crash.
- **Cycle-aware labels everywhere:** when `monthStartDay === 1`, label periods by month name ("November"). Otherwise label by date range ("10 Oct – 9 Nov"). Never call a 10 Oct – 9 Nov cycle "Oct 2026".
- **New-cycle hint on Home:** during the first 7 days of a cycle (elapsed ≤ 7), if the previous cycle had spending, show a slim row: "New cycle started 10 Nov · Last cycle you spent ৳4,600 ›" (taps to Insights → last cycle).

---

## 5. Components to (re)build — `src/ui/`
`Surface` (card) · `Button` (primary/secondary/tertiary/danger, sizes) · `IconButton` · `IconTile` (category colour tile) · `Money` (v2 rules above) · `ListRow` (leading tile, title, subtitle, trailing value/chevron/switch) · `SettingsGroup` + `SettingsRow` · `Sheet` (bottom sheet; prefer Expo Router `presentation: 'formSheet'` with detents; use `@gorhom/bottom-sheet` only if formSheet can't do it, and log the choice) · `SegmentedControl` (sunken track, raised thumb) · `Chip` (selectable pill) · `Field` (label + input, focus ring accent) · `DateField` + `TimeField` (chip that opens the native picker) · `DayToggles` (7 circles) · `DayOfMonthGrid` (1–28) · `ProgressBar` (status colours) · `ProgressRing` (svg) · `Keypad` (v2) · `EmptyState` (compact) · `Banner` (slim info row) · `Toast` ("Saved", 1.5 s).

**Native pickers:** `npx expo install @react-native-community/datetimepicker`. On Android, call `DateTimePickerAndroid.open({ mode: 'date' | 'time', is24Hour: <device setting> })`. That gives the Material calendar dialog and the Material **clock-face** time dialog. On web, fall back to `<input type="date|time">`. Display dates as "Today", "Yesterday", or "Wed, 11 Nov". Display times in the device's 12/24-hour format ("9:40 PM").

**Dev gallery:** add the route `src/app/dev/gallery.tsx`, available **only in `__DEV__`** (redirect away otherwise). It renders every component in both themes with a theme toggle. Use it for visual checks.

---

## 6. Screen layouts

### 6.1 Home
```
Good afternoon                                   (H)   ← avatar → Settings
Hamim · Fri, 13 Nov
┌ surface ───────────────────────────────────────────┐
│ Left to spend                         [41% used]   │  label + status pill
│ ৳ 23,550                                           │  HERO 44
│ of ৳ 40,000 · 27 days left                         │  textSecondary
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░                          │  ProgressBar 8dp
│ ───────────────────────────────────────────────    │  hairline
│ Safe today        Spent           Income           │  3 columns, label 13
│ ৳ 1,308           ৳ 16,450        ৳ 6,000          │  bodyStrong 17, tabular
└────────────────────────────────────────────────────┘
[ New cycle started 10 Nov · Last cycle ৳4,600 › ]     Banner (first 7 days of a cycle only)
[ ✦ Say or type it ]   [ ✓ Check-in ]                  two secondary small buttons, 50/50
Spending                              [Day|Week|Month]
┌ chart card: bars, accent; today's bar full accent, others 35% ┐
│ ≤5 x-axis labels, no collisions; tap bar → tooltip  │
Top categories                                  See all
 (tile) Food & Dining   ▓▓▓▓▓▓░░  ৳ 6,500   40%       ← rows, bar in category colour
 …top 4 + "Other"
Recent                                          See all
 (tile) Lunch             Food · 1:20 PM      −৳ 350
 (tile) Rent Narsingdi    Rent income · Thu   +৳ 2,500 (accent)
```
- **No budget:** the hero becomes "Spent this cycle ৳ X" with a slim inline row: "Set a monthly budget to see what's safe to spend · **Set budget**". No giant card.
- Average daily spending moves to Insights. Its ⓘ definitions move into a single "How these numbers work" sheet linked from the hero card's `…` menu.

### 6.2 Add / Edit transaction (full-height sheet)
```
 ✕                 [ Expense | Income ]              ⋯ (edit: delete)
                       ৳ 1,250                      ← display 30→44, centred
                 + Add a note                       ← tertiary; expands to a single-line field
 [📅 Today ▾]  [🕘 1:20 PM ▾]                       ← DateField / TimeField chips → native dialogs
 Category                                            
 ┌────┐┌────┐┌────┐┌────┐                            4-col grid of IconTiles + name (12)
 │Food││Groc││Tran││Shop│   row 1 = 4 most used
 └────┘└────┘└────┘└────┘
 ┌────┐┌────┐┌────┐┌────┐
 │Util││Rent││Hlth││All…│   "All…" → sheet with every category + "New category"
 └────┘└────┘└────┘└────┘
 Description  [ What was this for?            ]     ← suggestions = same type + selected category only
 ┌ keypad pinned to bottom (surfaceRaised keys, no borders) ┐
 │  1   2   3                                       │
 │  4   5   6                                       │
 │  7   8   9                                       │
 │  .   0   ⌫                                       │
 └──────────────────────────────────────────────────┘
 [            Save expense             ]  ← primary, pinned, disabled until amount + category
```
- When the description field is focused, the keypad slides away and the system keyboard shows. When the field blurs, the keypad returns.
- Quick Entry is reached via long-press on the tab +, or the Home "Say or type it" button. It is **not** a banner inside Add.
- Edit uses the same layout; delete is in the `⋯` menu with a confirm sheet.

### 6.3 Activity
```
Activity
[🔍 Search                         ] [⚙︎ 2]   ← filter icon button with count badge
[This cycle ▾]   Spent ৳ 4,600 · Income ৳ 29,000  ← summary for current filter
TODAY ─────────────────────────────── −৳ 350        sticky section header (caption, tertiary) + net
 rows (64dp): tile · title · "Category · 9:40 PM" · amount
YESTERDAY ─────────────────────────── +৳ 2,500
```
Filters open as a bottom sheet: type segmented, category multi-select tiles, date presets + "Custom range" (two DateFields using native dialogs), amount min/max Fields, and [Reset] [Show N results].

### 6.4 Budget
```
Budget                                  10 Nov – 9 Dec
┌ surface ───────────────────────────────────────────┐
│        ◯ ProgressRing 160dp                        │
│        ৳ 23,550  left                              │  display in ring
│        41% of ৳ 40,000                             │
│   27 days left · ৳ 1,308 / day safe     [Edit]     │
└────────────────────────────────────────────────────┘
Category budgets                       ৳ 5,000 unallocated
 (tile) Food & Dining    ৳ 6,500 of ৳ 10,000   ▓▓▓▓▓▓░░  ৳ 3,500 left
 (tile) Transport        ৳ 4,800 of ৳ 5,000    ▓▓▓▓▓▓▓▓▓ (warning)  ৳ 200 left
 [ + Add category budget ]    ← one dashed-outline row, the ONLY add CTA
Past cycles  ›                ← collapsible list, read-only
```
Edit budget opens a sheet with the keypad. With no budget, the ring is replaced by a compact EmptyState plus a single "Set monthly budget" primary button.

### 6.5 Insights
```
Insights                           [ This cycle ▾ ]   ← one dropdown → sheet of 7 options (no cut-off chips)
┌ headline card ─────────────────────────────────────┐
│ You've spent ৳ 4,600 so far                        │
│ ৳ 1,200 less than the same 4 days last cycle  ↓    │  plain words, coloured arrow + text
│ ▓▓▓▓▓▓▓▓ this cycle                                │  two bars compared
│ ▓▓▓▓▓▓▓▓▓▓▓ last cycle                             │
└────────────────────────────────────────────────────┘
Averages (2×2 compact tiles): per day · per week · per transaction · monthly avg
Biggest: top category · largest expense · busiest day · most frequent   (list rows ›)
Changes vs last cycle: category rows with ↑/↓ %
History: bar chart by cycle (labelled per §4 cycle rule)
```
Copy rules: never say "prior comparison window". With no data, say "Not enough data yet. Insights appear after a week of logging." and show nothing else in that card.

### 6.6 Settings (grouped list, iOS/Material hybrid)
```
Settings
(H) Hamim                                   ›      ← profile row → name sheet
GENERAL
 Currency                       BDT ৳  🔒          ← lock + footnote when locked
 Budget cycle starts       10th of the month ›     → sheet: DayOfMonthGrid 1–28 + preview "Current cycle: 10 Nov – 9 Dec"
 Appearance                 System ›               → sheet with 3 preview swatches (System / Light / Dark)
REMINDERS
 Daily check-in                         [ ● ]      ← switch
 Time                              9:00 PM ›       → native clock dialog
 Days                 S M T W T F S                ← DayToggles + presets row [Every day] [Sun–Thu]
DATA
 Categories                              ›
 Delete all data                                   ← danger text, confirm sheet, type "DELETE"
ABOUT
 Version 1.1.0 · Offline · No tracking
DEVELOPER (__DEV__ only)
 Component gallery ›   Load sample data   Clear sample data
```
Settings is pushed as a normal stack screen from the Home avatar (back arrow), and has no tab bar.

### 6.7 Categories (Settings)
A grid of IconTiles (expense / income segmented). Tapping one opens an edit sheet: name field, 13 colour swatches, icon grid, archive. Protected categories (D-003) hide the archive option.

### 6.8 Onboarding, Check-in, Quick Entry, Transaction detail, Category detail
Restyle with the same components. Onboarding: one question per screen, hero title (title 28), progress dots, pinned primary button. Check-in: hero "Today", three stat columns, "Done for today" primary. Quick Entry: big multiline input, mic button (if available) as an accent circle, and drafts as editable cards with IconTile.

---

## 7. Phone verification (new: the phone is now reachable)

The PC now has the Android SDK, and `android/` was generated by `expo prebuild`. It's git-ignored and must never be hand-edited. The owner's Galaxy S25 Ultra is reachable over wireless ADB at the address in `START-HERE.md`. **It holds the owner's real data.**

See the hard rules in AGENTS.md §3 and §6.
