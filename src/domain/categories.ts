import type { Category, TransactionType } from './types';

export interface DefaultCategoryDef {
  id: string;
  name: string;
  icon: string;
  kind: TransactionType;
  sortOrder: number;
}

export const DEFAULT_EXPENSE_CATEGORIES: readonly DefaultCategoryDef[] = [
  { id: 'food_dining', name: 'Food & Dining', icon: 'restaurant', kind: 'expense', sortOrder: 1 },
  { id: 'groceries', name: 'Groceries', icon: 'cart', kind: 'expense', sortOrder: 2 },
  { id: 'transportation', name: 'Transportation', icon: 'car', kind: 'expense', sortOrder: 3 },
  { id: 'shopping', name: 'Shopping', icon: 'bag-handle', kind: 'expense', sortOrder: 4 },
  { id: 'housing_rent', name: 'Housing & Rent', icon: 'home', kind: 'expense', sortOrder: 5 },
  { id: 'utilities', name: 'Utilities', icon: 'flash', kind: 'expense', sortOrder: 6 },
  { id: 'health', name: 'Health', icon: 'medkit', kind: 'expense', sortOrder: 7 },
  { id: 'entertainment', name: 'Entertainment', icon: 'film', kind: 'expense', sortOrder: 8 },
  { id: 'education', name: 'Education', icon: 'school', kind: 'expense', sortOrder: 9 },
  { id: 'travel', name: 'Travel', icon: 'airplane', kind: 'expense', sortOrder: 10 },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'repeat', kind: 'expense', sortOrder: 11 },
  { id: 'personal_care', name: 'Personal Care', icon: 'sparkles', kind: 'expense', sortOrder: 12 },
  { id: 'family', name: 'Family', icon: 'people', kind: 'expense', sortOrder: 13 },
  { id: 'gifts', name: 'Gifts', icon: 'gift', kind: 'expense', sortOrder: 14 },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal', kind: 'expense', sortOrder: 15 },
];

export const DEFAULT_INCOME_CATEGORIES: readonly DefaultCategoryDef[] = [
  { id: 'salary', name: 'Salary', icon: 'cash', kind: 'income', sortOrder: 101 },
  { id: 'business', name: 'Business / Freelance', icon: 'briefcase', kind: 'income', sortOrder: 102 },
  { id: 'gift_received', name: 'Gift Received', icon: 'gift', kind: 'income', sortOrder: 103 },
  { id: 'other_income', name: 'Other Income', icon: 'wallet', kind: 'income', sortOrder: 104 },
];

export const DEFAULT_CATEGORIES: readonly DefaultCategoryDef[] = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
];

export function buildDefaultCategories(nowMs: number, selectedIds?: ReadonlySet<string>): Category[] {
  return DEFAULT_CATEGORIES.map((def) => ({
    id: def.id,
    name: def.name,
    icon: def.icon,
    kind: def.kind,
    sortOrder: def.sortOrder,
    isSelected: selectedIds ? selectedIds.has(def.id) : true,
    archivedAt: null,
    createdAt: nowMs,
  }));
}

export interface CategoryKeywordRule {
  keyword: string;
  categoryId: string;
  label: string;
  kind: TransactionType;
}

/**
 * Longest/most-specific keywords should match first when scanning text.
 */
