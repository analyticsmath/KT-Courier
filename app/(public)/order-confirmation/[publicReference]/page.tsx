import type { Metadata } from "next";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = {
  title: "Order confirmation access",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

/** The route remains a public boundary; it does not load or infer order data. */
export default function OrderConfirmationPage() {
  return <MarketplaceUnavailable routeContext="confirmation" />;
}
