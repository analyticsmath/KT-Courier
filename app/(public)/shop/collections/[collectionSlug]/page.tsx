import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceCategoryHref, marketplaceCollectionHref, marketplaceCollectionsHref, marketplaceHref, marketplaceProductHref, marketplaceSlug, marketplaceStoreHref, marketplaceVariantHref } from "@/lib/public-marketplace/routes";
import { getStorefrontCollection } from "@/lib/services/storefront-catalog.service";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ collectionSlug: string }> }): Promise<Metadata> {
  const collectionSlug = marketplaceSlug((await params).collectionSlug);
  if (!collectionSlug) return {};
  const collection = await getStorefrontCollection(collectionSlug);
  const canonical = collection ? marketplaceCollectionHref(collection.slug) : null;
  return collection ? { title: collection.name, description: collection.description, robots: { index: collection.indexable, follow: true }, alternates: canonical ? { canonical } : undefined } : {};
}

export default async function CollectionPage({ params }: { params: Promise<{ collectionSlug: string }> }) {
  const collectionSlug = marketplaceSlug((await params).collectionSlug);
  if (!collectionSlug) notFound();
  const collection = await getStorefrontCollection(collectionSlug);
  if (!collection || !collection.items.length) notFound();
  const entries = collection.items.flatMap((item) => {
    if (!item) return [];
    const entry = item.product
      ? { href: marketplaceProductHref(item.product.productSlug, item.product.productReference), title: item.label ?? item.product.title, copy: item.product.shortDescription }
      : item.variant
        ? { href: marketplaceVariantHref(item.variant.productSlug, item.variant.productReference, item.variant.variantReference), title: item.label ?? item.variant.title, copy: item.variant.shortDescription }
        : item.category
          ? { href: marketplaceCategoryHref(item.category.path), title: item.label ?? item.category.name, copy: item.category.description }
          : item.store
            ? { href: marketplaceStoreHref(item.store.slug), title: item.label ?? item.store.name, copy: item.store.description }
            : null;
    return entry?.href ? [{ key: `${item.targetType}:${item.targetReference}`, type: item.targetType, ...entry, href: entry.href }] : [];
  });

  return (
    <main className={`${styles.page} ${styles.listing}`} id="storefront-content">
      <div className={styles.inner}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href={marketplaceHref()}>Shop</Link> / <Link href={marketplaceCollectionsHref()}>Collections</Link> / <span aria-current="page">{collection.name}</span></nav>
        <div className={styles.listingHeading}><p className={styles.eyebrow}>Marketplace collection</p><h1>{collection.name}</h1>{collection.description ? <p className={styles.listingDescription}>{collection.description}</p> : null}</div>
        <ul aria-label={collection.name} className={styles.storeGrid}>{entries.map((entry) => <li className={styles.storeCard} key={entry.key}><div className={styles.storeBody}><p className={styles.eyebrow}>{entry.type.toLocaleLowerCase("en-ZA")}</p><Link className={styles.storeName} href={entry.href}>{entry.title}</Link>{entry.copy ? <p className={styles.storeDescription}>{entry.copy}</p> : null}</div></li>)}</ul>
      </div>
    </main>
  );
}
