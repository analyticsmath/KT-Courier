import { ktMedia } from "@/components/public-v2/media";
import { storefrontCategoryMediaSrc } from "@/lib/storefront/category-media";
import type { CinematicCategoryChild } from "@/lib/public-marketplace/category-navigation-model";

export function majorCategoryMedia(category: CinematicCategoryChild): string {
  const source = storefrontCategoryMediaSrc(category.imageReference);
  if (source) return source;
  const path = category.path.toLowerCase();
  if (path.includes("food")) return ktMedia.categories.foodDining.hero.src;
  if (path.includes("groc")) return ktMedia.categories.groceries.hero.src;
  if (path.includes("fash") || path.includes("cloth")) return ktMedia.categories.fashion.hero.src;
  if (path.includes("pharm") || path.includes("well") || path.includes("care")) return ktMedia.categories.healthWellness.hero.src;
  if (path.includes("home")) return ktMedia.categories.homeLiving.hero.src;
  return ktMedia.categories.fashion.streetLook1.src;
}

export function childCategoryMedia(child: CinematicCategoryChild, parentMedia: string): string {
  return storefrontCategoryMediaSrc(child.imageReference) ?? parentMedia;
}
