import { ktMedia } from "@/components/public-v2/media";
import { storefrontCategoryMediaSrc } from "@/lib/storefront/category-media";
import type { MarketplaceCategory } from "./MarketplaceLanding";

const fallbackByPath: Record<string, string> = {
  groceries: ktMedia.categories.groceries.hero.src,
  fashion: ktMedia.categories.fashion.hero.src,
  "food-dining": ktMedia.categories.foodDining.hero.src,
  "home-living": ktMedia.categories.homeLiving.hero.src,
  pharmacy: ktMedia.categories.healthWellness.hero.src,
};

export function shopCategoryMedia(category: MarketplaceCategory): string | undefined {
  return storefrontCategoryMediaSrc(category.imageReference, fallbackByPath[category.path.replace(/^\/+|\/+$/g, "")]);
}
