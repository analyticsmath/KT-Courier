import type { Metadata } from "next";
import Link from "next/link";
import { CategoryAtlas } from "@/components/public-v2/commerce";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
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
          / <span aria-current="page" style={{ color: "var(--kt-carbon, #101210)", fontWeight: 600 }}>Categories</span>
        </nav>

        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 560, letterSpacing: "-0.035em", margin: "0 0 8px" }}>
            Marketplace Categories
          </h1>
          <p style={{ color: "var(--kt-muted, #5f6763)", fontSize: "1.05rem", margin: 0, maxWidth: 600 }}>
            Explore goods, groceries, and services across independent local stores.
          </p>
        </div>

        <CategoryAtlas categories={categories} />
      </div>
    </main>
  );
}
