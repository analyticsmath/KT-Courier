import type { Metadata } from "next";
import { CartExperience } from "@/components/public-v2/commerce/CartExperience";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = {
  title: "Shopping Cart | KT Couriers Marketplace",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

export default function MarketplaceCartPage() {
  return <CartExperience />;
}
