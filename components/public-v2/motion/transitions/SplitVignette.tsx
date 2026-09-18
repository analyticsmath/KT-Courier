"use client";

import { useState, useRef, type ReactNode } from "react";
import { useFinePointer } from "../useFinePointer";
import { usePublicMotionPreference } from "../usePublicMotionPreference";

interface SplitVignetteProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  initialSplitPercent?: number;
  className?: string;
}

export function SplitVignette({
  leftContent,
  rightContent,
  leftLabel = "ORIGIN / PREP",
  rightLabel = "TRANSIT / CUSTODY",
  initialSplitPercent = 50,
  className = "",
}: SplitVignetteProps) {
  const isFinePointer = useFinePointer();
  const { prefersReducedMotion } = usePublicMotionPreference();
  const [split, setSplit] = useState(initialSplitPercent);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isFinePointer || prefersReducedMotion) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const rawPercent = (x / rect.width) * 100;
    // Keep seam bounded within 25% - 75%
    const bounded = Math.max(25, Math.min(75, rawPercent));
    setSplit(bounded);
  };

  const handleMouseLeave = () => {
    if (!prefersReducedMotion) {
      setSplit(initialSplitPercent);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full overflow-hidden select-none ${className}`}
      data-split-vignette="true"
    >
      {/* Right side background (Custody / Transit) */}
      <div className="absolute inset-0 w-full h-full z-0">
        {rightContent}
        {rightLabel && (
          <div className="absolute bottom-4 right-4 z-20 px-2.5 py-1 bg-[#0E1012]/80 border border-[#D9DEE2]/20 text-[11px] font-mono tracking-widest text-[#F3F1EA] uppercase">
            {rightLabel}
          </div>
        )}
      </div>

      {/* Left side foreground with clip-path (Origin / Prep) */}
      <div
        className="absolute inset-0 w-full h-full z-10 overflow-hidden transition-[clip-path] duration-75 ease-out"
        style={{
          clipPath: `polygon(0 0, ${split}% 0, ${split}% 100%, 0 100%)`,
          WebkitClipPath: `polygon(0 0, ${split}% 0, ${split}% 100%, 0 100%)`,
        }}
      >
        {leftContent}
        {leftLabel && (
          <div className="absolute bottom-4 left-4 z-20 px-2.5 py-1 bg-[#0E1012]/80 border border-[#D9DEE2]/20 text-[11px] font-mono tracking-widest text-[#F3F1EA] uppercase">
            {leftLabel}
          </div>
        )}
      </div>

      {/* Vertical Seam Line */}
      <div
        className="absolute top-0 bottom-0 z-30 pointer-events-none w-[2px] bg-[#347CFB] shadow-[0_0_8px_#347CFB] transition-[left] duration-75 ease-out"
        style={{ left: `${split}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#0E1012] border border-[#347CFB] flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#347CFB]" />
        </div>
      </div>
    </div>
  );
}
