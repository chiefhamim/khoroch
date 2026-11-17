# Khoroch UI Foundation

Authoritative rulebook. Values come from `src/theme/tokens.ts`. Where `docs/ui-overhaul/DESIGN.md` disagrees with tokens.ts (Inter vs Manrope, margin 20 vs 16), tokens.ts wins. Never write a raw number, hex or duration in a screen; if no token exists, see section 10.

## 1. Principles
1. One primary action per screen: one `Button variant="primary"`, everything else secondary or ghost.
2. Hierarchy comes from size, weight and space before colour.
3. The number is the hero: money gets the largest type on the screen.
4. Restraint: one accent colour, at most one decorated surface per screen (the HeroCard), no gradient or glow as decoration, no emoji as icons, no centred paragraph text, no card inside a card.
5. Calm motion: short, transform and opacity only, never decorative.
6. Honest empty and small-data states: say what is missing and how to fix it; never draw a chart from fewer than 2 points.

## 2. Spacing and layout
Scale `spacing`: xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, section 28, xxxl 32.
- Screen side gutter: use `geometry.screenMargin` (16). Screen already applies it; never add horizontal padding on top.
- Vertical stack on a screen: use `spacing.lg` (Screen's built-in gap) between blocks.
- Between named sections (SectionHeader plus content): use `geometry.sectionGap` (20).
- Gap inside a card: use `spacing.md` between rows, `spacing.sm` between label and value.
- Card padding: use `geometry.cardPadding` (16); HeroCard uses `spacing.xl` (20).
- Gap between sibling cards: use `geometry.cardGap` (12).
- List rows: height `geometry.listRowHeight` (56), compact `touch.min` (48), horizontal padding `spacing.lg`, inner gap `spacing.md`, vertical padding `spacing.sm`.
- Bottom of tab screens: use `useTabScrollPadding()` (tab bar plus 16). Non-tab scroll screens: `spacing.xxl`.
- Safe area: Screen's `edges` default `['top','left','right']`; sheets add `useSafeAreaInsets().bottom`. Never hard-code status bar heights.
- Keyboard: forms use `Screen scroll keyboardAvoiding` (KeyboardAwareScrollView, bottomOffset 24); sheets use the Sheet's own KeyboardAvoidingView.

## 3. Typography
Latin font Manrope; Bangla Hind Siliguri by default (user may switch via `BANGLA_FONT_FAMILIES`). The taka sign always uses `TAKA_FONT_FAMILY`. Always render text through `AppText` (it swaps fonts, zeroes letterSpacing for Bangla and clips on `numberOfLines`).

| Role | Token | Size / line |
|---|---|---|
| Hero amount (one per screen) | `hero` | 36 / 40 |
| Secondary display amount, ring centre | `display` | 34 / 40 |
| Screen title | `title` | 22 / 28 |
| Section title, card title, button label | `headline` | 17 / 22 |
| Body, row subject | `body` 15/22, `bodyStrong` 15/21 | |
| Section label, field label, meta | `label` | 13 / 18 |
| Caption, axis, hint | `caption` | 13 / 18 |
| Uppercase eyebrow | `overline` | 11.5 / 15 |
| Tab label only | `tab` | 11 / 14 |

Rules:
- Maximum 3 type sizes per screen (for example hero, headline, label).
- All money goes through `Money` (tabular numerals, raised taka sign, true minus U+2212). Any other number that lines up in columns gets `tabularNums` on `AppText`.
- Bangla digits: when locale is `bn`, `AppText` and `Money` convert via `toBnDigits`; never format digits by hand.
- Never set `fontSize` or `lineHeight` in a StyleSheet; pick a variant.

## 4. Colour
Read only from `theme.colors`; never hex.
- Surface levels: `bg` (page), `surface` (cards), `surfaceRaised` (sheet on sheet, keys), `surfaceSunken` (inputs, tracks, chips), `separator` (hairlines), `cardBorder`.
- Text levels: `text` primary, `textSecondary` labels and meta, `textTertiary` placeholder and disabled only, never essential info.
- Accent: `accent` with `onAccent`, `accentSoft` for selected chips and soft fills. Only one accent is active at a time (`ACCENT_DEFINITIONS`).
- Money: income `colors.income`, expense `colors.expense` (default ink, neutral), neutral `textSecondary`. Red is for over budget and destructive only.
- State: `warning`/`warningBg`, `danger`/`dangerSoft`/`onDanger`. Category identity only via `CATEGORY_COLORS` through `IconTile`.
- Modes: `light`, `dark`, `black`. Every colour reads from the palette so parity is automatic; check both.
- Contrast: text 4.5:1 on its surface (enforced in `src/theme/tokens.test.ts`; extend it when adding a pair).

## 5. Containers and cards
- Plain section (no container): a SectionHeader plus rows separated by hairlines, directly on `bg`. Default for lists.
- Surface card (`variant="card"`): grouped related content. Radius `radius.card` (20), padding `geometry.cardPadding`, 1px `cardBorder`, `elevation.e1`.
- Soft/sunken Surface: tinted info or input groups, no elevation.
- Glass card: only when a screen sets `GlassContext` backdrop (onboarding, tabs backdrop). Never inside lists.
- HeroCard: one per screen, `radius.heroCard`, `elevation.e2`.
- Sheet: choices, forms under 2 screens, confirmations. Top radius `radius.sheetTop` (28), handle `sheetHandleWidth` by `sheetHandleHeight`.
- Hairline vs shadow: hairline (`StyleSheet.hairlineWidth`, `colors.separator`) between rows; shadow only on cards and the sheet. Never both on one edge.
- List rows never get blur, glass, shadow or per-row cards. Group rows in one Surface or one plain section.

## 6. KPI anatomy
Tile structure, top to bottom, left aligned:
1. Label: `label`, `textSecondary`, one line, clip.
2. Value: `Money` at `headline` in a tile; `hero` only for the screen's single hero KPI.
3. Context line: `caption`, `textSecondary` (delta, "of budget", period). Delta carries sign and a word, not colour alone.
4. Optional sparkline: 24 dp high would need a token (section 10), no axis, no labels.

Layout: gap `spacing.sm` inside; padding `geometry.cardPadding`; 2 tiles per row at 360 dp with `geometry.cardGap`; 3 only as columns inside the HeroCard strip, never as separate cards. Values must not wrap: use `allowCompact` Money.
Zero data: show `0` with the context line "No entries yet" (via `t()`), no delta, no chart. One data point: show the value, no delta, no chart, context "First entry". Never show a dash in large type.

## 7. Components
- Button: `primary` for the single main action, `secondary` for alternatives, `ghost` for tertiary text actions, `danger`/`dangerSoft` for destructive. Size `md` (50) default, `sm` (40) inline. Mistake: two primaries on one screen.
- Chip: a filter or selection tag, `selected` uses accentSoft. Mistake: using Chip as a button.
- SegmentedControl: 2 to 4 mutually exclusive views of the same data. Mistake: building a bespoke tab pill (index.tsx heroTabs).
- ListRow: leading IconTile, `bodyStrong` title, `caption` subtitle, trailing Money. Mistake: wrapping each row in its own bordered View.
- SectionHeader: `headline` title plus optional accent text action. Mistake: a bare AppText as a section title.
- Sheet: all modal choices. Mistake: a hard-coded English accessibility label.
- Toast: confirmations and undo, 2.4 s, never errors that need action (use Banner or ErrorState).
- EmptyState: icon tile, one line, one button, about 160 dp. Mistake: large illustrations.
- Field: label above, `radius.input`, error text below in `danger`. Mistake: placeholder as the label.
- Every tappable: `accessibilityRole`, `accessibilityLabel` from `t()`, at least `touch.min` (48) high or wide.

## 8. Motion
Tokens `motion`: fast 150, normal 200, slow 250, staggerMs 40, countMs 400. No easing tokens exist (section 10).
- Press feedback: `PressableScale` (spring on UI thread); scale 0.97 buttons and cards, 0.985 rows and hero, 0.9 small icon buttons.
- Sheet open/close: `motion.normal` timing for backdrop, spring for the panel (damping 32, stiffness 320).
- Screen transition and card enter: `staggerEnter`, `motion.slow` per card, 40 ms stagger, first 3 cards only.
- Number change: `motion.countMs`, hero and display amounts only, never list amounts.
- List insert and remove: `listLayoutTransition`, only on short lists.
- Only `transform` and `opacity` animate. Width, height, margin and colour changes snap, except the HeroProgressBar width which is the one exception.
- Reanimated worklets or native driver only; never `setState` in a frame loop.
- Nothing over 300 ms including delay. No looping decorative animation. No animation while a list scrolls.
- Reduced motion: read `reducedMotion` from `useTheme()`; helpers return `undefined` and values set instantly.

## 9. Performance rules
- Long lists: `FlatList` or `SectionList`, `keyExtractor` by id, `initialNumToRender` 12 to 16, `windowSize` 7 to 9, `maxToRenderPerBatch` 12. Prefer FlashList for over 500 rows.
- Rows are separate `React.memo` components taking primitive props; no inline closures that capture changing state.
- Fixed row height (`listRowHeight`) so `getItemLayout` is possible; variable height only where text wraps.
- No inline style objects or `StyleSheet.create` calls in a row render; hoist or use tokens.
- Blur: none in lists, none stacked; at most one translucent surface per screen. Shadows: `e1` cards only, never per row.

## 10. Token gaps
- Easing tokens (no `motion.easing`); sheet and toast hard-code `Easing.out`.
- Duration tokens for toast (2400), sheet (220, 200, 160), enter (230 in `motion.ts`, duplicating `ENTER_DURATION_MS`).
- `motion.countMs` is 400 and breaks the 300 ms rule; needs to become 300.
- `geometry.sectionGap` 20 and `spacing.section` 28 both exist with no rule between them.
- Divider inset with leading tile (68 hard-coded) and without.
- Control heights: chip, tab pill, search box (44), KPI sparkline height.

## 11. Audit
Verified by reading each line. Most visible first.

| file:line | Rule broken | Fix | Size |
|---|---|---|---|
| `src/app/(tabs)/index.tsx:291-298, 407-412, 585-589` | Hard-coded rgba and radius 16, padding 12 and 10, compares colour to literal `'#14161D'` | Add a strip fill token, use `radius.lg`, `spacing.md`, `spacing.sm` | S |
| `src/ui/HeroCard.tsx:77-90` (dead styles 174-208, duplicate ternary 53) | Decorative radial-gradient glow; unused orb styles | Remove the Svg overlay and dead styles | S |
| `src/ui/Money.tsx:143-168` | Count-up runs on the JS thread via requestAnimationFrame plus setState; 400 ms | Drive with a Reanimated shared value or drop to 300 ms and hero only | M |
| `src/app/(tabs)/index.tsx:1554-1582` | Bespoke tab pill: width 266, height 34 and 28, literal `Manrope_700Bold`, fontSize 11.5 | Replace with `SegmentedControl` (48 dp touch, overline variant) | M |
| `src/app/(tabs)/ledger.tsx:934-948` | Row render builds a fresh style object per row, not memoised, fake card borders | Hoist styles, extract memoised row component | M |
| `src/app/(tabs)/ledger.tsx:1470, 1257, 1524`; `src/app/(tabs)/index.tsx:1616`; `src/app/(tabs)/plan.tsx:1051`; `src/screens/InsightsScreen.tsx:1210, 1243` | Touch targets 34 to 40 dp, under `touch.min` | Use `theme.touch.min` as minHeight or add hitSlop | S |
| `src/app/(tabs)/index.tsx:1133` | Raw `<Text numberOfLines={1}>` without `ellipsizeMode="clip"` (default adds an ellipsis) | Use `AppText` or add `ellipsizeMode="clip"` | S |
| `src/app/(tabs)/plan.tsx:1034-1041`; `src/screens/InsightsScreen.tsx:399` | Off-ramp sizes 30, 24, 25 | Use `display` or `title` variants | S |
| `src/app/(tabs)/ledger.tsx:1134-1149` | Row minHeight 54, padding 14, tile 34 radius 11 versus 56, 38, 12 tokens | Use `listRowHeight`, `geometry.iconTile`, `radius.iconTile` | S |
| `src/app/(tabs)/plan.tsx:437` | Row minHeight 72 versus `listRowHeight` 56 | Use ListRow, or a named token | S |
| `src/ui/ListRow.tsx:43`; `plan.tsx:485, 602`; `wallets/index.tsx:343, 604`; `index.tsx:1334` | Divider inset 68 and 64 magic numbers | Add `geometry.dividerInset` token | S |
| `src/ui/Sheet.tsx:178, 252`; `src/ui/Field.tsx:131` | English accessibility labels not through `t()` | Use `t('common.close')`, `t('common.clear')` | S |
| `src/app/onboarding/_layout.tsx:9-14, 20`; `budget.tsx:211`; `done.tsx:304`; `index.tsx:140`; `preferences.tsx:293`; `reminder.tsx:232`; `wallets.tsx:337` | Six hard-coded step tints break one-accent rule | Use `colors.accent` throughout onboarding | M |
| `src/app/settings/index.tsx:1042, 1298, 1332-1345, 1377-1388, 1467, 1514`; `src/app/settings/categories.tsx:432` | Hard-coded hex for checkmarks and theme previews | Use `onAccent`, `onInk`; preview colours from `lightColors`/`darkColors` | S |
| `src/ui/CoinScene.tsx:23` (used at `onboarding/index.tsx:102`) | Infinite `withRepeat` decorative loop | Remove loop or play once, honour reduced motion | S |
| `src/ui/motion.ts:13-15` | Card enter delay up to 240 ms plus 230 ms duration, over the 300 ms ceiling; constants duplicate `tokens.motion` | Cap stagger at index 3, read from `motion` tokens | S |
| `src/ui/Sheet.tsx:73, 85, 90, 119`; `src/ui/Toast.tsx:168, 184-185` | Literal 220, 200, 160, 180, 150, 2400 ms | Use `motion.normal`, `motion.fast` and a toast token | S |
| `src/app/(tabs)/_layout.tsx:127-128` | Hard-coded rgba boxShadow | Add tab-bar shadow to `ElevationTokens` | S |
| `src/ui/Surface.tsx:117`; `src/ui/glass.tsx:20-21` | Hard-coded dark card border and glass hex | Add `cardBorderDark`/glass tokens to palette | S |
