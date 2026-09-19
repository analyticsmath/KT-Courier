"use client";

import Link from "next/link";
import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

interface FreightSceneProps {
  className?: string;
}

/**
 * Chapter 09 — Freight & Heavy Haulage Climax.
 * Real warehouse, forklift, and line-haul distribution terminal photography behind
 * the dominant Red Freight Truck actor.
 * Industrial scale is communicated through physical vehicle mass.
 * Color discipline: Red is supplied exclusively by the truck body and trailer curtain.
 */
export function FreightScene({ className = "" }: FreightSceneProps) {
  const warehouseBg = ktMediaV3.pages.homepage.freightClimax.background;

  return (
    <section
      className={`relative min-h-[96vh] flex flex-col justify-between bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] py-16 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="freight"
      data-motion="freight-world"
      aria-labelledby="freight-heading"
    >
      {/* Industrial Warehouse & Terminal Atmosphere */}
      <div className="kt-freight-warehouse-env absolute inset-0 opacity-25 pointer-events-none z-0 will-change-transform">
        <Image
          src={warehouseBg.src}
          alt={warehouseBg.alt}
          fill
          sizes="100vw"
          className="object-cover object-center filter contrast-125 brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)] via-[var(--kt-asphalt)]/70 to-[var(--kt-asphalt)]" />
      </div>

      {/* Top Narrative Framing */}
      <div className="max-w-4xl mx-auto text-center pt-8 relative z-10">
        <h2
          id="freight-heading"
          className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-4 text-white"
        >
          Built for more than small parcels.
        </h2>
        <p className="text-base sm:text-xl text-[var(--kt-concrete)] max-w-2xl mx-auto leading-relaxed">
          Palletized cargo, line-haul corridors, and dedicated fleet capacity across South Africa.
        </p>
      </div>

      {/* Hero Actor Anchor: Centered Red Freight Truck */}
      <div
        data-actor-anchor="freight-truck"
        className="relative z-10 w-full max-w-5xl mx-auto my-auto px-4 min-h-[240px] sm:min-h-[360px] pointer-events-none flex items-center justify-center"
      />

      {/* Bottom Action & Scope */}
      <div className="max-w-xl mx-auto text-center pb-6 relative z-10">
        <Link
          href="/services/freight"
          className="kt-action-filled px-8 py-3.5 inline-flex items-center justify-center font-bold text-xs uppercase tracking-wider !bg-[var(--kt-freight-paper)] !text-[var(--kt-asphalt)] hover:!bg-white"
        >
          View freight &rarr;
        </Link>
      </div>
    </section>
  );
}
