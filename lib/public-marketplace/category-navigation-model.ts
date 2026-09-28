import { selectFeaturedMarketplaceCategories } from "./featured-categories";

export type CinematicCategoryChild = {
  reference: string;
  path: string;
  name: string;
  description?: string;
  imageReference?: string;
  productCount?: number;
};

export type CinematicCategoryNode = CinematicCategoryChild & {
  children: CinematicCategoryChild[];
};

type TaxonomyCategory = CinematicCategoryChild & {
  children?: readonly Pick<CinematicCategoryChild, "reference" | "path" | "name">[];
};

export function normalizeCategoryNavigationPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "").toLowerCase();
}

/** Enrich the five authored worlds from the taxonomy already loaded for the page. */
export function buildCinematicCategoryNavigation(
  taxonomy: readonly TaxonomyCategory[],
): CinematicCategoryNode[] {
  const byPath = new Map(taxonomy.map((category) => [normalizeCategoryNavigationPath(category.path), category]));
  return selectFeaturedMarketplaceCategories(taxonomy).map((parent) => ({
    reference: parent.reference,
    path: parent.path,
    name: parent.name,
    ...(parent.description ? { description: parent.description } : {}),
    ...(parent.imageReference ? { imageReference: parent.imageReference } : {}),
    ...(parent.productCount !== undefined ? { productCount: parent.productCount } : {}),
    children: (parent.children ?? []).map((child) => {
      const detail = byPath.get(normalizeCategoryNavigationPath(child.path));
      return {
        reference: child.reference,
        path: child.path,
        name: child.name,
        ...(detail?.description ? { description: detail.description } : {}),
        ...(detail?.imageReference ? { imageReference: detail.imageReference } : {}),
        ...(detail?.productCount !== undefined ? { productCount: detail.productCount } : {}),
      };
    }),
  }));
}
