import type { Category, CategoryColorKey, TransactionType } from './types';

export interface DefaultCategoryDef {
  id: string;
  name: string;
  icon: string;
  v1Icon: string;
  colorKey: CategoryColorKey;
  kind: TransactionType;
  sortOrder: number;
}

export const DEFAULT_EXPENSE_CATEGORIES: readonly DefaultCategoryDef[] = [
  { id: 'food_dining', name: 'Food & Dining', icon: 'utensils', v1Icon: 'restaurant', colorKey: 'orange', kind: 'expense', sortOrder: 1 },
  { id: 'groceries', name: 'Groceries', icon: 'shopping-basket', v1Icon: 'cart', colorKey: 'green', kind: 'expense', sortOrder: 2 },
  { id: 'transportation', name: 'Transportation', icon: 'car', v1Icon: 'car', colorKey: 'blue', kind: 'expense', sortOrder: 3 },
  { id: 'shopping', name: 'Shopping', icon: 'shopping-bag', v1Icon: 'bag-handle', colorKey: 'pink', kind: 'expense', sortOrder: 4 },
  { id: 'housing_rent', name: 'Housing & Rent', icon: 'house', v1Icon: 'home', colorKey: 'violet', kind: 'expense', sortOrder: 5 },
  { id: 'utilities', name: 'Utilities', icon: 'zap', v1Icon: 'flash', colorKey: 'amber', kind: 'expense', sortOrder: 6 },
  { id: 'health', name: 'Health', icon: 'heart-pulse', v1Icon: 'medkit', colorKey: 'red', kind: 'expense', sortOrder: 7 },
  { id: 'entertainment', name: 'Entertainment', icon: 'clapperboard', v1Icon: 'film', colorKey: 'grape', kind: 'expense', sortOrder: 8 },
  { id: 'education', name: 'Education', icon: 'graduation-cap', v1Icon: 'school', colorKey: 'indigo', kind: 'expense', sortOrder: 9 },
  { id: 'travel', name: 'Travel', icon: 'plane', v1Icon: 'airplane', colorKey: 'cyan', kind: 'expense', sortOrder: 10 },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'repeat', v1Icon: 'repeat', colorKey: 'teal', kind: 'expense', sortOrder: 11 },
  { id: 'personal_care', name: 'Personal Care', icon: 'sparkles', v1Icon: 'sparkles', colorKey: 'pink', kind: 'expense', sortOrder: 12 },
  { id: 'family', name: 'Family', icon: 'users', v1Icon: 'people', colorKey: 'lime', kind: 'expense', sortOrder: 13 },
  { id: 'gifts', name: 'Gifts', icon: 'gift', v1Icon: 'gift', colorKey: 'grape', kind: 'expense', sortOrder: 14 },
  { id: 'fees', name: 'Fees & charges', icon: 'receipt', v1Icon: 'receipt', colorKey: 'gray', kind: 'expense', sortOrder: 15 },
  { id: 'other', name: 'Other', icon: 'shapes', v1Icon: 'shapes', colorKey: 'gray', kind: 'expense', sortOrder: 16 },
];

export const DEFAULT_INCOME_CATEGORIES: readonly DefaultCategoryDef[] = [
  { id: 'salary', name: 'Salary', icon: 'banknote', v1Icon: 'cash', colorKey: 'teal', kind: 'income', sortOrder: 101 },
  { id: 'rent_income', name: 'Rent income', icon: 'building-2', v1Icon: 'building-2', colorKey: 'violet', kind: 'income', sortOrder: 102 },
  { id: 'business', name: 'Business / Freelance', icon: 'briefcase', v1Icon: 'briefcase', colorKey: 'blue', kind: 'income', sortOrder: 103 },
  { id: 'gift_received', name: 'Gift Received', icon: 'hand-heart', v1Icon: 'gift', colorKey: 'gray', kind: 'income', sortOrder: 104 },
  { id: 'other_income', name: 'Other Income', icon: 'circle-plus', v1Icon: 'wallet', colorKey: 'gray', kind: 'income', sortOrder: 105 },
];

export const DEFAULT_CATEGORIES: readonly DefaultCategoryDef[] = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
];

export const DEFAULT_CATEGORY_BY_ID: Readonly<Record<string, DefaultCategoryDef>> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((def) => [def.id, def])
);

