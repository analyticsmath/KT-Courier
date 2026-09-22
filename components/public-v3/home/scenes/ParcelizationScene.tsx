"use client";

import type { HomepageProductItem } from "../data/home-storefront-presentation";
import styles from "../post-hero-rebuild.module.css";

/* eslint-disable @next/next/no-img-element */

export function ParcelizationScene({ product }: { product?: HomepageProductItem }) {
  return (
    <section className={`${styles.chapter} ${styles.parcel}`} data-kt-scene="parcelization" aria-labelledby="parcel-heading" style={{ minHeight: "135svh" }}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.parcelStage}>
          <div>
            <p className={styles.eyebrow}>Preparation</p>
            <h2 className={styles.heading} id="parcel-heading">The order becomes a parcel.</h2>
            <p className={styles.body}>Each delivery leaves the counter labelled, sealed and ready for the road.</p>
            <p className={styles.body}>Addressed. Sealed. Ready.</p>
          </div>
          <div className={styles.parcelObject} data-parcel-object>
            {product ? <img className={styles.selectedImage} data-selected-product-media src={product.image} alt="" aria-hidden="true" /> : null}
            <div className={`${styles.package} ${styles.packageBack}`} data-package-back aria-hidden="true" />
            <div className={`${styles.package} ${styles.packageFront}`} data-package-cover aria-hidden="true">
              <span className={styles.packageLabel} data-package-label>KT · ADDRESSED</span>
              <div className={styles.packageTape} />
            </div>
            <div className={styles.routeLine} data-label-route-line aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
