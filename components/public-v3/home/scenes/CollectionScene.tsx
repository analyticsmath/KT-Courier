"use client";

import Image from "next/image";

interface CollectionSceneProps {
  className?: string;
}

/**
 * Scene — Van Collection.
 * Courier arrives at the merchant location, van sliding door opens, and the parcel is collected.
 * The persistent actor layer renders the van and courier into these measured anchors.
 */
export function CollectionScene({ className = "" }: CollectionSceneProps) {
  return (
    <section
      className={`relative min-h-[90vh] flex flex-col justify-between bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-16 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="collection"
      aria-labelledby="collection-heading"
    >
      {/* Street environment backdrop */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <Image
          src="/media/public/images/jhb-maboneng-vehicle-workshop.webp"
          alt="Johannesburg street and dispatch collection environment"
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full pt-4">
        <div className="max-w-xl">
          <h2
            id="collection-heading"
            className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)] mb-4"
          >
            Collected by KT.
          </h2>
          <p className="text-lg text-[var(--kt-road-grey)] leading-relaxed">
            A courier arrives, takes over the parcel and starts the next leg.
          </p>
        </div>
      </div>

      {/* Actor Anchors: Measured layout slots for persistent Van and Courier */}
      <div className="relative z-10 max-w-6xl mx-auto w-full flex flex-col sm:flex-row items-end justify-center gap-6 my-auto pt-12">
        <div data-actor-anchor="collection-van" className="w-full max-w-2xl min-h-[220px] sm:min-h-[300px] pointer-events-none" />
        <div data-actor-anchor="collection-courier" className="w-48 sm:w-56 -ml-12 sm:-ml-24 mb-2 min-h-[220px] pointer-events-none" />
      </div>
    </section>
  );
}
