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
        <svg
          aria-hidden="true"
          className="kt-route-path-plane absolute inset-0 z-[1] h-full w-full pointer-events-none"
          viewBox="0 0 1000 800"
          preserveAspectRatio="none"
        >
          <path
            data-route-path
            d="M -40 610 C 110 680 190 520 330 500 C 470 480 455 360 520 270 C 595 165 730 175 1040 120"
            fill="none"
            stroke="#292e32"
            strokeWidth="300"
            strokeLinecap="round"
          />
          <path
            d="M -40 610 C 110 680 190 520 330 500 C 470 480 455 360 520 270 C 595 165 730 175 1040 120"
            fill="none"
            stroke="rgba(255,255,255,.4)"
            strokeWidth="5"
            strokeDasharray="22 20"
            strokeLinecap="round"
          />
        </svg>
        <div className="kt-aerial-road-underlay absolute inset-0 z-0 opacity-45 pointer-events-none">
          <Image src={aerialRoute.src} alt="" fill sizes="100vw" className="object-cover object-center contrast-125" />
          <div className="absolute inset-0 bg-[#080a0d]/60" />
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
      </div>
    </section>
  );
}
