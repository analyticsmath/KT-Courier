"use client";

import Image from "next/image";

interface PreparationSceneProps {
  className?: string;
}

/**
 * Scene 04 — Choice → Parcel Preparation.
 * A quiet, calm breath following marketplace exploration.
 * Focuses on the physical preparation of an order before transit.
 */
export function PreparationScene({ className = "" }: PreparationSceneProps) {
  return (
    <section
      className={`relative min-h-[85vh] flex items-center justify-center bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-20 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="preparation"
      aria-labelledby="prep-heading"
    >
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Left: Documentary Packing Media */}
        <div className="relative aspect-[4/3] w-full bg-[var(--kt-concrete)]/30 rounded-none overflow-hidden">
          <Image
            src="/images/kt-couriers/provisional/r2/documentary/r2-doc-01-prepare.webp"
            alt="Local merchant packing and preparing parcel for courier pickup"
            fill
            sizes="(max-width: 767px) 94vw, 600px"
            className="object-cover"
          />
          {/* Subtle parcel label stamp */}
          <div className="absolute bottom-4 left-4 bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] px-3 py-1.5 text-xs font-mono font-medium tracking-wide">
            PACKED · READY FOR DISPATCH
          </div>
        </div>

        {/* Right: Narrative Framing */}
        <div className="space-y-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--kt-road-grey)]">
            Stage 01 · Origin
          </span>
          <h2
            id="prep-heading"
            className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)]"
          >
            Ready for pickup.
          </h2>
          <p className="text-lg text-[var(--kt-road-grey)] max-w-lg leading-relaxed">
            The order is packed. The details are in. Now it needs to move.
          </p>
        </div>
      </div>
    </section>
  );
}
