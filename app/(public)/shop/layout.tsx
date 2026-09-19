import type { Metadata } from "next";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";

export function generateMetadata(): Metadata {
  if (!publicStorefrontPageExposureAllowed()) {
    return {
      title: "Marketplace catalogue pending activation | KT Couriers",
      description: "The KT Couriers marketplace catalogue is pending consolidated validation.",
      robots: { index: false, follow: true },
    };
  }
  return publicPageMetadata({
    title: "Marketplace",
    description: "Browse published products and local stores on KT Couriers.",
    route: "/shop",
  });
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  if (!publicStorefrontPageExposureAllowed()) return <MarketplaceUnavailable routeContext="storefront" />;
  return children;
}
