export const en = {
  // Navigation & Tabs
  'tabs.overview': 'Overview',
  'tabs.activity': 'Activity',
  'tabs.budget': 'Budget',
  'tabs.insights': 'Insights',
  'tabs.settings': 'Settings',
  'tabs.add': 'Add',
  'tabs.addAccessibility': 'Add transaction',

  // Common
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.done': 'Done',
  'common.retry': 'Try again',
  'common.back': 'Back',
  'common.continue': 'Continue',
  'common.skip': 'Skip',
  'common.today': 'Today',
  'common.yesterday': 'Yesterday',
  'common.expense': 'Expense',
  'common.income': 'Income',
  'common.amount': 'Amount',
  'common.category': 'Category',
  'common.description': 'Description',
  'common.date': 'Date',
  'common.time': 'Time',
  'common.note': 'Note',
  'common.more': 'More',

  // Phase 1 empty states
  'empty.overviewTitle': 'Your spending at a glance',
  'empty.overviewBody': 'Add your first expense or income to see your monthly budget, daily average, and spending breakdown.',
  'empty.overviewCta': 'Add transaction',
  'empty.activityTitle': 'No transactions yet',
  'empty.activityBody': 'Every expense and income you log appears here, grouped by date.',
  'empty.activityCta': 'Log an expense',
  'empty.budgetTitle': 'No budget set yet',
  'empty.budgetBody': 'Set a monthly spending plan to track how much is safe to spend each day. Remember: a budget is a spending plan, not your wallet balance.',
  'empty.insightsTitle': 'Not enough data yet',
  'empty.insightsBody': 'Keep logging — insights appear after a week of data.',
  'empty.settingsTitle': 'Settings',
  'empty.settingsBody': 'Preferences, categories, reminders, and app data controls will live here.',

  // Add transaction (minimal Phase 1 / full Phase 2)
  'tx.newTitle': 'Add transaction',
  'tx.amountPlaceholder': '0',
  'tx.descriptionPlaceholder': 'What was this for?',
  'tx.saved': 'Transaction saved',
  'tx.errorInvalidAmount': 'Enter a valid positive amount (up to 2 decimals).',
  'tx.errorTooLarge': 'Amount cannot exceed 999,999,999.99.',
  'tx.errorTooManyDecimals': 'Enter at most 2 decimal places.',
  'tx.errorInvalidDate': 'Enter a valid date (YYYY-MM-DD).',
  'tx.errorSaveFailed': 'Could not save right now. Your input has been kept.',

  // Errors
  'error.dbInitTitle': 'Unable to open local storage',
  'error.dbInitBody': 'Something went wrong while preparing your local database.',
  'error.genericTitle': 'Something went wrong',
  'error.genericBody': 'Please try again.',
} as const;

export type TranslationKey = keyof typeof en;
