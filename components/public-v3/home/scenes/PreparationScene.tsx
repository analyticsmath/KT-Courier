"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

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
      className={`relative min-h-[90vh] flex items-center justify-center bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-20 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="preparation"
      data-motion="prep-stage"
      aria-labelledby="prep-heading"
      style={{ "--kt-home-budget": 200 } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-preparation-sticky">
      <div data-motion="prep-collection-incoming" className="absolute inset-0 z-0 opacity-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <Image src={collectionEnvironment.src} alt="" fill sizes="100vw" className="kt-preparation-collection-image object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--kt-freight-paper)]/70 via-transparent to-[var(--kt-asphalt)]/25" />
      </div>
      <div className="relative z-10 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Dominant Documentary Image (65-75% width on desktop) */}
        <div
          data-motion="prep-media"
          className="lg:col-span-8 relative aspect-[16/10] sm:aspect-[16/9] w-full bg-[var(--kt-concrete)]/20 rounded-none overflow-hidden"
        >
          <Image
            src={prepPhoto.src}
            alt={prepPhoto.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 70vw"
            className="object-cover prepPhotoImg"
          />
          {/* Spatial target for Fan -> Preparation hero card contraction */}
          <div
            data-preparation-parcel-target="true"
            data-motion="prep-parcel-target"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 sm:w-64 h-36 sm:h-48 pointer-events-none opacity-0"
            aria-hidden="true"
          />
        </div>

        {/* Concise Editorial Text Plane */}
        <div className="lg:col-span-4 space-y-4">
          <h2
            id="prep-heading"
            className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)]"
          >
            Ready for pickup.
          </h2>
          <p className="text-base sm:text-lg text-[var(--kt-graphite)] leading-relaxed">
            The parcel has been prepared and is waiting for collection.
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}
