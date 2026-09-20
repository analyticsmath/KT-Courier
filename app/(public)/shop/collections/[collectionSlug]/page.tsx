import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommerceBreadcrumbs } from "@/components/public-v2/commerce/CommerceBreadcrumbs";
import { ProductTile } from "@/components/public-v2/commerce/ProductTile";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplaceCategoryHref,
  marketplaceCollectionHref,
  marketplaceCollectionsHref,
  marketplaceHref,
  marketplaceSlug,
  marketplaceStoreHref,
  marketplaceVariantHref,
} from "@/lib/public-marketplace/routes";
import { getStorefrontCollection } from "@/lib/services/storefront-catalog.service";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";

export async function generateMetadata({ params }: { params: Promise<{ collectionSlug: string }> }): Promise<Metadata> {
  if (!publicStorefrontPageExposureAllowed()) return { robots: { index: false, follow: true } };
  const slug = marketplaceSlug((await params).collectionSlug);
  if (!slug) return {};
  const collection = await getStorefrontCollection(slug);
  const canonical = collection ? marketplaceCollectionHref(collection.slug) : null;
  return collection ? { title: `${collection.name} | Curated Collection`, description: collection.description, robots: { index: collection.indexable, follow: true }, alternates: canonical ? { canonical } : undefined } : {};
}

export default async function CollectionPage({ params }: { params: Promise<{ collectionSlug: string }> }) {
  const slug = marketplaceSlug((await params).collectionSlug);
  if (!slug) notFound();
  const collection = await getStorefrontCollection(slug);
  if (!collection?.items.length) notFound();

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner}>
        <CommerceBreadcrumbs items={[{ label: "Shop", href: marketplaceHref() }, { label: "Collections", href: marketplaceCollectionsHref() }, { label: collection.name }]} />
        <header className={styles.collectionDetailIntro}>
          <p className={styles.productTileBrand}>A curated edit</p>
          <h1 className={styles.commerceTitle}>{collection.name}</h1>
          {collection.description && <p className={styles.commerceLead}>{collection.description}</p>}
        </header>
        <ul aria-label={`${collection.name} collection`} className={styles.collectionMixedGrid}>
          {collection.items.map((item, index) => {
            if (!item) return null;
            if (item.product && item.offers?.length) {
              const offers = item.offers;
              const priced = [...offers].sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
              const card: StorefrontProductCard = {
                productReference: item.product.productReference,
                productSlug: item.product.productSlug,
                title: item.label ?? item.product.title,
                ...(item.product.brandName ? { brandName: item.product.brandName } : {}),
                ...(item.product.primaryMedia ? { primaryMedia: item.product.primaryMedia } : {}),
                representativeVariantReference: priced[0]!.variantReference,
                price: { amount: priced[0]!.price.amount, currency: "ZAR", from: new Set(offers.map((offer) => offer.price.amount)).size > 1 },
                variantCount: new Set(offers.map((offer) => offer.variantReference)).size,
                storeCount: new Set(offers.map((offer) => offer.storeReference)).size,
                availability: priced[0]!.availability,
              };
              return <ProductTile key={`${item.targetType}:${item.targetReference}`} product={card} priority={index < 4} />;
            }

            const target = item.variant ?? item.category ?? item.store;
            if (!target) return null;
            const href = item.variant
              ? marketplaceVariantHref(item.variant.productSlug, item.variant.productReference, item.variant.variantReference)
              : item.category
                ? marketplaceCategoryHref(item.category.path)
                : item.store
                  ? marketplaceStoreHref(item.store.slug)
                  : null;
            if (!href) return null;
            const title = item.label ?? ("name" in target ? target.name : target.title);
            const description = "shortDescription" in target ? target.shortDescription : "description" in target ? target.description : undefined;
            const mediaReference = item.variant?.primaryMedia?.publicReference ?? item.category?.imageReference ?? item.store?.heroMediaReference ?? item.store?.logoMediaReference;
            const typeLabel = item.category ? "Category" : item.store ? "Store" : "Product option";
            return <li className={styles.collectionMixedCard} key={`${item.targetType}:${item.targetReference}`}>
              <Link href={href}>
                <span className={styles.collectionMixedMedia}>
                  {mediaReference && <Image alt="" fill priority={index < 4} sizes="(max-width: 767px) 50vw, 25vw" src={`/api/catalog/media/${mediaReference}`} style={{ objectFit: "cover" }} />}
                </span>
                <span className={styles.productTileBrand}>{typeLabel}</span>
                <strong>{title}</strong>
                {description && <span className={styles.commerceStoreMeta}>{description}</span>}
                {item.store && <span className={styles.commerceStoreMeta}>{item.store.publishedOfferCount} products</span>}
                {item.category && <span className={styles.commerceStoreMeta}>{item.category.productCount} products</span>}
              </Link>
            </li>;
          })}
        </ul>
      </div>
    </main>
  );
}
