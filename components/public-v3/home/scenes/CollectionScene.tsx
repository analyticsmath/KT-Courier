"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

interface CollectionSceneProps {
  className?: string;
}

/**
 * Chapter 06 — Van Collection & Vehicle Entrance.
 * Full-bleed street and dispatch photography establishes physical Johannesburg urban reality.
 * The delivery van arrives closed -> brakes and settles -> sliding side door reveals cargo space ->
 * courier steps out to receive the staged shipment.
 */
export function CollectionScene({ className = "" }: CollectionSceneProps) {
  const streetEnv = ktMediaV3.editorial.merchant.mabonengDepot;

  return (
    <section
      className={`${styles.collectionSection} ${className}`}
      data-kt-contrast="light"
      data-kt-scene="collection"
      data-motion="collection-world"
      aria-labelledby="collection-heading"
      style={{ "--kt-home-budget": chapterBudgetVh("collection"), "--kt-home-mobile-budget": mobileChapterBudgetVh("collection") } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-collection-sticky">
      {/* Street environment backdrop (Johannesburg dispatch context) */}
      <div className={`${styles.collectionStreet} kt-collection-street-env`}>
        <Image
          src={streetEnv.src}
          alt={streetEnv.alt}
          fill
          sizes="100vw"
          className="object-cover object-top"
        />
        <div className={styles.collectionStreetShade} />
      </div>
      <div className="kt-collection-ground-plane absolute inset-x-0 bottom-0 z-[1] h-[15vh] pointer-events-none" aria-hidden="true" />
      <div data-home-occluder="collection-viewport-edge" className="kt-collection-ground-line absolute inset-x-0 top-[85%] z-[2] pointer-events-none" aria-hidden="true" />

      <div className={styles.collectionHeading}>
        <div>
          <h2
            id="collection-heading"
            className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)] mb-4"
          >
            Collected by KT.
          </h2>
          <p>
            The van arrives, holds its place, and only then opens for the parcel.
          </p>
        </div>
      </div>

      {/* Actor Anchors: Measured layout slots for persistent Van and Courier on shared ground baseline */}
      <div data-motion="collection-ground" className={styles.collectionActorPlane}>
        <div
          data-actor-anchor="collection-van"
          className="w-[54vw] max-w-2xl min-h-[240px] sm:min-h-[320px] pointer-events-none"
        />
        <div
          data-actor-anchor="collection-courier"
          className="w-[30vw] max-w-xs -ml-10 sm:-ml-20 min-h-[240px] sm:min-h-[320px] pointer-events-none self-end"
        />
      </div>
      </div>
    </section>
  );
}
