# DECISIONS-LOG — choices the agent made without asking

The owner is asleep. When something is unclear, choose the simplest option consistent with `docs/SPEC.md` (DECISIONS block first), write it here, and keep going. The owner will review this file in the morning.

Format:
```
## D-001 — <short title>  (Phase N, YYYY-MM-DD HH:MM)
- Question: what was unclear
- Options considered: A / B
- Chose: A, because …
- Easy to reverse? yes/no — how
```

---

## D-000 — Planner's setup notes  (before Phase 0, 2026-11-13)
- The project was created with `create-expo-app@latest` → **Expo SDK 58**, React Native 0.88, React 19.3, TypeScript 6, Expo Router with routes in `src/app/`.
- The template's demo code (components, hooks, constants, explore tab, demo images, `scripts/reset-project.js`) was deleted because its typecheck failed and the reset script is interactive. `src/app/_layout.tsx` + `src/app/index.tsx` are minimal placeholders. `npm run typecheck` passes.
- `app.json` → `web.output` changed from `server` to `single` (plain SPA for the web preview).
- Added `"typecheck": "tsc --noEmit"` to package.json scripts.
- The PC has no Android SDK/emulator → verification is typecheck + jest + Expo web preview. Native-only features are guarded and listed under "Needs phone test".

<!-- Agent: append D-001 onward below this line -->

## D-001 — Light & dark color contrast adjustments  (Phase 1, 2026-11-13 01:04)
- Question: Several starting tokens in `ARCHITECTURE.md` §6 failed WCAG AA 4.5:1 contrast against `surface`/`bg`/`surfaceAlt` (`light.textMuted` #6B7570 was 4.44 on bg / 4.25 on surfaceAlt; `light.income` #2E8B57 was 4.25 on surface; `light.expense` #D2604F was 3.80 on surface; `light.warning` #C98A1B was 2.94 on surface; `dark.danger` #F07167 was 4.26 on primarySoft; white text on dark `primary` #5CC49A was 2.14).
- Options considered: Keep exact hexes and violate ≥4.5:1 accessibility / Darken light foregrounds slightly while keeping exact hue & set `onPrimary`/`onDanger` to `#0F1412` in dark mode.
- Chose: Adjust failing foregrounds minimally so every text/semantic color meets ≥4.66:1 across `bg`, `surface`, and `surfaceAlt`:
  - `light.textMuted`: `#6B7570` → `#5E6863` (5.78 on surface, 5.37 on bg, 5.14 on surfaceAlt)
  - `light.income`: `#2E8B57` → `#1F7A4A` (5.33 on surface, 4.96 on bg, 4.75 on surfaceAlt)
  - `light.expense`: `#D2604F` → `#B94536` (5.29 on surface, 4.93 on bg, 4.71 on surfaceAlt)
  - `light.warning`: `#C98A1B` → `#966109` (5.24 on surface, 4.87 on bg, 4.66 on surfaceAlt)
  - `dark.danger`: `#F07167` → `#F28076` (6.62 on surface, 7.20 on bg, 5.91 on surfaceAlt)
  - Added `onPrimary` (`#FFFFFF` light / `#0F1412` dark) and `onDanger` (`#FFFFFF` light / `#0F1412` dark).
- Easy to reverse? yes — single object edit in `src/theme/tokens.ts`, guarded by `src/theme/tokens.test.ts`.

## D-002 — Always-visible Add button placement  (Phase 1, 2026-11-13 01:07)
- Question: Should the Add transaction button sit as a 6th tab slot in the bottom bar or as a floating action button above the bottom-right of the 5-tab bar?
- Options considered: 6-item bottom tab bar with center Add button / 5 equal tabs + floating Add button above bottom-right.
- Chose: 5 equal tabs + floating Add button above bottom-right (`min 56dp` touch target), because on 360dp narrow Android viewports and larger accessibility font scales, 5 equal tabs (72dp each) keep tab labels readable without wrapping or truncation while keeping Add 1 tap away from every primary tab.
- Easy to reverse? Yes — contained inside `src/app/(tabs)/_layout.tsx`.

## D-003 — Protect system fallback categories (`other`, `other_income`) from archiving  (Phase 2, 2026-11-13 01:27)
- Question: Should users be allowed to archive every category including the built-in `Other` (`other`) and `Other Income` (`other_income`) fallback categories?
- Options considered: Allow archiving any category (risking zero active categories for new entries or unassigned quick-entry fallbacks) / Keep `other` and `other_income` protected from archiving while letting all other built-in and custom categories be edited or archived.
- Chose: Protect `other` and `other_income` from archiving in `src/app/settings/categories.tsx`, while still letting them be renamed/re-iconed or toggled as quick chips.
- Easy to reverse? Yes — single `PROTECTED_CATEGORY_IDS` set in `src/app/settings/categories.tsx`.
