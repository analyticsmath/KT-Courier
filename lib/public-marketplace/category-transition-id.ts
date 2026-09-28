import { normalizeCategoryNavigationPath } from "./category-navigation-model";

export function categoryTransitionId(path: string): string {
  return `category-${normalizeCategoryNavigationPath(path).replaceAll("/", "--").replace(/[^a-z0-9-]/g, "-")}`;
}
