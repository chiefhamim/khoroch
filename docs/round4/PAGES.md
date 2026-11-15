# Khoroch (খরচ) — Round 4 Page-by-Page Smoke Test & Premium UI Checklist

Phone serial: `R5CY23M7E6L` (Samsung Galaxy S25 Ultra, `SM_S938B`)
Dev package: `com.hamim.budgetapp.dev` ("Khoroch Dev")
Live package (untouched until Section 6 step 4 owner approval): `com.hamim.budgetapp` ("Khoroch")

## Shared Foundations
- [x] 0a. Tokens: elevation, surfaces, type, colour, motion (`src/theme/tokens.ts`, `useTheme`)
- [x] 0b. Core components: Surface or Card, Button, Chip, SegmentedControl, ListRow, IconTile, Money, Sheet, Field or TextInput, Keypad, Toast, EmptyState, tab bar and add button (`src/ui/*`, `src/app/(tabs)/_layout.tsx`). Check them in `src/app/dev/gallery.tsx`.
- [x] 0c. Keyboard behaviour app-wide (`softwareKeyboardLayoutMode`, `KeyboardAwareScrollView`, sticky action bars)

## Screens
- [x] 1. Onboarding, all 7 steps (`src/app/onboarding/*`)
- [x] 2. Home (`src/app/(tabs)/index.tsx`): hero, backup banner, wallets, people summary, spending chart, top categories, recent
- [x] 3. Ledger, Day Book view (`src/ui/DayBookView.tsx`): day navigator, week strip, summary card, timeline rows, empty day
- [x] 4. Ledger, All entries view (`src/app/(tabs)/ledger.tsx`): search, wallet tabs, filter sheet, period sheet, section headers
- [x] 5. Add entry (`src/ui/FastTransactionEntry.tsx`, `src/app/transaction/new.tsx`): Spent/Received, amount, What for and suggestions, categories and the All categories sheet, wallet picker, When sheet (`src/ui/DateTimeSheet.tsx`), note, Save, Save & next
- [x] 6. Transaction detail and edit (`src/app/transaction/[id].tsx`, `src/ui/TransactionForm.tsx`): **Delete must stay visible with the keyboard open**
- [x] 7. Transfer detail and edit (`src/app/transfer/[id].tsx`)
- [x] 8. Quick entry and voice (`src/app/quick-entry.tsx`)
- [x] 9. Daily check-in (`src/app/check-in.tsx`)
- [x] 10. Plan (`src/app/(tabs)/plan.tsx`): budget ring, category budgets, past cycles
- [x] 11. Insights (`src/app/plan/insights.tsx`, `src/screens/InsightsScreen.tsx`)
- [x] 12. Category detail (`src/app/category/[id].tsx`)
- [x] 13. People list (`src/app/(tabs)/people.tsx`) and the Lend or borrow sheet (`src/ui/DueEntrySheet.tsx`)
- [x] 14. Person detail (`src/app/people/[id].tsx`) and the person editor sheet
- [x] 15. Wallets list (`src/app/wallets/index.tsx`) and the wallet editor sheet
- [x] 16. Wallet detail (`src/app/wallets/[id].tsx`): balance chart, adjust balance sheet
- [x] 17. Settings (`src/app/settings/index.tsx`): appearance, reminders, backup and restore, language
- [ ] 18. Categories settings (`src/app/settings/categories.tsx`)
- [ ] 19. Every remaining sheet and toast, re-checked once more with the keyboard open
- [ ] 20. Final full-app walk: open every page again in light, dark and Bangla, and confirm nothing regressed
