import type { Metadata } from "next";
import { CartExperience } from "@/components/public-v2/commerce/CartExperience";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";
import { evaluateMarketplaceCheckoutPublicGate } from "@/lib/marketplace-checkout/production-lock";

export const metadata: Metadata = {
  title: "Shopping Cart | KT Couriers Marketplace",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

export default function MarketplaceCartPage() {
  const gate = evaluateMarketplaceCheckoutPublicGate();
  if (!gate.enabled) {
    return <MarketplaceUnavailable routeContext="cart" />;
  }
  return <CartExperience />;
}
