export const FEATURED_MARKETPLACE_CATEGORY_PATHS = [
  "groceries",
  "fashion",
  "food-dining",
  "home-living",
  "pharmacy",
] as const;

export type FeaturedMarketplaceCategoryPath =
  (typeof FEATURED_MARKETPLACE_CATEGORY_PATHS)[number];

function normalizeCategoryPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

/**
 * Keep public commerce entry surfaces aligned to the five authored marketplace
 * worlds used by the cinematic homepage. The full taxonomy remains available
 * underneath each world; this selector only controls top-level presentation.
 */
export function selectFeaturedMarketplaceCategories<
  T extends Readonly<{ path: string }>,
>(categories: readonly T[]): T[] {
  const byPath = new Map(
    categories.map((category) => [normalizeCategoryPath(category.path), category]),
  );

  return FEATURED_MARKETPLACE_CATEGORY_PATHS.flatMap((path) => {
    const category = byPath.get(path);
    return category ? [category] : [];
  });
}
