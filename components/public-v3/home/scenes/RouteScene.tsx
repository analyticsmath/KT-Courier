"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

interface RouteSceneProps {
  className?: string;
}

/** Road geometry is the route composition; the director places and turns the top-down truck. */
export function RouteScene({ className = "" }: RouteSceneProps) {
  const aerialRoute = ktMediaV3.pages.homepage.routePlane;

  return (
    <section
      className={`kt-home-route relative min-h-[260vh] bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] overflow-hidden ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="route"
      aria-labelledby="route-heading"
      style={{ "--kt-home-budget": 260 } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-route-sticky">
        <div className="kt-aerial-road-underlay absolute inset-0 opacity-45 pointer-events-none">
          <Image src={aerialRoute.src} alt="" fill sizes="100vw" className="object-cover object-center contrast-125" />
          <div className="absolute inset-0 bg-[#080a0d]/60" />
        </div>

        <div className="kt-route-spine absolute inset-y-[-20%] left-1/2 w-[min(44vw,560px)] -translate-x-1/2 -rotate-[18deg] bg-[#252a2e] border-x border-white/10" aria-hidden="true">
          <div className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-white/25" />
          <div className="absolute inset-y-0 left-[15%] border-l border-white/10" />
          <div className="absolute inset-y-0 right-[15%] border-l border-white/10" />
        </div>

        <div className="relative z-10 w-full h-full max-w-7xl mx-auto px-8 md:px-16 py-24 flex flex-col justify-between pointer-events-none">
          <div data-motion="route-copy" className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--kt-concrete)] mb-4">Regional delivery route</p>
            <h2 id="route-heading" className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
              On the way.
            </h2>
            <p className="text-base sm:text-lg text-[var(--kt-freight-paper)]/80 leading-relaxed max-w-lg">
              Once a delivery is accepted, it moves from pickup toward its destination. Delivery status updates are available through customer and store accounts.
            </p>
          </div>
          <div className="flex justify-end">
            <p className="max-w-xs text-sm text-[var(--kt-freight-paper)]/70 border-t border-white/20 pt-4">
              Availability is confirmed from the pickup and drop-off details submitted with the request.
            </p>
          </div>
        </div>

        <div data-actor-anchor="route-truck" className="absolute left-1/2 top-1/2 w-1 h-1 pointer-events-none" aria-hidden="true" />
        <div
          data-motion="route-occluder"
          className="kt-route-overpass-shadow pointer-events-none absolute inset-x-0 h-[25vh] bg-gradient-to-b from-transparent via-[#090b0d] to-transparent opacity-0 z-25"
          aria-hidden="true"
        />
        <div className="kt-route-freight-overlap pointer-events-none absolute inset-0 bg-[#0B0D0F] opacity-0 z-20">
          <Image src={ktMediaV3.pages.homepage.freightClimax.background.src} alt="" fill sizes="100vw" className="object-cover brightness-50 opacity-30" />
        </div>
      </div>
    </section>
  );
}
