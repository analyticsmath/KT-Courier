"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { marketplaceProductHref } from "@/lib/public-marketplace/routes";
import { useTransitionContext } from "@/components/public-v2/motion/PublicTransitionRouter";
import { QuickBuySheet } from "./QuickBuySheet";
import styles from "./marketplace-product-card.module.css";

export type MarketplaceProductCardVariant = "shelf" | "grid" | "related";

export function MarketplaceProductCard({ product, variant, priority = false, className = "" }: {
  product: StorefrontProductCard;
  variant: MarketplaceProductCardVariant;
  priority?: boolean;
  className?: string;
}) {
  const { captureSourceMedia } = useTransitionContext();
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const closeQuickBuy = useCallback(() => setQuickBuyOpen(false), []);
  const href = marketplaceProductHref(product.productSlug, product.productReference);
  const src = product.primaryMedia ? `/api/catalog/media/${product.primaryMedia.publicReference}` : undefined;
  const meta = product.brandName || (product.storeCount > 1 ? `Available from ${product.storeCount} stores` : availabilityLabel(product.availability));
  const availability = `${availabilityLabel(product.availability)}${product.variantCount > 1 ? ` · ${product.variantCount} options` : ""}`;
  const capture = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (src) captureSourceMedia(`product-${product.productReference}`, event.currentTarget, src, product.primaryMedia?.alt || product.title);
  };
  const media = src
    ? <Image alt={product.primaryMedia?.alt || product.title} fill preload={priority} sizes={variant === "shelf" ? "(max-width: 767px) 250px, 390px" : variant === "related" ? "(max-width: 767px) 190px, 25vw" : "(max-width: 767px) 45vw, 25vw"} src={src} />
    : <span className={styles.missing}>Image unavailable</span>;

  return <li className={`${styles.card} ${styles[variant]} ${className}`}>
    <article>
      {href ? <Link aria-label={`View ${product.title}`} className={styles.media} data-kt-sticky-mode="VIEW" href={href} onClick={capture}>{media}</Link>
        : <div aria-disabled="true" className={styles.media}>{media}</div>}
      <div className={styles.body}>
        <span className={styles.brand}>{meta}</span>
        {href ? <Link className={styles.title} data-kt-sticky-mode="VIEW" href={href} onClick={capture}>{product.title}</Link>
          : <strong className={styles.title}>{product.title}</strong>}
        {variant !== "related" && <span className={styles.availability}>{availability}</span>}
        <div className={styles.bottom}>
          <span className={styles.price}>{product.price.from && <small>From </small>}{new Intl.NumberFormat("en-ZA", { style: "currency", currency: product.price.currency }).format(Number(product.price.amount))}</span>
          <button className={styles.basket} type="button" aria-label={`Quick add ${product.title}`} disabled={!href} onClick={() => setQuickBuyOpen(true)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16l-1.3 12H5.3L4 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
          </button>
        </div>
      </div>
    </article>
    {quickBuyOpen && <QuickBuySheet product={product} open onClose={closeQuickBuy} />}
  </li>;
}
