import type { Metadata } from "next";
import { PublicHomeExperience } from "@/components/public-v3/home";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";
import { marketplaceCategoryHref, marketplaceCategoriesHref } from "@/lib/public-marketplace/routes";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { resolveHomepageCategoryVisual } from "@/components/public-v3/home/director/home-category-media";

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
  const categories = home.categories.slice(0, 5).map((cat) => resolveHomepageCategoryVisual({
    id: cat.reference,
    categoryWord: cat.name.split(" ")[0]?.toUpperCase() || "LOCAL",
    title: cat.name,
    tagline: cat.description || "Local catalog collection.",
    image: cat.imageReference
      ? `/api/catalog/media/${encodeURIComponent(cat.imageReference)}`
      : "",
    altText: cat.name,
    href: marketplaceCategoryHref(cat.path) ?? marketplaceCategoriesHref(),
    hasEditorialMedia: Boolean(cat.imageReference),
  }));

  return <HomepageV2 isStorefrontExposed={true} storefrontCategories={categories} />;
}
