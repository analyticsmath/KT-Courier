import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckoutExperience } from "@/components/public-v2/commerce/CheckoutExperience";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";
import { evaluateMarketplaceCheckoutPublicGate } from "@/lib/marketplace-checkout/production-lock";

export const metadata: Metadata = {
  title: "Secure Checkout | KT Couriers Marketplace",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

export default async function MarketplaceCheckoutPage() {
  await connection();
  const gate = evaluateMarketplaceCheckoutPublicGate();
  if (!gate.enabled) {
    return <MarketplaceUnavailable routeContext="checkout" />;
  }
  return (
    <Suspense fallback={<div style={{ padding: "4rem 0", textAlign: "center" }}>Loading checkout...</div>}>
      <CheckoutExperience />
    </Suspense>
  );
}
