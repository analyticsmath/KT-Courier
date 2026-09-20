import { isPublicMarketplaceEnabled } from "@/lib/config/public-marketplace";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { resolveHomepageCategoryVisual } from "@/components/public-v3/home/director/home-category-media";
import {
  hasStorefrontCategoryMediaOverride,
  storefrontCategoryMediaSrc,
} from "@/lib/storefront/category-media";
import { PublicHomeExperience } from "@/components/public-v3/home";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const isStorefrontExposed = isPublicMarketplaceEnabled();
  const storefront = isStorefrontExposed
    ? await getStorefrontHome().catch(() => null)
    : null;

  const storefrontCategories = await Promise.all(
    (storefront?.categories || []).slice(0, 5).map(async (cat) => {
      const curatedImage = storefrontCategoryMediaSrc(cat.imageReference, "") || "";

      return resolveHomepageCategoryVisual({
        id: cat.id,
        title: cat.name,
        tagline:
          cat.description ||
          "Local category available through the KT marketplace.",
        image: curatedImage,
        altText: cat.name,
        href: `/shop/category/${encodeURIComponent(cat.slug)}`,
        /**
         * Only an explicitly curated category contract is allowed to bypass the
         * homepage semantic resolver. A raw catalogue reference can be valid for
         * commerce detail pages while still being visually wrong for the
         * cinematic homepage category sequence.
         */
        hasEditorialMedia: hasStorefrontCategoryMediaOverride(cat.imageReference),
      });
    }),
  );

  return (
    <PublicHomeExperience
      isStorefrontExposed={isStorefrontExposed}
      storefrontCategories={storefrontCategories}
    />
  );
}
