import {
  marketplaceCategoriesHref,
  marketplaceCategoryHref,
  marketplaceProductHref,
  marketplaceStoreHref,
} from "@/lib/public-marketplace/routes";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { hasStorefrontCategoryMediaOverride, storefrontCategoryMediaSrc } from "@/lib/storefront/category-media";
import { resolveHomepageCategoryVisual } from "../director/home-category-media";
import type { HomepageCategoryVisual } from "../director/home-category-media";

export type HomepageCategoryItem = {
  id: string;
  categoryWord: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  href: string;
};

export type HomepageStoreItem = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image: string;
  href: string;
  publishedOfferCount: number;
};

export type HomepageProductItem = {
  id: string;
  productReference: string;
  productSlug: string;
  title: string;
  brandName?: string;
  image: string;
  imageAlt: string;
  priceAmount: string;
  currency: "ZAR";
  priceFrom: boolean;
  variantCount: number;
  storeCount: number;
  href: string;
};

export type HomepageStorefrontPresentation = {
  categories: HomepageCategoryItem[];
  stores: HomepageStoreItem[];
  products: HomepageProductItem[];
  availabilityNotice?: string;
};

const AUTHORITATIVE_CATEGORY_ORDER = [
  { path: "groceries", word: "FRESH" },
  { path: "fashion", word: "FASHION" },
  { path: "food-dining", word: "FOOD" },
  { path: "home-living", word: "CRAFT" },
  { path: "pharmacy", word: "CARE" },
] as const;

function catalogMediaHref(reference: string): string {
  return `/api/catalog/media/${encodeURIComponent(reference)}`;
}

function categoryPresentation(category: {
  reference: string;
  path: string;
  name: string;
  description?: string;
  imageReference?: string;
}): HomepageCategoryItem | null {
  const href = marketplaceCategoryHref(category.path) ?? marketplaceCategoriesHref();
  const visual = resolveHomepageCategoryVisual({
    id: category.reference,
    categoryWord: AUTHORITATIVE_CATEGORY_ORDER.find((entry) => category.path.replace(/^\/+/, "").split("/")[0] === entry.path)?.word || "LOCAL",
    title: category.name,
    tagline: category.description || "Local catalog collection.",
    image: storefrontCategoryMediaSrc(category.imageReference, "") || "",
    altText: category.name,
    href,
    hasEditorialMedia: hasStorefrontCategoryMediaOverride(category.imageReference),
  } satisfies HomepageCategoryVisual);
  if (!visual.image) return null;
  return {
    id: visual.id,
    categoryWord: visual.categoryWord || "LOCAL",
    title: visual.title,
    description: visual.tagline,
    image: visual.image,
    alt: visual.altText || visual.title,
    href,
  };
}

function productPresentation(product: StorefrontProductCard): HomepageProductItem | null {
  const imageReference = product.primaryMedia?.publicReference;
  const href = marketplaceProductHref(product.productSlug, product.productReference);
  if (!imageReference || !href) return null;
  return {
    id: product.productReference,
    productReference: product.productReference,
    productSlug: product.productSlug,
    title: product.title,
    ...(product.brandName ? { brandName: product.brandName } : {}),
    image: catalogMediaHref(imageReference),
    imageAlt: product.primaryMedia?.alt || product.title,
    priceAmount: product.price.amount,
    currency: "ZAR",
    priceFrom: product.price.from,
    variantCount: product.variantCount,
    storeCount: product.storeCount,
    href,
  };
}

export function mapStorefrontHomePresentation(home: Awaited<ReturnType<typeof import("@/lib/services/storefront-catalog.service").getStorefrontHome>>): HomepageStorefrontPresentation {
  const categories = AUTHORITATIVE_CATEGORY_ORDER.flatMap(({ path }) => {
    const category = home.categories.find((candidate) => candidate.path.replace(/^\/+/, "") === path);
    const item = category ? categoryPresentation(category) : null;
    return item ? [item] : [];
  });

  const stores = home.stores
    .filter((store) => store.publishedOfferCount > 0 && Boolean(store.heroMediaReference) && Boolean(marketplaceStoreHref(store.slug)))
    .slice(0, 5)
    .flatMap((store) => {
      const href = marketplaceStoreHref(store.slug);
      if (!href || !store.heroMediaReference) return [];
      return [{
        id: store.reference,
        slug: store.slug,
        name: store.name,
        ...(store.description ? { description: store.description } : {}),
        image: catalogMediaHref(store.heroMediaReference),
        href,
        publishedOfferCount: store.publishedOfferCount,
      }];
    });

  const products = home.newArrivals
    .flatMap((product) => {
      const item = productPresentation(product);
      return item ? [item] : [];
    })
    .slice(0, 9);

  return { categories, stores, products, availabilityNotice: home.availabilityNotice };
}
