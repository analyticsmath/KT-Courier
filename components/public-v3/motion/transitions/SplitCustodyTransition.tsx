"use client";

import { type ReactNode } from "react";

interface SplitCustodyTransitionProps {
  merchantWorld: ReactNode;
  courierWorld: ReactNode;
  parcelElement: ReactNode;
  splitRatio?: number; // 0.7 = 70% merchant, 0.5 = 50/50, 0.1 = 90% courier
  className?: string;
}

/**
 * Split Custody Transition Primitive.
 * Two physical environments exchange territory as custody shifts from merchant to courier.
 * The parcel visibly bridges the physical seam.
 * Strictly no glowing borders, no interactive slider handles, no blue dividers.
 */
export function SplitCustodyTransition({
  merchantWorld,
  courierWorld,
  parcelElement,
  splitRatio = 0.5,
  className = "",
}: SplitCustodyTransitionProps) {
  // Clamped ratio between 0.1 and 0.9
  const ratio = Math.min(Math.max(splitRatio, 0.1), 0.9);
  const percentage = ratio * 100;

  return (
    <div
      className={`kt-split-custody-boundary relative w-full h-full min-h-[600px] overflow-hidden ${className}`}
    >
      {/* Merchant Territory (Left) */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      >
        <div className="w-[100vw] h-full relative">{merchantWorld}</div>
      </div>

      {/* Courier Territory (Right) */}
      <div
        className="absolute inset-y-0 right-0 overflow-hidden transition-[width] duration-300 ease-out"
        style={{ width: `${100 - percentage}%` }}
      >
        <div className="w-[100vw] h-full relative -translate-x-[calc(100vw-${100 - percentage}%)]">
          {courierWorld}
        </div>
      </div>

      {/* Physical Parcel Seam Bridging The Boundary */}
      <div
        className="absolute top-1/2 -translate-y-1/2 z-30 transition-[left] duration-300 ease-out"
        style={{ left: `calc(${percentage}% - 140px)` }}
      >
        {parcelElement}
      </div>
    </div>
  );
}
