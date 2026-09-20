"use client";

import Image from "next/image";
import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { marketplaceProductHref } from "@/lib/public-marketplace/routes";
import { useTransitionContext } from "@/components/public-v2/motion/PublicTransitionRouter";
import { useCallback, useState } from "react";
import { QuickBuySheet } from "./QuickBuySheet";
import styles from "./commerce.module.css";

function formatPrice(amount: string, currency: "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(
    Number(amount)
  );
}

interface ProductTileProps {
  product: StorefrontProductCard;
  priority?: boolean;
}

export function ProductTile({ product, priority = false }: ProductTileProps) {
  const { captureSourceMedia } = useTransitionContext();
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const closeQuickBuy = useCallback(() => setQuickBuyOpen(false), []);
  const href = marketplaceProductHref(
    product.productSlug,
    product.productReference
  );

  const mediaSrc = product.primaryMedia
    ? `/api/catalog/media/${product.primaryMedia.publicReference}`
    : undefined;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (mediaSrc) {
      captureSourceMedia(
          `product-${product.productReference}`,
          e.currentTarget,
          mediaSrc,
          product.primaryMedia?.alt || product.title
        );
    }
  };

  return (
    <li style={{ listStyle: "none" }}>
      <article className={styles.productTile}>
        {href ? <Link aria-label={`View ${product.title}`} className={styles.productTileMediaFrame} data-kt-sticky-mode="VIEW" href={href} onClick={handleClick}>
          {mediaSrc ? <Image alt={product.primaryMedia?.alt || product.title} fill priority={priority} sizes="(max-width: 639px) calc(50vw - 24px), (max-width: 1023px) 33vw, 24vw" src={mediaSrc} className="object-cover" /> : <span className={styles.productTileAvailability}>Image unavailable</span>}
          {product.storeCount > 1 && <span className={styles.productTileStatus}>From {product.storeCount} stores</span>}
        </Link> : <div aria-disabled="true" className={`${styles.productTileMediaFrame} ${styles.productTileDisabled}`}>
          {mediaSrc && <Image alt={product.primaryMedia?.alt || product.title} fill priority={priority} sizes="(max-width: 639px) calc(50vw - 24px), (max-width: 1023px) 33vw, 24vw" src={mediaSrc} className="object-cover" />}
          <span className={styles.productTileUnavailableBadge}>Temporarily unavailable</span>
        </div>}
        <div className={styles.productTileBody}>
          {product.brandName && <span className={styles.productTileBrand}>{product.brandName}</span>}
          {href ? <Link className={styles.productTileTitleLink} data-kt-sticky-mode="VIEW" href={href} onClick={handleClick}><h3 className={styles.productTileTitle}>{product.title}</h3></Link> : <h3 className={styles.productTileTitle}>{product.title}</h3>}
          <span className={styles.productTilePrice}>{product.price.from ? "From " : ""}{formatPrice(product.price.amount, product.price.currency)}</span>
          <span className={styles.productTileAvailability}>{availabilityLabel(product.availability)}{product.variantCount > 1 ? ` · ${product.variantCount} options` : ""}</span>
        </div>
        <div className={styles.productActionRow}>
          <button className={styles.productActionButton} disabled={!href} onClick={() => setQuickBuyOpen(true)} type="button">Add to cart</button>
          {href ? <Link className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} data-kt-sticky-mode="VIEW" href={href} onClick={handleClick}>{product.variantCount > 1 ? "Choose options" : "View item"}</Link> : <button className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} disabled type="button">Unavailable</button>}
        </div>
      </article>
      <QuickBuySheet onClose={closeQuickBuy} open={quickBuyOpen} product={product} />
    </li>
  );
}
