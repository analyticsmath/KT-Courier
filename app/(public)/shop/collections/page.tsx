import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CommerceBreadcrumbs } from "@/components/public-v2/commerce/CommerceBreadcrumbs";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { marketplaceCollectionHref, marketplaceHref } from "@/lib/public-marketplace/routes";
import { listStorefrontCollections } from "@/lib/services/storefront-catalog.service";
import { storefrontCategoryMediaSrc } from "@/lib/storefront/category-media";

export const metadata: Metadata = {
  title: "Collections | KT Couriers Marketplace",
  description: "Browse curated collections from local stores on the KT Couriers marketplace.",
};

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const collections = await listStorefrontCollections();
  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner}>
        <CommerceBreadcrumbs items={[{ label: "Shop", href: marketplaceHref() }, { label: "Collections" }]} />
        <header className={styles.commercePageIntro}>
          <h1 className={styles.commerceTitle}>Collections</h1>
          <p className={styles.commerceLead}>Thoughtful edits of products, stores and categories to help you find your next favorite.</p>
        </header>
        {collections.length ? (
          <ul aria-label="Curated collections" className={styles.collectionGrid}>
            {collections.map((collection) => {
              const href = marketplaceCollectionHref(collection.slug);
              if (!href) return null;
              return <li key={collection.reference}>
                <Link className={styles.collectionCard} href={href}>
                  {collection.coverMediaReference && <span className={styles.collectionCardImage}><Image alt="" fill priority={collections.indexOf(collection) === 0} sizes="(max-width: 767px) 100vw, (max-width: 1200px) 60vw, 66vw" src={storefrontCategoryMediaSrc(collection.coverMediaReference)!} style={{ objectFit: "cover" }} /></span>}
                  <span className={styles.collectionCardCopy}>
                    <h2>{collection.name}</h2>
                    {collection.description && <p>{collection.description}</p>}
                    <p>{collection.itemCount} {collection.itemCount === 1 ? "edit" : "edits"}</p>
                  </span>
                </Link>
              </li>;
            })}
          </ul>
        ) : (
          <section className={styles.commerceEmptyState}>
            <p className={styles.productTileBrand}>Curated for you</p>
            <h2>New collections are on their way.</h2>
            <p>Browse the full range of products and independent stores in the meantime.</p>
            <div className={styles.productActionRow}>
              <Link className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} href={marketplaceHref()}>Browse the shop</Link>
              <Link className={styles.productActionButton} href="/shop/categories">Shop by category</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
