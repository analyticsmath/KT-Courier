import type { Metadata } from "next";
import { MerchantDirectory } from "@/components/public-v2/commerce";
import { CommerceBreadcrumbs } from "@/components/public-v2/commerce/CommerceBreadcrumbs";
import styles from "@/components/public-v2/commerce/commerce.module.css";
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

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner}>
        <CommerceBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Stores" }]} />

        <div style={{ marginBottom: "2rem" }}>
          <h1 className={styles.commerceTitle}>Stores</h1>
          <p className={styles.commerceLead}>Explore independent local stores and their published products.</p>
        </div>

        <MerchantDirectory query={q} stores={stores} />
      </div>
    </main>
  );
}
