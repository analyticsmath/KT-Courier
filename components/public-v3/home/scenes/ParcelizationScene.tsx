"use client";

import type { HomepageProductItem } from "../data/home-storefront-presentation";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-rebuild.module.css";

/* eslint-disable @next/next/no-img-element */

export function ParcelizationScene({ product }: { product?: HomepageProductItem }) {
  const preparation = ktMediaV3.pages.homepage.preparation;
  return (
    <section className={`${styles.chapter} ${styles.parcel}`} data-kt-scene="parcelization" aria-labelledby="parcel-heading" style={{ "--kt-home-budget": `${chapterBudgetVh("parcelization")}svh`, "--kt-home-mobile-budget": `${mobileChapterBudgetVh("parcelization")}svh` } as React.CSSProperties}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.parcelStage}>
          <div className={styles.parcelCopy}><p className={styles.eyebrow}>Preparation</p><h2 className={styles.heading} id="parcel-heading">The order becomes a parcel.</h2><p className={styles.body}>Each delivery leaves the counter prepared for collection and the road ahead.</p></div>
          <div className={styles.preparationFrame} data-package-cover>
            <img className={styles.preparationPhoto} src={preparation.src} alt={preparation.alt} data-preparation-photo />
            <div className={styles.preparationShade} />
            <span className={styles.packageLabel} data-package-label>KT · PREPARED FOR COLLECTION</span>
          </div>
          <div className={styles.productCarry} data-parcel-selected-product-media>{product ? <img src={product.image} alt="" aria-hidden="true" /> : null}</div>
          <span className={styles.preparationIndexMark} data-package-back aria-hidden="true">01 / PREP</span>
          <div className={styles.processLine} data-label-route-line aria-label="Delivery process"><span>Preparation</span><i /> <span>Collection</span><i /> <span>Transportation</span><i /> <span>Delivery</span></div>
          <div className={styles.routeCarryLine} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
