"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { marketplaceProductHref } from "@/lib/public-marketplace/routes";
import { useTransitionContext } from "@/components/public-v2/motion/PublicTransitionRouter";
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
  const href = marketplaceProductHref(
    product.productSlug,
    product.productReference
  );

  const mediaSrc = product.primaryMedia
    ? `/api/catalog/media/${product.primaryMedia.publicReference}`
    : undefined;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (mediaSrc) {
      const frameEl = e.currentTarget.querySelector<HTMLElement>(`.${styles.productTileMediaFrame}`);
      if (frameEl) {
        captureSourceMedia(
          `product-${product.productReference}`,
          frameEl,
          mediaSrc,
          product.primaryMedia?.alt || product.title
        );
      }
    }
  };

  const tileInner = (
    <motion.div
      className="w-full flex flex-col"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      <div className={styles.productTileMediaFrame}>
        {mediaSrc ? (
          <Image
            alt={product.primaryMedia?.alt || product.title}
            fill
            priority={priority}
            sizes="(max-width: 639px) calc(50vw - 20px), (max-width: 1023px) 33vw, 24vw"
            src={mediaSrc}
          />
        ) : (
          <div
            aria-label={`${product.title} image unavailable`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              color: "var(--kt-muted, #5f6763)",
              fontSize: "0.85rem",
            }}
          >
            No image
          </div>
        )}
        <span aria-hidden="true" className={styles.productTileQuickAction}>
          {product.variantCount > 1 ? "Choose Options" : "View Details"}
        </span>
      </div>

      <div className={styles.productTileBody}>
        {product.brandName && (
          <span className={styles.productTileBrand}>{product.brandName}</span>
        )}
        <h3 className={styles.productTileTitle}>{product.title}</h3>
        <span className={styles.productTilePrice}>
          {formatPrice(product.price.amount, product.price.currency)}
        </span>
        <span className={styles.productTileAvailability}>
          {availabilityLabel(product.availability)}
        </span>
        {!href && (
          <span className={styles.productTileUnavailableBadge}>
            Temporarily unavailable
          </span>
        )}
      </div>
    </motion.div>
  );

  return (
    <li style={{ listStyle: "none" }}>
      {href ? (
        <Link
          className={styles.productTile}
          href={href}
          onClick={handleClick}
          data-kt-sticky-mode="VIEW"
        >
          {tileInner}
        </Link>
      ) : (
        <div aria-disabled="true" className={`${styles.productTile} ${styles.productTileDisabled}`}>
          {tileInner}
        </div>
      )}
    </li>
  );
}
