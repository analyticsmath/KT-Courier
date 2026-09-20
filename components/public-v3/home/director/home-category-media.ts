import { ktMediaV3 } from "../../media/kt-media-v3";

export interface HomepageCategoryVisual {
  id: string;
  title: string;
  categoryWord?: string;
  tagline: string;
  image: string;
  altText?: string;
  href?: string;
  hasEditorialMedia?: boolean;
}

const SAFE_MEDIA_BY_CATEGORY = [
  { test: /grocery|produce|fruit|vegetable|pantry/i, media: ktMediaV3.editorial.grocery.fruitCrates },
  { test: /food|meal|bakery|restaurant|dining/i, media: ktMediaV3.editorial.food.grainBowl },
  { test: /fashion|cloth|apparel|shoe|bag/i, media: ktMediaV3.editorial.fashion.leatherBags },
  { test: /home|craft|ceramic|furniture|decor/i, media: ktMediaV3.editorial.ceramics.capeTownPlates },
  { test: /care|wellness|beauty|skincare|health/i, media: ktMediaV3.editorial.wellness.apothecaryBottles },
] as const;

/** Keep explicit category media, use a safe topical match, or fall back to a neutral local-market image. */
export function resolveHomepageCategoryVisual<T extends HomepageCategoryVisual>(category: T): T {
  if (category.hasEditorialMedia) return category;

  const match = SAFE_MEDIA_BY_CATEGORY.find(({ test }) => test.test(category.title));
  const media = match?.media ?? ktMediaV3.editorial.market.rosebankCraft;
  const titleWord = category.title.trim().split(/\s+/)[0] || "LOCAL";

  return {
    ...category,
    categoryWord: category.categoryWord || titleWord.toUpperCase(),
    image: media.src,
    altText: media.alt,
  };
}

export function safeCategoryWord(category: Pick<HomepageCategoryVisual, "categoryWord" | "title">): string {
  return category.categoryWord?.trim() || category.title.trim().split(/\s+/)[0]?.toUpperCase() || "LOCAL";
}
