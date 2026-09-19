"use client";


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
      className={`relative min-h-[85vh] bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] flex flex-col md:flex-row items-stretch border-y border-[var(--kt-concrete)]/40 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="route"
      aria-labelledby="route-heading"
    >
      {/* Left Information Plane: Factual Route Narrative */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-center">
        <h2
          id="route-heading"
          className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--kt-asphalt)] mb-4"
        >
          On the way.
        </h2>
        <p className="text-lg text-[var(--kt-road-grey)] leading-relaxed mb-6 max-w-md">
          Once a delivery is accepted, the route becomes part of the journey. Status updates remain available from the customer or store account.
        </p>
        <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed max-w-md border-t border-[var(--kt-concrete)]/40 pt-6">
          Availability is confirmed from the pickup and drop-off details submitted with the request.
        </p>
      </div>

      {/* Central Road Field: Dark Asphalt with Road Anchor */}
      <div className="relative bg-[var(--kt-asphalt)] flex-1 min-h-[380px] md:min-h-[560px] flex items-center justify-center border-y md:border-y-0 md:border-x border-[#23272B] overflow-hidden py-12">
        {/* Subtle physical lane markings */}
        <div
          className="absolute inset-y-0 w-0 border-r-2 border-dashed border-[#D1CEC6]/25 left-1/2 -translate-x-1/2 pointer-events-none"
          aria-hidden="true"
        />

        {/* Anchor geometry for persistent top-down truck */}
        <div
          data-actor-anchor="route-truck"
          className="relative z-10 w-64 sm:w-80 md:w-96 min-h-[140px] flex items-center justify-center transform md:rotate-90 pointer-events-none"
        />
      </div>

      {/* Right Information Plane: Delivery Reality */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-[var(--kt-freight-paper)]">
        <h3 className="font-display text-2xl font-bold tracking-tight mb-3">
          Route & Status Updates
        </h3>
        <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed mb-6">
          Each route is determined by the specific pickup, delivery, and parcel requirements of the active booking.
        </p>
        <div className="border-t border-[var(--kt-concrete)]/40 pt-6 text-xs text-[var(--kt-road-grey)] leading-relaxed">
          Real-time status updates are provided directly through customer order tracking and merchant dispatch accounts.
        </div>
      </div>
    </section>
  );
}
