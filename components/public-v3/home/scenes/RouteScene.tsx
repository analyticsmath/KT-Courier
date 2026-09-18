"use client";

import { WhiteTruckActor } from "../../actors/WhiteTruckActor";

interface RouteSceneProps {
  className?: string;
}

/**
 * Scene 07 & 08 — Route & Road as Information Architecture.
 * Dark asphalt road field acts as an architectural separator dividing verified service details.
 * Features top-down vehicle continuity with subtle physical dashed lane markings.
 */
export function RouteScene({ className = "" }: RouteSceneProps) {
  return (
    <section
      className={`relative min-h-[90vh] bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] flex flex-col md:flex-row items-stretch border-y border-[var(--kt-concrete)]/40 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="route"
      aria-labelledby="route-heading"
    >
      {/* Left Information Plane: Verified Routing Factors */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-center">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--kt-road-grey)] block mb-3">
          Stage 03 · Transit
        </span>
        <h2
          id="route-heading"
          className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)] mb-4"
        >
          On the way.
        </h2>
        <p className="text-lg text-[var(--kt-road-grey)] leading-relaxed mb-8 max-w-md">
          From pickup to drop-off, each delivery follows the route confirmed for the request.
        </p>

        <div className="space-y-4 text-sm border-t border-[var(--kt-concrete)]/40 pt-6 max-w-md">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--kt-asphalt)]">
              Confirmed Routing
            </h4>
            <p className="text-[var(--kt-road-grey)] mt-1">
              Dispatch coordinates and timing are validated before vehicle departure.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--kt-asphalt)]">
              Regional Coverage
            </h4>
            <p className="text-[var(--kt-road-grey)] mt-1">
              Connecting local hubs across verified commercial and residential districts.
            </p>
          </div>
        </div>
      </div>

      {/* Central Road Field: Dark Asphalt with Top-Down Truck Actor */}
      <div className="relative bg-[var(--kt-asphalt)] flex-1 min-h-[380px] md:min-h-[600px] flex items-center justify-center border-y md:border-y-0 md:border-x border-[#23272B] overflow-hidden py-12">
        {/* Subtle physical lane markings */}
        <div
          className="absolute inset-y-0 w-0 border-r-2 border-dashed border-[#D1CEC6]/25 left-1/2 -translate-x-1/2 pointer-events-none"
          aria-hidden="true"
        />

        {/* Overhead White Truck */}
        <div className="relative z-10 w-64 sm:w-80 md:w-96 transform md:rotate-90">
          <WhiteTruckActor stateId="top-down-straight" />
        </div>

        <div className="absolute bottom-4 text-center w-full z-20 pointer-events-none">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#D1CEC6]/60">
            CONFIRMED TRANSIT CORRIDOR
          </span>
        </div>
      </div>

      {/* Right Information Plane: Operational Reality Notice */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-[var(--kt-freight-paper)]">
        <h3 className="font-display text-2xl font-bold tracking-tight mb-3">
          Verified Service Hubs
        </h3>
        <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed mb-6">
          Deliveries connect across active South African zones with validated collection points.
        </p>

        <ul className="space-y-3 font-mono text-xs text-[var(--kt-asphalt)] border-t border-[var(--kt-concrete)]/40 pt-6">
          <li className="flex items-center justify-between">
            <span>GAUTENG CENTRAL</span>
            <span className="text-[var(--kt-road-grey)]">ACTIVE</span>
          </li>
          <li className="flex items-center justify-between">
            <span>WESTERN CAPE METRO</span>
            <span className="text-[var(--kt-road-grey)]">ACTIVE</span>
          </li>
          <li className="flex items-center justify-between">
            <span>KWAZULU-NATAL COASTAL</span>
            <span className="text-[var(--kt-road-grey)]">CONFIRMED</span>
          </li>
        </ul>

        <p className="mt-8 text-xs text-[var(--kt-road-grey)] leading-normal">
          Status updates are confirmed through customer and merchant order dashboards.
        </p>
      </div>
    </section>
  );
}
