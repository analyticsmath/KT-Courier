import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceCategoryRail } from "@/components/public-v2/marketplace/MarketplaceCards";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { listStorefrontCategories } from "@/lib/services/storefront-catalog.service";

export const metadata: Metadata = {
  title: "Marketplace Categories | KT Couriers",
  description: "Browse published marketplace categories from local stores connected to KT Couriers.",
};

export default async function CategoriesPage() {
  const categories = await listStorefrontCategories();

  return (
    <main className={`${styles.page} ${styles.listing}`} id="storefront-content">
      <div className={styles.inner}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href={marketplaceHref()}>Shop</Link> / <span aria-current="page">Categories</span></nav>
        <div className={styles.listingHeading}><p className={styles.eyebrow}>Marketplace categories</p><h1>Browse by category.</h1><p className={styles.listingDescription}>Category records are published from the storefront projection. Select a category to see its current product results.</p></div>
        {categories.length ? <MarketplaceCategoryRail categories={categories} label="Marketplace categories" /> : <section className={styles.empty} aria-labelledby="categories-empty"><h2 id="categories-empty">Categories are being prepared</h2><p>Published categories will appear here when products are available.</p></section>}
      </div>
    </main>
  );
}
