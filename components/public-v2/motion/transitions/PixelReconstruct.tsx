"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePublicMotionPreference } from "../usePublicMotionPreference";

interface PixelReconstructProps {
  children: ReactNode;
  active?: boolean;
  pixelSize?: number;
  durationMs?: number;
  className?: string;
}

export function PixelReconstruct({
  children,
  active = true,
  pixelSize = 8,
  durationMs = 600,
  className = "",
}: PixelReconstructProps) {
  const { prefersReducedMotion } = usePublicMotionPreference();
  const [phase, setPhase] = useState<"pixelating" | "resolved">("pixelating");
  const effectivePhase = prefersReducedMotion ? "resolved" : phase;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion || !active) return;

    const frame = requestAnimationFrame(() => {
      setPhase("pixelating");
    });
    const timer = setTimeout(() => {
      setPhase("resolved");
    }, durationMs);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [active, durationMs, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      data-pixel-reconstruct-phase={effectivePhase}
    >
      <div
        className="transition-all duration-300"
        style={{
          filter: effectivePhase === "pixelating" ? `url(#kt-pixel-filter)` : "none",
          opacity: effectivePhase === "pixelating" ? 0.85 : 1,
        }}
      >
        {children}
      </div>

      {/* SVG Pixelation Matrix Filter */}
      <svg
        className="absolute w-0 h-0 pointer-events-none opacity-0"
        aria-hidden="true"
      >
        <defs>
          <filter id="kt-pixel-filter" x="0%" y="0%" width="100%" height="100%">
            <feFlood x="2" y="2" height="1" width="1" />
            <feComposite width={pixelSize} height={pixelSize} />
            <feTile result="a" />
            <feComposite in="SourceGraphic" in2="a" operator="in" />
            <feMorphology operator="dilate" radius="0.5" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
