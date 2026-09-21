"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

interface PreparationSceneProps {
  className?: string;
}

/**
 * Chapter 05 — Merchant Preparation & Packing.
 * A quiet, documentary pause following marketplace exploration.
 * Large documentary photograph occupying 65% of viewport showcases hands
 * taping and sealing the corrugated shipment box.
 * The parcel becomes the surviving physical hero of the frame.
 */
export function PreparationScene({ className = "" }: PreparationSceneProps) {
  const prepPhoto = ktMediaV3.pages.homepage.preparation;
  const collectionEnvironment = ktMediaV3.editorial.merchant.mabonengDepot;

  return (
    <section
      className={`${styles.preparationSection} ${className}`}
      data-kt-contrast="light"
      data-kt-scene="preparation"
      data-motion="prep-stage"
      aria-labelledby="prep-heading"
      style={{ "--kt-home-budget": chapterBudgetVh("preparation"), "--kt-home-mobile-budget": mobileChapterBudgetVh("preparation") } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-preparation-sticky">
      <div data-motion="prep-collection-incoming" className="absolute inset-0 z-0 opacity-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <Image src={collectionEnvironment.src} alt="" fill sizes="100vw" className="kt-preparation-collection-image object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--kt-freight-paper)]/70 via-transparent to-[var(--kt-asphalt)]/25" />
      </div>
      <div className={styles.preparationComposition}>
        <div className={styles.preparationStatement}>
          <h2 id="prep-heading">The order becomes a parcel.</h2>
          <p>Each handoff starts with a clear label, a sealed box, and a merchant who knows exactly what is leaving the counter.</p>
        </div>
        <div
          data-motion="prep-media"
          className={styles.preparationMainImage}
        >
          <Image
            src={prepPhoto.src}
            alt={prepPhoto.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 70vw"
            className="object-cover"
          />
        </div>

        <div className={styles.preparationDetail}>
          <span>Dispatch detail</span>
          <strong>Addressed. Sealed. Ready.</strong>
          <p>The quietest moment in the journey is also the point where care becomes operational.</p>
        </div>
      </div>
      </div>
    </section>
  );
}
