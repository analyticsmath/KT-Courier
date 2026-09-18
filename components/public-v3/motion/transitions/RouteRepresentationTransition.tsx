"use client";

import { type ReactNode } from "react";

interface RouteRepresentationTransitionProps {
  roadContent: ReactNode;
  infoLeft?: ReactNode;
  infoRight?: ReactNode;
  roadWidthPercent?: number; // default ~25-30%
  className?: string;
}

/**
 * Route Representation Transition.
 * Dark asphalt road acts as an architectural separator dividing verified information planes.
 * Subtle dashed lane markings; strictly zero neon glowing lines or sci-fi telemetry.
 */
export function RouteRepresentationTransition({
  roadContent,
  infoLeft,
  infoRight,
  roadWidthPercent = 28,
  className = "",
}: RouteRepresentationTransitionProps) {
  return (
    <div
      className={`kt-route-representation-boundary relative w-full min-h-[700px] flex flex-col md:flex-row items-stretch bg-[var(--kt-freight-paper)] overflow-hidden ${className}`}
    >
      {/* Left Information Plane */}
      <div className="flex-1 p-6 md:p-12 z-10 flex flex-col justify-center">
        {infoLeft}
      </div>

      {/* Central Asphalt Road Separator */}
      <div
        className="relative bg-[var(--kt-asphalt)] flex items-center justify-center overflow-hidden py-12 md:py-0 border-x border-[#23272B]"
        style={{
          flexBasis: `${roadWidthPercent}%`,
          minWidth: "260px",
        }}
      >
        {/* Subtle physical lane markings */}
        <div
          className="absolute inset-y-0 w-0 border-r-2 border-dashed border-[#D1CEC6]/30 left-1/2 -translate-x-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 w-full flex items-center justify-center">
          {roadContent}
        </div>
      </div>

      {/* Right Information Plane */}
      <div className="flex-1 p-6 md:p-12 z-10 flex flex-col justify-center">
        {infoRight}
      </div>
    </div>
  );
}
