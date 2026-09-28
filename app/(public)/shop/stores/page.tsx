import type { Metadata } from "next";
import { StoreCinema } from "@/components/public-v2/marketplace/StoreCinema";
import { listStorefrontStores } from "@/lib/services/storefront-catalog.service";

export const metadata: Metadata = {
  title: "Independent Storefronts | KT Couriers Marketplace",
  description: "Browse published local merchant stores connected to the KT Couriers marketplace.",
};

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = (await searchParams).q;
  const q = typeof query === "string" ? query.slice(0, 80) : "";
  const stores = await listStorefrontStores({ query: q || undefined, limit: 48 });

  return <main id="storefront-content"><StoreCinema mode="directory" query={q} stores={stores} /></main>;
}
