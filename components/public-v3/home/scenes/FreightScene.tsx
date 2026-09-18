"use client";

import Link from "next/link";
import { RedTruckActor } from "../../actors/RedTruckActor";

interface FreightSceneProps {
  className?: string;
}

/**
 * Scene 09 — Network / Freight Climax.
 * Red freight truck commands the center plane for heavy haulage and scheduled transit.
 * Color discipline: Red is supplied exclusively by the truck body, keeping UI architecture calm.
 */
export function FreightScene({ className = "" }: FreightSceneProps) {
  return (
    <section
      className={`relative min-h-[95vh] flex flex-col justify-between bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] py-16 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="freight"
      aria-labelledby="freight-heading"
    >
      {/* Top Narrative Framing */}
      <div className="max-w-4xl mx-auto text-center pt-8">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--kt-road-grey)] block mb-3">
          Heavy Freight & Planned Transport
        </span>
        <h2
          id="freight-heading"
          className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-4 text-white"
        >
          Built for more than small parcels.
        </h2>
        <p className="text-base sm:text-xl text-[var(--kt-concrete)] max-w-2xl mx-auto leading-relaxed">
          For larger or planned movement, the details are reviewed before the job is confirmed.
        </p>
      </div>

      {/* Hero Actor: Centered Red Freight Truck */}
      <div className="relative z-10 w-full max-w-5xl mx-auto my-auto px-4">
        <RedTruckActor stateId="centered-hero" />
      </div>

      {/* Bottom Action & Scope */}
      <div className="max-w-xl mx-auto text-center pb-6">
        <Link
          href="/services/freight"
          className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-[var(--kt-asphalt)] font-bold text-xs uppercase tracking-wider hover:bg-[var(--kt-concrete)] transition-colors"
        >
          Explore Freight & Bulk Haulage
        </Link>
      </div>
    </section>
  );
}
