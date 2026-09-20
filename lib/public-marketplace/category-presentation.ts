import { listStorefrontCategories } from "@/lib/services/storefront-catalog.service";
import { marketplaceCategoryHref } from "@/lib/public-marketplace/routes";

export type CommerceCategoryNode = { name: string; path: string; href: string | null };

/** Resolve canonical category paths to published, human-named hierarchy nodes. */
export async function getCommerceCategoryHierarchy(categoryPath: string): Promise<CommerceCategoryNode[]> {
  const categories = await listStorefrontCategories();
  const normalized = categoryPath.startsWith("/") ? categoryPath : `/${categoryPath}`;
  const segments = normalized.split("/").filter(Boolean);
  const byPath = new Map(categories.map((category) => [
    category.path.startsWith("/") ? category.path : `/${category.path}`,
    category,
  ]));

  return segments.flatMap((_, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    const category = byPath.get(path);
    return category ? [{ name: category.name, path: category.path, href: marketplaceCategoryHref(category.path) }] : [];
  });
}
