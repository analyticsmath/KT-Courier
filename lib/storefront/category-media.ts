const CLOUDINARY_CATEGORY_BASE =
  "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000";

const CURATED_2026_CATEGORY_FOLDER = "kt-courier/category-2026";

type CuratedCategoryMedia = Readonly<
  | {
      publicId: string;
      format: "jpg" | "webp";
      src?: never;
    }
  | {
      src: string;
      publicId?: never;
      format?: never;
    }
>;

/**
 * Curated category media is deliberately explicit.
 *
 * The five featured marketplace worlds and their direct children use dedicated
 * Unsplash+ masters stored in Cloudinary under the 2026 category namespace.
 * Cloudinary keeps each asset's source ID and photographer in asset context,
 * while this map keeps the storefront contract stable by catalog reference.
 *
 * Remaining taxonomy entries retain their established production overrides.
 * Do not infer a category image by array position: category IDs are the source
 * of truth, so marketplace ordering can change without photography drifting.
 */
const CATEGORY_MEDIA_OVERRIDES: Readonly<Record<string, CuratedCategoryMedia>> =
  Object.freeze({
    // Groceries
    "CMA-CAT-GROCERIES": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/groceries`,
      format: "webp",
    },
    "CMA-CAT-FRESH-PRODUCE": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/fresh-produce`,
      format: "webp",
    },
    "CMA-CAT-DAIRY-EGGS": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/dairy-eggs`,
      format: "webp",
    },
    "CMA-CAT-PANTRY": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/pantry`,
      format: "webp",
    },
    "CMA-CAT-BEVERAGES": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/beverages`,
      format: "webp",
    },
    "CMA-CAT-SNACKS": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/snacks`,
      format: "webp",
    },
    "CMA-CAT-HOUSEHOLD": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/household`,
      format: "webp",
    },

    // Food & dining
    "CMA-CAT-FOOD-DINING": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/food-dining`,
      format: "webp",
    },
    "CMA-CAT-BURGERS": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/burgers`,
      format: "webp",
    },
    "CMA-CAT-PIZZA": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/pizza`,
      format: "webp",
    },
    "CMA-CAT-GRILL": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/grill`,
      format: "webp",
    },
    "CMA-CAT-TRADITIONAL": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/traditional`,
      format: "webp",
    },

    // Pharmacy & wellness
    "CMA-CAT-PHARMACY": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/pharmacy`,
      format: "webp",
    },
    "CMA-CAT-OTC-RELIEF": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/otc-relief`,
      format: "webp",
    },
    "CMA-CAT-FIRST-AID": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/first-aid`,
      format: "webp",
    },
    "CMA-CAT-VITAMINS": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/vitamins`,
      format: "webp",
    },
    "CMA-CAT-PERSONAL-CARE": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/personal-care`,
      format: "webp",
    },

    // Fashion
    "CMA-CAT-FASHION": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/fashion`,
      format: "webp",
    },
    "CMA-CAT-CLOTHING": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/clothing`,
      format: "webp",
    },
    "CMA-CAT-FOOTWEAR": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/footwear`,
      format: "webp",
    },
    "CMA-CAT-ACCESSORIES": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/accessories`,
      format: "webp",
    },

    // Electronics. The authored audio category photograph is also the strongest
    // available umbrella visual for the top-level electronics collection.
    "CMA-CAT-ELECTRONICS": {
      publicId: "kt-courier/category-overrides/audio",
      format: "jpg",
    },
    "CMA-CAT-AUDIO": {
      publicId: "kt-courier/category-overrides/audio",
      format: "jpg",
    },
    "CMA-CAT-POWER": {
      publicId: "kt-courier/category-overrides/power",
      format: "jpg",
    },

    // Home & living
    "CMA-CAT-HOME-LIVING": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/home-living`,
      format: "webp",
    },
    "CMA-CAT-COOKWARE": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/cookware`,
      format: "webp",
    },
    "CMA-CAT-DECOR": {
      publicId: `${CURATED_2026_CATEGORY_FOLDER}/decor`,
      format: "webp",
    },

    // Remaining top-level marketplace categories
    "CMA-CAT-AUTOMOTIVE": {
      publicId: "kt-courier/category-overrides/automotive",
      format: "jpg",
    },
    "CMA-CAT-BOOKS": {
      publicId: "kt-courier/category-overrides/books",
      format: "jpg",
    },
    "CMA-CAT-CAKES": {
      publicId: "kt-courier/category-overrides/cakes",
      format: "jpg",
    },
    "CMA-CAT-FLOWERS": {
      publicId: "kt-courier/category-overrides/flowers",
      format: "jpg",
    },
    "CMA-CAT-PETS": {
      publicId: "kt-courier/category-overrides/pets",
      format: "jpg",
    },
  });

function curatedCategoryMediaSrc(asset: CuratedCategoryMedia): string {
  if (asset.src) return asset.src;
  return `${CLOUDINARY_CATEGORY_BASE}/${asset.publicId}.${asset.format}`;
}

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
      return curatedCategoryMediaSrc(override);
    }

    // Product/catalog media remains authoritative when a category has no
    // curated photography contract yet.
    return `/api/catalog/media/${encodeURIComponent(imageReference)}`;
  }

  return fallback;
}
