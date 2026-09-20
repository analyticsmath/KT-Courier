const CLOUDINARY_CATEGORY_BASE =
  "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000";

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
 * These references are the visual contract for commerce category surfaces. They
 * point either to the production category-overrides set or to the authored
 * South African editorial photography supplied in the KT Images library.
 *
 * Do not infer a category image by array position: category IDs are the source
 * of truth, so marketplace ordering can change without photography drifting.
 */
const CATEGORY_MEDIA_OVERRIDES: Readonly<Record<string, CuratedCategoryMedia>> =
  Object.freeze({
    // Groceries
    "CMA-CAT-GROCERIES": {
      publicId: "kt-courier/category-overrides/groceries",
      format: "jpg",
    },
    "CMA-CAT-FRESH-PRODUCE": {
      publicId: "cape-town-market-vegetables",
      format: "webp",
    },
    "CMA-CAT-DAIRY-EGGS": {
      publicId: "kt-courier/category-overrides/groceries",
      format: "jpg",
    },
    "CMA-CAT-PANTRY": {
      publicId: "kt-courier/category-overrides/pantry",
      format: "jpg",
    },
    "CMA-CAT-BEVERAGES": {
      src: "/media/public/derived/photo-commerce-coffee-roastery-counter-1440w.webp",
    },
    "CMA-CAT-SNACKS": {
      publicId: "kt-courier/category-overrides/snacks",
      format: "jpg",
    },
    "CMA-CAT-HOUSEHOLD": {
      publicId: "kt-courier/category-overrides/household",
      format: "jpg",
    },

    // Food & dining
    "CMA-CAT-FOOD-DINING": {
      publicId: "cape-town-market-food-bowl",
      format: "webp",
    },
    "CMA-CAT-BURGERS": {
      publicId: "kt-courier/category-overrides/burgers",
      format: "jpg",
    },
    "CMA-CAT-PIZZA": {
      publicId: "kt-courier/category-overrides/pizza",
      format: "jpg",
    },
    "CMA-CAT-GRILL": {
      publicId: "kt-courier/category-overrides/grill",
      format: "jpg",
    },
    "CMA-CAT-TRADITIONAL": {
      publicId: "kt-courier/category-overrides/traditional",
      format: "jpg",
    },

    // Pharmacy & wellness
    "CMA-CAT-PHARMACY": {
      publicId: "kt-courier/category-overrides/pharmacy",
      format: "jpg",
    },
    "CMA-CAT-OTC-RELIEF": {
      publicId: "kt-courier/category-overrides/otc",
      format: "jpg",
    },
    "CMA-CAT-FIRST-AID": {
      publicId: "kt-courier/category-overrides/first-aid",
      format: "jpg",
    },
    "CMA-CAT-VITAMINS": {
      publicId: "kt-courier/category-overrides/vitamins",
      format: "jpg",
    },
    "CMA-CAT-PERSONAL-CARE": {
      src: "/media/public/derived/photo-wellness-herbal-jars-dispensary-1440w.webp",
    },

    // Fashion
    "CMA-CAT-FASHION": {
      publicId: "kt-courier/category-overrides/fashion",
      format: "jpg",
    },
    "CMA-CAT-CLOTHING": {
      publicId: "kt-courier/category-overrides/clothing",
      format: "jpg",
    },
    "CMA-CAT-FOOTWEAR": {
      src: "/media/public/derived/photo-fashion-designer-footwear-leather-1440w.webp",
    },
    "CMA-CAT-ACCESSORIES": {
      publicId: "kt-courier/category-overrides/accessories",
      format: "jpg",
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
      publicId: "cape-town-market-ceramics",
      format: "webp",
    },
    "CMA-CAT-COOKWARE": {
      publicId: "kt-courier/category-overrides/cookware",
      format: "jpg",
    },
    "CMA-CAT-DECOR": {
      publicId: "kt-courier/category-overrides/decor",
      format: "jpg",
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
  if ("src" in asset) return asset.src;
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
