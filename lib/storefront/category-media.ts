const CLOUDINARY_CATEGORY_BASE =
  "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000";

const CATEGORY_MEDIA_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
  "CMA-CAT-AUTOMOTIVE": "automotive.jpg",
  "CMA-CAT-BOOKS": "books.jpg",
  "CMA-CAT-CAKES": "cakes.jpg",
  "CMA-CAT-PETS": "pets.jpg",
  "CMA-CAT-FASHION": "fashion.jpg",
  "CMA-CAT-CLOTHING": "clothing.jpg",
  "CMA-CAT-ACCESSORIES": "accessories.jpg",
  "CMA-CAT-AUDIO": "audio.jpg",
  "CMA-CAT-POWER": "power.jpg",
  "CMA-CAT-COOKWARE": "cookware.jpg",
  "CMA-CAT-DECOR": "decor.jpg",
  "CMA-CAT-GROCERIES": "groceries.jpg",
  "CMA-CAT-PANTRY": "pantry.jpg",
  "CMA-CAT-SNACKS": "snacks.jpg",
  "CMA-CAT-HOUSEHOLD": "household.jpg",
  "CMA-CAT-BURGERS": "burgers.jpg",
  "CMA-CAT-PIZZA": "pizza.jpg",
  "CMA-CAT-GRILL": "grill.jpg",
  "CMA-CAT-TRADITIONAL": "traditional.jpg",
  "CMA-CAT-PHARMACY": "pharmacy.jpg",
  "CMA-CAT-OTC-RELIEF": "otc.jpg",
  "CMA-CAT-FIRST-AID": "first-aid.jpg",
  "CMA-CAT-VITAMINS": "vitamins.jpg",
  "CMA-CAT-FLOWERS": "flowers.jpg",
});

export function hasStorefrontCategoryMediaOverride(
  imageReference: string | undefined | null,
): boolean {
  return Boolean(imageReference && CATEGORY_MEDIA_OVERRIDES[imageReference]);
}

export function storefrontCategoryMediaSrc(
  imageReference: string | undefined | null,
  fallback?: string,
): string | undefined {
  if (imageReference) {
    const override = CATEGORY_MEDIA_OVERRIDES[imageReference];
    if (override) {
      return `${CLOUDINARY_CATEGORY_BASE}/kt-courier/category-overrides/${override}`;
    }
    return `/api/catalog/media/${encodeURIComponent(imageReference)}`;
  }
  return fallback;
}
