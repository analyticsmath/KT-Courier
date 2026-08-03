import type { Metadata } from "next";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = {
  title: "Marketplace checkout unavailable",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

export default function MarketplaceCheckoutPage() {
  return <MarketplaceUnavailable routeContext="checkout" />;
}
