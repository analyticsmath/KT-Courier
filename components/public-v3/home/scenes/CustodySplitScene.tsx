"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

interface CustodySplitSceneProps {
  className?: string;
}

/**
 * Chapter 07 — Custody Split Vignette.
 * The physical seam between merchant preparation and courier transit.
 * Dual real documentary photographs: Merchant counter vs Courier digital manifest.
 * Zero HUD labels, zero neon lines — only authentic photographic territory split.
 */
export function CustodySplitScene({ className = "" }: CustodySplitSceneProps) {
  const merchantSide = ktMediaV3.pages.homepage.custodySplit.merchantSide;
  const courierSide = ktMediaV3.pages.homepage.custodySplit.courierSide;

  return (
    <section
      className={`kt-custody-split-section relative min-h-[85vh] flex items-stretch bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] overflow-hidden ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="custody"
      aria-label="Custody Transfer"
    >
      {/* Left: Merchant Origin World */}
      <div className="kt-custody-left relative w-1/2 min-h-full overflow-hidden border-r border-[#23272B] transition-all duration-700 ease-out">
        <Image
          src={merchantSide.src}
          alt={merchantSide.alt}
          fill
          sizes="50vw"
          className="object-cover filter contrast-105"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Right: Courier Transit World */}
      <div className="kt-custody-right relative w-1/2 min-h-full overflow-hidden transition-all duration-700 ease-out">
        <Image
          src={courierSide.src}
          alt={courierSide.alt}
          fill
          sizes="50vw"
          className="object-cover filter contrast-105"
        />
        <div className="absolute inset-0 bg-black/25" />
      </div>

      {/* Center Actor Anchor: Courier with Parcel bridging the physical seam */}
      <div
        data-actor-anchor="custody-courier"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-64 sm:w-80 min-h-[300px] pointer-events-none"
      />
    </section>
  );
}
