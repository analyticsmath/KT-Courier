import type { Metadata } from "next";
import { CategoryAtlas } from "@/components/public-v2/commerce";
import { CommerceBreadcrumbs } from "@/components/public-v2/commerce/CommerceBreadcrumbs";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { listStorefrontCategories } from "@/lib/services/storefront-catalog.service";

export const metadata: Metadata = {
  title: "Categories | KT Couriers Marketplace",
  description: "Browse published marketplace categories from local stores connected to KT Couriers.",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listStorefrontCategories();

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner}>
        <CommerceBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Categories" }]} />

        <div style={{ marginBottom: "2rem" }}>
          <h1 className={styles.commerceTitle}>Categories</h1>
          <p style={{ color: "var(--kt-muted, #5f6763)", fontSize: "1.05rem", margin: 0, maxWidth: 600 }}>
            Explore goods, groceries, and services across independent local stores.
          </p>
        </div>

        <CategoryAtlas categories={categories} />
      </div>
    </main>
  );
}
