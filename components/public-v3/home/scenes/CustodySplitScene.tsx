"use client";

import Image from "next/image";

interface CustodySplitSceneProps {
  className?: string;
}

/**
 * Scene 06 — Custody Split Vignette.
 * The physical seam between merchant preparation and courier transit.
 * Strictly no artificial sliders, glowing lines, or neon edges.
 */
export function CustodySplitScene({ className = "" }: CustodySplitSceneProps) {
  return (
    <section
      className={`relative min-h-[80vh] flex items-stretch bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] overflow-hidden ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="custody"
      aria-label="Custody Transfer"
    >
      {/* Left: Origin World (Local Store / Merchant) */}
      <div className="relative w-1/2 min-h-full overflow-hidden border-r border-[#23272B]">
        <Image
          src="/media/public/images/jhb-rosebank-market-interaction.webp"
          alt="Local merchant staging packaged goods"
          fill
          sizes="50vw"
          className="object-cover grayscale-[30%]"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-8 left-8 z-10">
          <span className="text-xs font-mono font-medium tracking-wider uppercase opacity-75">
            ORIGIN · MERCHANT HANDOFF
          </span>
        </div>
      </div>

      {/* Right: Courier Transit World */}
      <div className="relative w-1/2 min-h-full overflow-hidden">
        <Image
          src="/images/kt-couriers/provisional/r2/documentary/r2-doc-03-pickup.webp"
          alt="Courier taking over parcel custody"
          fill
          sizes="50vw"
          className="object-cover grayscale-[10%]"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-8 right-8 z-10 text-right">
          <span className="text-xs font-mono font-medium tracking-wider uppercase opacity-75">
            TRANSIT · CONFIRMED ROUTE
          </span>
        </div>
      </div>

      {/* Center Actor Anchor: Courier with Parcel bridging the physical seam */}
      <div
        data-actor-anchor="custody-courier"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-64 sm:w-80 min-h-[300px] pointer-events-none"
      />
    </section>
  );
}
