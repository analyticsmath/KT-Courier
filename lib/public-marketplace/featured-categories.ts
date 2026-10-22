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
  T extends Readonly<{ path: string; name?: string; productCount?: number }>,
>(categories: readonly T[]): T[] {
  const byPath = new Map(
    categories.map((category) => [normalizeCategoryPath(category.path), category]),
  );

  const authored = FEATURED_MARKETPLACE_CATEGORY_PATHS.flatMap((path) => {
    const category = byPath.get(path);
    return category ? [category] : [];
  });
  if (authored.length > 0) return authored;
  // A clean legacy import retains its real source slugs, including source IDs.
  // Discover those published roots instead of rendering an empty demo taxonomy.
  return categories.filter((category) => {
    const normalized = normalizeCategoryPath(category.path);
    return normalized.length > 0 && !normalized.includes("/") && (category.productCount === undefined || category.productCount > 0);
  }).sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || (a.name ?? a.path).localeCompare(b.name ?? b.path, "en-ZA"));
}
