import type { Metadata } from "next";
import Link from "next/link";
import { MerchantDirectory } from "@/components/public-v2/commerce";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
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
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: "0.85rem",
            color: "var(--kt-muted, #5f6763)",
            padding: "1.5rem 0 1rem",
          }}
        >
          <Link href={marketplaceHref()} style={{ color: "inherit", textDecoration: "none" }}>
            Shop
          </Link>{" "}
          / <span aria-current="page" style={{ color: "var(--kt-carbon, #101210)", fontWeight: 600 }}>Stores</span>
        </nav>

        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 560, letterSpacing: "-0.035em", margin: "0 0 8px" }}>
            Independent Storefronts
          </h1>
          <p style={{ color: "var(--kt-muted, #5f6763)", fontSize: "1.05rem", margin: 0, maxWidth: 600 }}>
            Discover local merchants, verified suppliers, and direct store catalogs.
          </p>
        </div>

        <MerchantDirectory query={q} stores={stores} />
      </div>
    </main>
  );
}
