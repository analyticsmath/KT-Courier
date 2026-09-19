"use client";

interface ArrivalSceneProps {
  className?: string;
}

/**
 * Scene — Arrival & Physical Handoff.
 * Mechanical world intensity drops quickly to a quiet, human doorstep delivery.
 * Clean physical handoff without artificial OTP or fake verification badges.
 */
export function ArrivalScene({ className = "" }: ArrivalSceneProps) {
  return (
    <section
      className={`relative min-h-[85vh] flex items-center justify-center bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-20 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="arrival"
      aria-labelledby="arrival-heading"
    >
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Narrative Statement */}
        <div className="space-y-6 order-2 md:order-1">
          <h2
            id="arrival-heading"
            className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--kt-asphalt)]"
          >
            Delivered.
          </h2>
          <p className="text-lg sm:text-xl text-[var(--kt-road-grey)] max-w-md leading-relaxed">
            The journey ends where it should — with a clear handoff.
          </p>
          <div className="pt-4 border-t border-[var(--kt-concrete)]/50 text-sm text-[var(--kt-road-grey)]">
            Reliable doorstep handovers confirmed cleanly between courier and recipient.
          </div>
        </div>

        {/* Courier Anchor geometry for persistent Courier actor */}
        <div className="flex justify-center items-center order-1 md:order-2">
          <div data-actor-anchor="arrival-courier" className="w-64 sm:w-80 lg:w-96 min-h-[300px] flex items-center justify-center pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
