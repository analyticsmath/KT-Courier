"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

export function PreparationScene({ className = "" }: { className?: string }) {
  const prepPhoto = ktMediaV3.pages.homepage.preparation;
  const street = ktMediaV3.editorial.merchant.mabonengDepot;
  const style = {
    "--kt-home-budget": `${chapterBudgetVh("preparation")}svh`,
    "--kt-home-mobile-budget": `${mobileChapterBudgetVh("preparation")}svh`,
  } as CSSProperties;

  return (
    <section
      className={`${styles.preparationSection} ${className}`}
      data-kt-contrast="light"
      data-kt-scene="preparation"
      aria-labelledby="prep-heading"
      style={style}
    >
      <div className={styles.preparationStickyStage} data-home-sticky-stage>
        <div className={styles.preparationComposition}>
          <div className={styles.preparationStatement}>
            <h2 id="prep-heading">The order becomes a parcel.</h2>
            <p>Each delivery leaves the counter labelled, sealed and ready for the road.</p>
          </div>
          <div data-preparation-target className={styles.preparationMainImage}>
            <Image
              src={prepPhoto.src}
              alt={prepPhoto.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 70vw"
              className={styles.preparationPhoto}
              preload
            />
          </div>
          <div className={styles.preparationDetail}>
            <span>Dispatch detail</span>
            <strong>Addressed. Sealed. Ready.</strong>
          </div>
        </div>
        <div className={styles.preparationStreetTransition} data-preparation-street aria-hidden="true">
          <Image src={street.src} alt="" fill sizes="100vw" className="object-cover" />
        </div>
      </div>
    </section>
  );
}
