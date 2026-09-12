import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutExperience } from "@/components/public-v2/commerce/CheckoutExperience";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = {
  title: "Secure Checkout | KT Couriers Marketplace",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

export default function MarketplaceCheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: "4rem 0", textAlign: "center" }}>Loading checkout...</div>}>
      <CheckoutExperience />
    </Suspense>
  );
}
