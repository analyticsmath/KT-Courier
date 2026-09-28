import Image from "next/image";
import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { marketplaceCategoryHref, marketplaceProductHref } from "@/lib/public-marketplace/routes";
import { CommerceSearchCommand } from "@/components/public-v2/commerce/CommerceSearchCommand";
import { ShopCategoryCircleRail } from "./ShopCategoryCircleRail";
import { shopCategoryMedia } from "./shop-category-media";
import type { MarketplaceCategory } from "./MarketplaceLanding";
import styles from "./shop-flagship.module.css";

export function ShopMobileDiscovery({ categories, products }: { categories: readonly MarketplaceCategory[]; products: readonly StorefrontProductCard[] }) {
  const feature = products.find((product) => product.primaryMedia && marketplaceProductHref(product.productSlug, product.productReference));
  const fallback = categories.find((category) => shopCategoryMedia(category) && marketplaceCategoryHref(category.path));
  const featureHref = feature && marketplaceProductHref(feature.productSlug, feature.productReference);
  const fallbackHref = fallback && marketplaceCategoryHref(fallback.path);
  const featureSrc = feature?.primaryMedia ? `/api/catalog/media/${feature.primaryMedia.publicReference}` : fallback ? shopCategoryMedia(fallback) : undefined;
  return <section className={styles.mobileDiscovery} aria-labelledby="mobile-shop-title">
    <div className={styles.mobileDiscoveryField}>
      <span className={styles.mobileDiscoveryEyebrow}>KT MARKETPLACE</span>
      <h1 id="mobile-shop-title">Discover what&apos;s new</h1>
      <div className={styles.mobileDiscoverySearch}><CommerceSearchCommand appearance="shop" /></div>
      <p>Find products from independent storefronts.</p>
      {featureSrc && (featureHref || fallbackHref) && <Link className={styles.mobileFeature} href={(featureHref || fallbackHref)!}>
        <span className={styles.mobileFeatureImage}><Image alt={feature?.primaryMedia?.alt || feature?.title || fallback?.name || "Marketplace category"} fill sizes="112px" src={featureSrc} /></span>
        <span className={styles.mobileFeatureCopy}><small>{feature ? "NEW IN MARKET" : "EXPLORE CATEGORIES"}</small><strong>{feature?.title || fallback?.name}</strong>{feature && <span>{new Intl.NumberFormat("en-ZA", { style: "currency", currency: feature.price.currency }).format(Number(feature.price.amount))}</span>}</span>
        <span aria-hidden="true">↗</span>
      </Link>}
    </div>
    <div className={styles.mobileDiscoveryCategories}><ShopCategoryCircleRail categories={categories} /></div>
  </section>;
}
