"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

interface RouteSceneProps {
  className?: string;
}

/**
 * Route & Aerial Highway Plane.
 * Real South African geographic aerial photography underlies the transport corridor.
 * Top-down freight truck traverses the road line; road counter-moves; turning states
 * provide smooth spatial continuity across regional transit networks.
 * Pure product truth without invented telemetry panels.
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
      <div className="w-full md:w-[42%] p-8 md:p-14 flex flex-col justify-center relative z-10">
        <h2
          id="route-heading"
          className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)] mb-4"
        >
          On the way.
        </h2>
        <p className="text-base sm:text-lg text-[var(--kt-graphite)] leading-relaxed mb-6">
          Once a delivery is accepted, it moves from pickup toward its destination. Delivery status updates are available through customer and store accounts.
        </p>
        <p className="text-xs sm:text-sm text-[var(--kt-graphite)] leading-relaxed border-t border-[var(--kt-concrete)]/50 pt-6">
          Availability is confirmed from the pickup and drop-off details submitted with the request.
        </p>
      </div>

      {/* Central/Right Road Field: Aerial Geographic Plane with Top-Down Truck Anchor */}
      <div className="kt-route-road-world relative bg-[var(--kt-asphalt)] flex-1 min-h-[420px] md:min-h-[580px] flex items-center justify-center border-t md:border-t-0 md:border-l border-[#23272B] overflow-hidden py-12">
        {/* Real Aerial Geographic Underlay */}
        <div className="kt-aerial-road-underlay absolute inset-0 opacity-40 pointer-events-none will-change-transform">
          <Image
            src={aerialRoute.src}
            alt={aerialRoute.alt}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover object-center filter contrast-125"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Physical lane markings */}
        <div
          className="kt-route-lane-markings absolute inset-y-0 w-0 border-r-2 border-dashed border-[#CDC4B5]/30 left-1/2 -translate-x-1/2 pointer-events-none z-5 will-change-transform"
          aria-hidden="true"
        />

        {/* Anchor geometry for persistent top-down truck */}
        <div
          data-actor-anchor="route-truck"
          className="relative z-10 w-64 sm:w-80 md:w-96 min-h-[140px] flex items-center justify-center transform md:rotate-90 pointer-events-none"
        />

        {/* Foreground Overpass Shadow Plane for concealed truck rotation (0.62–0.82) */}
        <div
          className="kt-route-overpass-shadow pointer-events-none absolute inset-x-0 h-48 bg-gradient-to-b from-transparent via-[#0B0D0F]/95 to-transparent z-25 opacity-0 will-change-transform"
          aria-hidden="true"
        />

        {/* Industrial / Freight Overlap Plane entering 0.80–1.00 */}
        <div
          className="kt-route-freight-overlap pointer-events-none absolute inset-0 bg-[#0B0D0F] opacity-0 z-20"
          aria-hidden="true"
        >
          <Image
            src={ktMediaV3.pages.homepage.freightClimax.background.src}
            alt=""
            fill
            sizes="100vw"
            className="object-cover filter contrast-125 brightness-75 opacity-30"
          />
        </div>
      </div>
    </section>
  );
}
