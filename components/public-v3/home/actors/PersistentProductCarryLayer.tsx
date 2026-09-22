"use client";

/* eslint-disable @next/next/no-img-element */

import type { HomepageProductItem } from "../data/home-storefront-presentation";
import styles from "../post-hero-rebuild.module.css";

/** A single fixed image that owns the Commerce → Parcel shared-element handoff. */
export function PersistentProductCarryLayer({ product }: { product?: HomepageProductItem }) {
  return (
    <div className={styles.persistentProductCarryLayer} data-product-carry-layer aria-hidden="true">
      {product ? <img className={styles.persistentProductCarryImage} data-product-carry-image src={product.image} alt="" /> : null}
    </div>
  );
}
