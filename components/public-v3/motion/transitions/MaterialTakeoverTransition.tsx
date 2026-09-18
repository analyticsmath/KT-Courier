"use client";

import { type ReactNode } from "react";

interface MaterialTakeoverTransitionProps {
  currentContent: ReactNode;
  takeoverContent: ReactNode;
  progress?: number; // 0 to 1
  className?: string;
}

/**
 * Material Takeover Transition Primitive.
 * An active physical actor surface (such as the truck trailer) expands across the viewport
 * to become the aperture/background for the incoming commerce world.
 */
export function MaterialTakeoverTransition({
  currentContent,
  takeoverContent,
  progress = 0,
  className = "",
}: MaterialTakeoverTransitionProps) {
  // Clamped progress between 0 and 1
  const p = Math.min(Math.max(progress, 0), 1);

  return (
    <div className={`kt-material-takeover-boundary relative w-full h-full overflow-hidden ${className}`}>
      {/* Background/Base content */}
      <div
        className="absolute inset-0 z-10"
        style={{
          transform: `scale(${1 - p * 0.05})`,
          opacity: 1 - p * 0.4,
        }}
      >
        {currentContent}
      </div>

      {/* Expanding aperture/takeover plane */}
      <div
        className="absolute inset-0 z-20 overflow-hidden"
        style={{
          clipPath: `inset(${(1 - p) * 15}% ${(1 - p) * 10}% ${(1 - p) * 15}% ${(1 - p) * 10}%)`,
          opacity: p > 0.05 ? 1 : 0,
        }}
      >
        {takeoverContent}
      </div>
    </div>
  );
}
