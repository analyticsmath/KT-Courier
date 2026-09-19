"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

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
      className={`relative min-h-[92vh] flex flex-col justify-between bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-16 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="collection"
      data-motion="collection-world"
      aria-labelledby="collection-heading"
    >
      {/* Street environment backdrop (Johannesburg dispatch context) */}
      <div className="kt-collection-street-env absolute inset-0 z-0 opacity-25 pointer-events-none overflow-hidden will-change-transform">
        <Image
          src={streetEnv.src}
          alt={streetEnv.alt}
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--kt-freight-paper)] via-transparent to-[var(--kt-freight-paper)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full pt-4">
        <div className="max-w-xl">
          <h2
            id="collection-heading"
            className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)] mb-4"
          >
            Collected by KT.
          </h2>
          <p className="text-base sm:text-lg text-[var(--kt-graphite)] leading-relaxed">
            A courier arrives for collection and the parcel moves into the van.
          </p>
        </div>
      </div>

      {/* Actor Anchors: Measured layout slots for persistent Van and Courier on shared ground baseline */}
      <div
        data-motion="collection-ground"
        className="relative z-10 max-w-6xl mx-auto w-full flex flex-row items-end justify-start gap-4 my-auto pt-8"
      >
        <div
          data-actor-anchor="collection-van"
          className="w-[54vw] max-w-2xl min-h-[240px] sm:min-h-[320px] pointer-events-none"
        />
        <div
          data-actor-anchor="collection-courier"
          className="w-[30vw] max-w-xs -ml-10 sm:-ml-20 min-h-[240px] sm:min-h-[320px] pointer-events-none self-end"
        />
      </div>
    </section>
  );
}
