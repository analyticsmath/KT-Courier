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
  const secondaryPhoto = ktMediaV3.pages.homepage.preparationSecondary;

  return (
    <section
      className={`relative min-h-[90vh] flex items-center justify-center bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-20 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="preparation"
      aria-labelledby="prep-heading"
    >
      <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left: Dominant Documentary Image (65% width on desktop) */}
        <div className="lg:col-span-8 relative aspect-[16/10] sm:aspect-[16/9] w-full bg-[var(--kt-concrete)]/30 rounded-none overflow-hidden shadow-lg">
          <Image
            src={prepPhoto.src}
            alt={prepPhoto.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 68vw"
            className="object-cover"
            priority
          />
          {/* Physical verification stamp */}
          <div className="absolute bottom-4 left-4 bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] px-3 py-1.5 text-xs font-mono font-medium tracking-wide">
            PACKED &bull; DISPATCH STAGED
          </div>
        </div>

        {/* Right: Narrative Framing & Secondary Detail */}
        <div className="lg:col-span-4 space-y-8">
          <div>
            <span className="text-xs uppercase font-mono tracking-widest text-[var(--kt-graphite)] mb-3 block">
              Chapter 05 &bull; Merchant Floor
            </span>
            <h2
              id="prep-heading"
              className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)] mb-4"
            >
              Ready for pickup.
            </h2>
            <p className="text-base sm:text-lg text-[var(--kt-graphite)] leading-relaxed">
              The order is folded, wrapped and boxed. The parcel now waits at the counter for driver arrival.
            </p>
          </div>

          {/* Secondary Shelf Staging Detail */}
          <div className="relative aspect-[16/9] w-full max-w-sm rounded-none overflow-hidden border border-[var(--kt-concrete)] shadow-sm hidden sm:block">
            <Image
              src={secondaryPhoto.src}
              alt={secondaryPhoto.alt}
              fill
              sizes="360px"
              className="object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-[var(--kt-asphalt)]/80 text-[var(--kt-freight-paper)] px-2 py-0.5 text-[10px] font-mono">
              STAGING COUNTER
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
