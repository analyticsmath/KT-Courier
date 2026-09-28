"use client";
import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { marketplaceProductHref } from "@/lib/public-marketplace/routes";
import { useTransitionContext } from "@/components/public-v2/motion/PublicTransitionRouter";
import { QuickBuySheet } from "@/components/public-v2/commerce/QuickBuySheet";
import styles from "./shop-flagship.module.css";

export function ShopShelfProductCard({ product, priority = false, shelf = false }: { product: StorefrontProductCard; priority?: boolean; shelf?: boolean }) {
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const closeQuickBuy = useCallback(() => setQuickBuyOpen(false), []);
  const { captureSourceMedia } = useTransitionContext();
  const href = marketplaceProductHref(product.productSlug, product.productReference);
  const src = product.primaryMedia && `/api/catalog/media/${product.primaryMedia.publicReference}`;
  const imageSizes = shelf ? "(max-width: 767px) 80vw, 390px" : "(max-width: 767px) 74vw, 320px";
  const topLine = product.brandName || (shelf ? product.storeCount > 1 ? `Available from ${product.storeCount} stores` : availabilityLabel(product.availability) : undefined);
  const capture = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (src) captureSourceMedia(`product-${product.productReference}`, event.currentTarget, src, product.primaryMedia?.alt || product.title);
  };
  return <li className={styles.productCard}>
    <article>
      {href ? <Link className={styles.productMedia} href={href} onClick={capture} aria-label={`View ${product.title}`}>
        {src ? <Image alt={product.primaryMedia?.alt || product.title} fill preload={priority} sizes={imageSizes} src={src} /> : <span>Image unavailable</span>}
      </Link> : <div className={styles.productMedia}>{src ? <Image alt={product.primaryMedia?.alt || product.title} fill sizes={shelf ? "390px" : "320px"} src={src} /> : <span>Image unavailable</span>}</div>}
      <div className={styles.productBody}>
        {topLine && <div className={styles.productBrand}>{topLine}</div>}
        {href ? <Link className={styles.productTitle} href={href} onClick={capture}>{product.title}</Link> : <strong className={styles.productTitle}>{product.title}</strong>}
        <div className={styles.productMeta}>{availabilityLabel(product.availability)}{product.variantCount > 1 ? ` · ${product.variantCount} options` : ""}</div>
        <div className={styles.productBottom}>
          <span className={styles.productPrice}>{product.price.from && <small>From </small>}{new Intl.NumberFormat("en-ZA", { style: "currency", currency: product.price.currency }).format(Number(product.price.amount))}</span>
          <button className={styles.bagButton} type="button" aria-label={`Quick add ${product.title}`} disabled={!href} onClick={() => setQuickBuyOpen(true)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16l-1.3 12H5.3L4 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg></button>
        </div>
      </div>
    </article>
    {quickBuyOpen && <QuickBuySheet product={product} open onClose={closeQuickBuy} />}
  </li>;
}
