import { catalogSlug } from "@/lib/catalog/catalog-normalization";

export const CATALOG_CATEGORY_MAX_DEPTH = 8;

export type CategoryNode = { id: string; parentId: string | null; slug: string; status?: string };

export function categoryPath(parentPath: string | null, slugInput: string): string {
  const slug = catalogSlug(slugInput);
  if (!slug) throw new Error("Category slug is required.");
  return parentPath ? `${parentPath}/${slug}` : `/${slug}`;
}

export function assertCategoryParentAllowed(args: {
  categoryId?: string;
  parentId: string | null;
  categories: CategoryNode[];
}): void {
  if (!args.parentId) return;
  const byId = new Map(args.categories.map((category) => [category.id, category]));
  const parent = byId.get(args.parentId);
  if (!parent) throw new Error("Parent category does not exist.");
  if (parent.status === "ARCHIVED") throw new Error("Archived categories cannot be parents.");
  const visited = new Set<string>();
  let current: CategoryNode | undefined = parent;
  let depth = 1;
  while (current) {
    if (visited.has(current.id) || current.id === args.categoryId) throw new Error("Category cycle detected.");
    visited.add(current.id);
    if (depth > CATALOG_CATEGORY_MAX_DEPTH) throw new Error("Category depth limit exceeded.");
    current = current.parentId ? byId.get(current.parentId) : undefined;
    depth += 1;
  }
}

