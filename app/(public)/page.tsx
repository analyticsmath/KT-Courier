import type { Metadata } from "next";
import { PublicHomeExperience } from "@/components/public-v3/home";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";
import { marketplaceCategoryHref, marketplaceCategoriesHref } from "@/lib/public-marketplace/routes";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import {
  FEATURED_MARKETPLACE_CATEGORY_PATHS,
  type FeaturedMarketplaceCategoryPath,
} from "@/lib/public-marketplace/featured-categories";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { resolveHomepageCategoryVisual } from "@/components/public-v3/home/director/home-category-media";
import {
  hasStorefrontCategoryMediaOverride,
  storefrontCategoryMediaSrc,
} from "@/lib/storefront/category-media";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: "Marketplace and courier services",
    description: "Shop local marketplace products and explore courier delivery services through the KT Couriers network.",
    route: "/",
  }),
  title: { absolute: "Marketplace and courier services | KT Couriers" },
};

// Canonical Public Homepage Experience (HomepageV2 upgraded to v3)
const HomepageV2 = PublicHomeExperience;

export default async function HomePage() {
  if (!publicStorefrontPageExposureAllowed()) {
    return <HomepageV2 isStorefrontExposed={false} storefrontCategories={[]} />;
  }

  const home = await getStorefrontHome();
  const categoryOrder = FEATURED_MARKETPLACE_CATEGORY_PATHS;
  const categoryWordByPath: Record<FeaturedMarketplaceCategoryPath, string> = {
    groceries: "FRESH",
    fashion: "FASHION",
    "food-dining": "FOOD",
    "home-living": "CRAFT",
    pharmacy: "CARE",
  };

  const byPath = new Map(
    home.categories.map((category) => [
      category.path.replace(/^\/+/, ""),
      category,
    ]),
  );

  const orderedCategories = categoryOrder
    .map((path) => byPath.get(path))
    .filter((category): category is (typeof home.categories)[number] => Boolean(category));

  const categories = orderedCategories.map((cat) => {
    const normalizedPath = cat.path.replace(/^\/+/, "") as FeaturedMarketplaceCategoryPath;
    const curatedImage = storefrontCategoryMediaSrc(cat.imageReference, "") || "";

    return resolveHomepageCategoryVisual({
      id: cat.reference,
      categoryWord: categoryWordByPath[normalizedPath] || cat.name.split(" ")[0]?.toUpperCase() || "LOCAL",
      title: cat.name,
      tagline: cat.description || "Local catalog collection.",
      image: curatedImage,
      altText: cat.name,
      href: marketplaceCategoryHref(cat.path) ?? marketplaceCategoriesHref(),
      // Only curated category media may bypass the homepage semantic fallback.
      hasEditorialMedia: hasStorefrontCategoryMediaOverride(cat.imageReference),
    });
  });

  return <HomepageV2 isStorefrontExposed={true} storefrontCategories={categories} />;
}
