import type { Metadata } from "next";
import { PublicHomeExperience } from "@/components/public-v3/home";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { mapStorefrontHomePresentation } from "@/components/public-v3/home/data/home-storefront-presentation";

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
    return <HomepageV2 isStorefrontExposed={false} storefrontPresentation={null} />;
  }

  const home = await getStorefrontHome();
  return <HomepageV2 isStorefrontExposed={true} storefrontPresentation={mapStorefrontHomePresentation(home)} />;
}
