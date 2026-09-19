"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

interface RouteSceneProps {
  className?: string;
}

/**
 * Chapter 08 — Route & Aerial Highway Plane.
 * Real South African geographic aerial photography underlies the transport corridor.
 * Top-down freight truck traverses the road line; road counter-moves; turning states
 * provide smooth spatial continuity across regional transit networks.
 */
export function RouteScene({ className = "" }: RouteSceneProps) {
  const aerialRoute = ktMediaV3.pages.homepage.routePlane;

  return (
    <section
      className={`relative min-h-[90vh] bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] flex flex-col md:flex-row items-stretch border-y border-[var(--kt-concrete)]/40 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="route"
      aria-labelledby="route-heading"
    >
      {/* Left Information Plane: Factual Route Narrative */}
      <div className="flex-1 p-8 md:p-14 flex flex-col justify-center relative z-10">
        <span className="text-xs uppercase font-mono tracking-widest text-[var(--kt-graphite)] mb-3 block">
          Chapter 08 &bull; Transit Corridor
        </span>
        <h2
          id="route-heading"
          className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)] mb-4"
        >
          On the way.
        </h2>
        <p className="text-base sm:text-lg text-[var(--kt-graphite)] leading-relaxed mb-6 max-w-md">
          Once a delivery is accepted, the route enters regional transit. Real road geometry guides line-haul movement between hubs.
        </p>
        <p className="text-xs sm:text-sm text-[var(--kt-graphite)] leading-relaxed max-w-md border-t border-[var(--kt-concrete)]/50 pt-6">
          Corridor routing is confirmed from verified pickup and delivery addresses submitted at booking.
        </p>
      </div>

      {/* Central Road Field: Aerial Geographic Plane with Top-Down Truck Anchor */}
      <div className="relative bg-[var(--kt-asphalt)] flex-1 min-h-[420px] md:min-h-[580px] flex items-center justify-center border-y md:border-y-0 md:border-x border-[#23272B] overflow-hidden py-12">
        {/* Real Aerial Geographic Underlay */}
        <div className="kt-aerial-road-underlay absolute inset-0 opacity-40 pointer-events-none">
          <Image
            src={aerialRoute.src}
            alt={aerialRoute.alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-center filter contrast-125"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Physical lane markings */}
        <div
          className="absolute inset-y-0 w-0 border-r-2 border-dashed border-[#CDC4B5]/30 left-1/2 -translate-x-1/2 pointer-events-none z-5"
          aria-hidden="true"
        />

        {/* Anchor geometry for persistent top-down truck */}
        <div
          data-actor-anchor="route-truck"
          className="relative z-10 w-64 sm:w-80 md:w-96 min-h-[140px] flex items-center justify-center transform md:rotate-90 pointer-events-none"
        />
      </div>

      {/* Right Information Plane: Operational Reality */}
      <div className="flex-1 p-8 md:p-14 flex flex-col justify-center bg-[var(--kt-freight-paper)] relative z-10">
        <h3 className="font-display text-2xl font-bold tracking-tight mb-3">
          Route Tracking & Custody
        </h3>
        <p className="text-sm text-[var(--kt-graphite)] leading-relaxed mb-6">
          Every vehicle is tracked against its assigned route corridor across Gauteng and major national highways.
        </p>
        <div className="border-t border-[var(--kt-concrete)]/50 pt-6 text-xs text-[var(--kt-graphite)] leading-relaxed font-mono">
          STATUS VERIFIED &bull; TRANSIT TIME MONITORED &bull; CARGO SEALED
        </div>
      </div>
    </section>
  );
}
