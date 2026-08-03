export const FOUNDATION_SUBSCRIPTION_PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    description: "Foundation store subscription plan for future billing phases.",
    price: "0.00",
    currency: "ZAR",
    billingInterval: "MONTH",
    features: ["basic_store_profile"],
    sortOrder: 10,
  },
  {
    code: "GROWTH",
    name: "Growth",
    description: "Foundation growth plan placeholder for future store subscriptions.",
    price: "199.00",
    currency: "ZAR",
    billingInterval: "MONTH",
    features: ["basic_store_profile", "growth_visibility"],
    sortOrder: 20,
  },
  {
    code: "FEATURED",
    name: "Featured",
    description: "Foundation featured placement plan placeholder.",
    price: "499.00",
    currency: "ZAR",
    billingInterval: "MONTH",
    features: ["basic_store_profile", "featured_store_eligibility"],
    sortOrder: 30,
  },
  {
    code: "PREMIUM",
    name: "Premium",
    description: "Foundation premium subscription plan placeholder.",
    price: "999.00",
    currency: "ZAR",
    billingInterval: "MONTH",
    features: ["basic_store_profile", "featured_store_eligibility", "premium_support"],
    sortOrder: 40,
  },
] as const;

export const FOUNDATION_AD_PLACEMENTS = [
  {
    type: "HOMEPAGE_BANNER",
    name: "Homepage Banner",
    description: "Default homepage banner placement for future advertising campaigns.",
    basePrice: "750.00",
    currency: "ZAR",
  },
  {
    type: "FEATURED_STORE",
    name: "Featured Store",
    description: "Default featured store placement for future advertising campaigns.",
    basePrice: "500.00",
    currency: "ZAR",
  },
  {
    type: "FEATURED_PRODUCT",
    name: "Featured Product",
    description: "Default featured product placement for future marketplace campaigns.",
    basePrice: "350.00",
    currency: "ZAR",
  },
  {
    type: "SEARCH_PLACEMENT",
    name: "Search Placement",
    description: "Default search result placement for future advertising campaigns.",
    basePrice: "250.00",
    currency: "ZAR",
  },
  {
    type: "CATEGORY_PLACEMENT",
    name: "Category Placement",
    description: "Default category placement for future marketplace campaigns.",
    basePrice: "250.00",
    currency: "ZAR",
  },
] as const;

export const FOUNDATION_PLATFORM_WALLET = {
  ownerType: "PLATFORM",
  ownerId: "platform",
  currency: "ZAR",
} as const;

export const FOUNDATION_STORE_EARNING_ACCOUNT = {
  purpose: "STORE_EARNINGS_PAYABLE",
  category: "LIABILITY",
  currency: "ZAR",
  allowNegative: false,
  openingBalance: "0.00",
} as const;

export const FOUNDATION_STORE_EARNING_JOURNAL_TYPES = [
  "STORE_EARNING_ACCRUAL",
  "STORE_EARNING_RELEASE",
  "STORE_EARNING_REVERSAL",
] as const;

export const FOUNDATION_DRIVER_EARNING_ACCOUNT = {
  purpose: "DRIVER_EARNINGS_PAYABLE",
  category: "LIABILITY",
  currency: "ZAR",
  allowNegative: false,
  openingBalance: "0.00",
} as const;

export const FOUNDATION_DRIVER_EARNING_JOURNAL_TYPES = [
  "DRIVER_EARNING_ACCRUAL",
  "DRIVER_EARNING_RELEASE",
  "DRIVER_EARNING_REVERSAL",
] as const;

export const FOUNDATION_PLATFORM_LEDGER_ACCOUNTS = [
  {
    code: "PLATFORM-CASH-CLEARING-ZAR",
    purpose: "CASH_CLEARING",
    category: "ASSET",
    currency: "ZAR",
    allowNegative: false,
  },
  {
    code: "PLATFORM-ADJUSTMENT-ZAR",
    purpose: "ADJUSTMENT",
    category: "EQUITY",
    currency: "ZAR",
    allowNegative: false,
  },
  {
    code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
    purpose: "HELD",
    category: "LIABILITY",
    currency: "ZAR",
    allowNegative: false,
  },
  {
    code: "PLATFORM-COMMISSION-REVENUE-ZAR",
    purpose: "PLATFORM_REVENUE",
    category: "REVENUE",
    currency: "ZAR",
    allowNegative: false,
  },
  {
    code: "PLATFORM-PROMOTION-EXPENSE-ZAR",
    purpose: "SUSPENSE",
    category: "EXPENSE",
    currency: "ZAR",
    allowNegative: false,
  },
] as const;