export function buildDefaultCategories(nowMs: number, selectedIds?: ReadonlySet<string>): Category[] {
  return DEFAULT_CATEGORIES.map((def) => ({
    id: def.id,
    name: def.name,
    icon: def.icon,
    colorKey: def.colorKey,
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
  { keyword: 'rent income', categoryId: 'rent_income', label: 'Rent income', kind: 'income' },
  { keyword: 'rental income', categoryId: 'rent_income', label: 'Rental income', kind: 'income' },
  { keyword: 'tenant', categoryId: 'rent_income', label: 'Tenant rent', kind: 'income' },
  { keyword: 'salary', categoryId: 'salary', label: 'Salary', kind: 'income' },
  { keyword: 'freelance', categoryId: 'business', label: 'Freelance', kind: 'income' },
  { keyword: 'business', categoryId: 'business', label: 'Business', kind: 'income' },

  // Bangla keywords
  { keyword: 'দুপুরের খাবার', categoryId: 'food_dining', label: 'দুপুরের খাবার', kind: 'expense' },
  { keyword: 'রাতের খাবার', categoryId: 'food_dining', label: 'রাতের খাবার', kind: 'expense' },
  { keyword: 'সকালের নাস্তা', categoryId: 'food_dining', label: 'সকালের নাস্তা', kind: 'expense' },
  { keyword: 'নাস্তা', categoryId: 'food_dining', label: 'নাস্তা', kind: 'expense' },
  { keyword: 'খাবার', categoryId: 'food_dining', label: 'খাবার', kind: 'expense' },
  { keyword: 'কফি', categoryId: 'food_dining', label: 'কফি', kind: 'expense' },
  { keyword: 'চা', categoryId: 'food_dining', label: 'চা', kind: 'expense' },
  { keyword: 'কাঁচাবাজার', categoryId: 'groceries', label: 'কাঁচাবাজার', kind: 'expense' },
  { keyword: 'বাজার', categoryId: 'groceries', label: 'বাজার', kind: 'expense' },
  { keyword: 'সবজি', categoryId: 'groceries', label: 'সবজি', kind: 'expense' },
  { keyword: 'ফল', categoryId: 'groceries', label: 'ফল', kind: 'expense' },
  { keyword: 'দুধ', categoryId: 'groceries', label: 'দুধ', kind: 'expense' },
  { keyword: 'উবার', categoryId: 'transportation', label: 'উবার', kind: 'expense' },
  { keyword: 'পাঠাও', categoryId: 'transportation', label: 'পাঠাও', kind: 'expense' },
  { keyword: 'রিকশা', categoryId: 'transportation', label: 'রিকশা', kind: 'expense' },
  { keyword: 'সিএনজি', categoryId: 'transportation', label: 'সিএনজি', kind: 'expense' },
  { keyword: 'বাস', categoryId: 'transportation', label: 'বাস', kind: 'expense' },
  { keyword: 'মেট্রো', categoryId: 'transportation', label: 'মেট্রো', kind: 'expense' },
  { keyword: 'ট্রেন', categoryId: 'transportation', label: 'ট্রেন', kind: 'expense' },
  { keyword: 'যাতায়াত', categoryId: 'transportation', label: 'যাতায়াত', kind: 'expense' },
  { keyword: 'বিদ্যুৎ', categoryId: 'utilities', label: 'বিদ্যুৎ বিল', kind: 'expense' },
  { keyword: 'গ্যাস', categoryId: 'utilities', label: 'গ্যাস বিল', kind: 'expense' },
  { keyword: 'পানি', categoryId: 'utilities', label: 'পানির বিল', kind: 'expense' },
  { keyword: 'ইন্টারনেট', categoryId: 'utilities', label: 'ইন্টারনেট বিল', kind: 'expense' },
  { keyword: 'ওয়াইফাই', categoryId: 'utilities', label: 'ওয়াইফাই বিল', kind: 'expense' },
  { keyword: 'রিচার্জ', categoryId: 'utilities', label: 'মোবাইল রিচার্জ', kind: 'expense' },
  { keyword: 'বাসা ভাড়া', categoryId: 'housing_rent', label: 'বাসা ভাড়া', kind: 'expense' },
  { keyword: 'ওষুধ', categoryId: 'health', label: 'ওষুধ', kind: 'expense' },
  { keyword: 'ডাক্তার', categoryId: 'health', label: 'ডাক্তার', kind: 'expense' },
  { keyword: 'হাসপাতাল', categoryId: 'health', label: 'হাসপাতাল', kind: 'expense' },
  { keyword: 'বেতন', categoryId: 'salary', label: 'বেতন', kind: 'income' },
  { keyword: 'বোনাস', categoryId: 'salary', label: 'বোনাস', kind: 'income' },
  { keyword: 'ফ্রিল্যান্স', categoryId: 'business', label: 'ফ্রিল্যান্স', kind: 'income' },
  { keyword: 'ব্যবসা', categoryId: 'business', label: 'ব্যবসা', kind: 'income' },
];

export interface NewCustomCategoryInput {
  id: string;
  name: string;
  kind: TransactionType;
  icon: string;
  colorKey: CategoryColorKey;
}

export function buildCustomCategory(
  input: NewCustomCategoryInput,
  existingCategories: readonly Category[],
  nowMs: number = Date.now()
): Category {
  const maxOrder = existingCategories
    .filter((c) => c.kind === input.kind)
    .reduce((max, c) => Math.max(max, c.sortOrder), 0);
  return {
    id: input.id,
    name: input.name,
    icon: input.icon,
    colorKey: input.colorKey,
    kind: input.kind,
    sortOrder: maxOrder + 1,
    isSelected: true,
    archivedAt: null,
    createdAt: nowMs,
  };
}
