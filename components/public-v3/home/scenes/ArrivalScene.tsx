"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

interface ArrivalSceneProps {
  className?: string;
}

/**
 * Chapter 10 — Arrival & Physical Handoff.
 * Heavy mechanical scale drops quickly to a quiet, human doorstep delivery.
 * Real doorstep documentary photography establishes the destination environment
 * behind the persistent Courier actor.
 */
export function ArrivalScene({ className = "" }: ArrivalSceneProps) {
  const doorstepBg = ktMediaV3.pages.homepage.arrival.background;

  return (
    <section
      className={`relative min-h-[88vh] flex items-center justify-center bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-20 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="arrival"
      data-motion="arrival-world"
      aria-labelledby="arrival-heading"
      style={{ "--kt-home-budget": 155 } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-arrival-sticky">
      {/* Real Doorstep Documentary Backdrop */}
      <div className="absolute inset-0 opacity-15 pointer-events-none z-0">
        <Image
          src={doorstepBg.src}
          alt={doorstepBg.alt}
          fill
          sizes="100vw"
          className="object-cover object-center filter grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--kt-freight-paper)] via-[var(--kt-freight-paper)]/85 to-[var(--kt-freight-paper)]" />
      </div>

      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
        {/* Narrative Statement */}
        <div className="space-y-6 order-2 md:order-1">
          <h2
            id="arrival-heading"
            className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--kt-asphalt)]"
          >
            Delivered.
          </h2>
          <p className="text-lg sm:text-xl text-[var(--kt-graphite)] max-w-md leading-relaxed">
            The journey finishes at the destination.
          </p>
        </div>

        {/* Courier Anchor geometry for persistent Courier actor */}
        <div className="flex justify-center items-center order-1 md:order-2">
          <div
            data-actor-anchor="arrival-courier"
            className="w-64 sm:w-80 lg:w-96 min-h-[320px] flex items-center justify-center pointer-events-none"
          />
        </div>
      </div>
      </div>
    </section>
  );
}