export const CATEGORY_KEYWORDS: readonly CategoryKeywordRule[] = [
  // food_dining
  { keyword: 'food & dining', categoryId: 'food_dining', label: 'Food & Dining', kind: 'expense' },
  { keyword: 'restaurant', categoryId: 'food_dining', label: 'Restaurant', kind: 'expense' },
  { keyword: 'breakfast', categoryId: 'food_dining', label: 'Breakfast', kind: 'expense' },
  { keyword: 'lunch', categoryId: 'food_dining', label: 'Lunch', kind: 'expense' },
  { keyword: 'dinner', categoryId: 'food_dining', label: 'Dinner', kind: 'expense' },
  { keyword: 'coffee', categoryId: 'food_dining', label: 'Coffee', kind: 'expense' },
  { keyword: 'snacks', categoryId: 'food_dining', label: 'Snacks', kind: 'expense' },
  { keyword: 'snack', categoryId: 'food_dining', label: 'Snack', kind: 'expense' },
  { keyword: 'dining', categoryId: 'food_dining', label: 'Dining', kind: 'expense' },
  { keyword: 'burger', categoryId: 'food_dining', label: 'Burger', kind: 'expense' },
  { keyword: 'pizza', categoryId: 'food_dining', label: 'Pizza', kind: 'expense' },
  { keyword: 'food', categoryId: 'food_dining', label: 'Food', kind: 'expense' },
  { keyword: 'tea', categoryId: 'food_dining', label: 'Tea', kind: 'expense' },

  // groceries
  { keyword: 'groceries', categoryId: 'groceries', label: 'Groceries', kind: 'expense' },
  { keyword: 'grocery', categoryId: 'groceries', label: 'Grocery', kind: 'expense' },
  { keyword: 'bazaar', categoryId: 'groceries', label: 'Bazaar', kind: 'expense' },
  { keyword: 'bazar', categoryId: 'groceries', label: 'Bazar', kind: 'expense' },
  { keyword: 'vegetables', categoryId: 'groceries', label: 'Vegetables', kind: 'expense' },
  { keyword: 'fruits', categoryId: 'groceries', label: 'Fruits', kind: 'expense' },
  { keyword: 'milk', categoryId: 'groceries', label: 'Milk', kind: 'expense' },

  // transportation
  { keyword: 'transportation', categoryId: 'transportation', label: 'Transportation', kind: 'expense' },
  { keyword: 'rickshaw', categoryId: 'transportation', label: 'Rickshaw', kind: 'expense' },
  { keyword: 'transport', categoryId: 'transportation', label: 'Transport', kind: 'expense' },
  { keyword: 'pathao', categoryId: 'transportation', label: 'Pathao', kind: 'expense' },
  { keyword: 'petrol', categoryId: 'transportation', label: 'Petrol', kind: 'expense' },
  { keyword: 'uber', categoryId: 'transportation', label: 'Uber', kind: 'expense' },
  { keyword: 'taxi', categoryId: 'transportation', label: 'Taxi', kind: 'expense' },
  { keyword: 'fuel', categoryId: 'transportation', label: 'Fuel', kind: 'expense' },
  { keyword: 'cng', categoryId: 'transportation', label: 'CNG', kind: 'expense' },
  { keyword: 'bus', categoryId: 'transportation', label: 'Bus', kind: 'expense' },
  { keyword: 'metro', categoryId: 'transportation', label: 'Metro', kind: 'expense' },
  { keyword: 'train', categoryId: 'transportation', label: 'Train', kind: 'expense' },

  // utilities
  { keyword: 'electricity bill', categoryId: 'utilities', label: 'Electricity bill', kind: 'expense' },
  { keyword: 'electricity', categoryId: 'utilities', label: 'Electricity bill', kind: 'expense' },
  { keyword: 'water bill', categoryId: 'utilities', label: 'Water bill', kind: 'expense' },
  { keyword: 'gas bill', categoryId: 'utilities', label: 'Gas bill', kind: 'expense' },
  { keyword: 'internet', categoryId: 'utilities', label: 'Internet bill', kind: 'expense' },
  { keyword: 'recharge', categoryId: 'utilities', label: 'Mobile recharge', kind: 'expense' },
  { keyword: 'utilities', categoryId: 'utilities', label: 'Utilities', kind: 'expense' },
  { keyword: 'wifi', categoryId: 'utilities', label: 'Wi-Fi bill', kind: 'expense' },

  // housing_rent
  { keyword: 'house rent', categoryId: 'housing_rent', label: 'House rent', kind: 'expense' },
  { keyword: 'rent', categoryId: 'housing_rent', label: 'Rent', kind: 'expense' },

  // health
  { keyword: 'pharmacy', categoryId: 'health', label: 'Pharmacy', kind: 'expense' },
  { keyword: 'medicine', categoryId: 'health', label: 'Medicine', kind: 'expense' },
  { keyword: 'hospital', categoryId: 'health', label: 'Hospital', kind: 'expense' },
  { keyword: 'doctor', categoryId: 'health', label: 'Doctor', kind: 'expense' },
  { keyword: 'health', categoryId: 'health', label: 'Health', kind: 'expense' },

  // subscriptions
  { keyword: 'subscription', categoryId: 'subscriptions', label: 'Subscription', kind: 'expense' },
  { keyword: 'netflix', categoryId: 'subscriptions', label: 'Netflix', kind: 'expense' },
  { keyword: 'spotify', categoryId: 'subscriptions', label: 'Spotify', kind: 'expense' },

  // entertainment
  { keyword: 'entertainment', categoryId: 'entertainment', label: 'Entertainment', kind: 'expense' },
  { keyword: 'cinema', categoryId: 'entertainment', label: 'Cinema', kind: 'expense' },
  { keyword: 'movie', categoryId: 'entertainment', label: 'Movie', kind: 'expense' },

  // education
  { keyword: 'tuition', categoryId: 'education', label: 'Tuition', kind: 'expense' },
  { keyword: 'course', categoryId: 'education', label: 'Course', kind: 'expense' },
  { keyword: 'books', categoryId: 'education', label: 'Books', kind: 'expense' },
  { keyword: 'book', categoryId: 'education', label: 'Book', kind: 'expense' },

  // shopping
  { keyword: 'shopping', categoryId: 'shopping', label: 'Shopping', kind: 'expense' },
  { keyword: 'clothes', categoryId: 'shopping', label: 'Clothes', kind: 'expense' },
  { keyword: 'shoes', categoryId: 'shopping', label: 'Shoes', kind: 'expense' },

  // travel
  { keyword: 'flight', categoryId: 'travel', label: 'Flight', kind: 'expense' },
  { keyword: 'hotel', categoryId: 'travel', label: 'Hotel', kind: 'expense' },
  { keyword: 'travel', categoryId: 'travel', label: 'Travel', kind: 'expense' },

  // personal_care
  { keyword: 'haircut', categoryId: 'personal_care', label: 'Haircut', kind: 'expense' },
  { keyword: 'salon', categoryId: 'personal_care', label: 'Salon', kind: 'expense' },

  // family & gifts
  { keyword: 'family', categoryId: 'family', label: 'Family', kind: 'expense' },
  { keyword: 'gift', categoryId: 'gifts', label: 'Gift', kind: 'expense' },

  // income
  { keyword: 'salary', categoryId: 'salary', label: 'Salary', kind: 'income' },
  { keyword: 'freelance', categoryId: 'business', label: 'Freelance', kind: 'income' },
  { keyword: 'business', categoryId: 'business', label: 'Business', kind: 'income' },
];
