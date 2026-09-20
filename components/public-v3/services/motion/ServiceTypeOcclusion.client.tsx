"use client";

import { useEffect, useRef } from "react";

interface ServiceTypeOcclusionProps {
  word: string;
  className?: string;
  foregroundElement?: React.ReactNode;
  rate?: number;
}

/**
 * ServiceTypeOcclusion (client motion primitive).
 * Renders monumental low-contrast type in the background depth plane
 * that moves at a measured rate and is occluded by foreground actors/media.
 */
export function ServiceTypeOcclusion({
  word,
  className = "",
  foregroundElement,
  rate = 0.2,
}: ServiceTypeOcclusionProps) {
  const typeRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId: number;
    const handleScroll = () => {
      const el = typeRef.current;
      const wrap = wrapperRef.current;
      if (!el || !wrap) return;

      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return;

      const deltaY = (rect.top - vh * 0.5) * rate;
      el.style.transform = `translateX(${(-deltaY * 0.3).toFixed(1)}px)`;
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [rate]);

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden pt-4 pb-2 select-none border-b border-[var(--kt-concrete)]/40 ${className}`}
    >
      {/* Background Monumental Type */}
      <div
        ref={typeRef}
        aria-hidden="true"
        className="font-display text-[clamp(5rem,18vw,15rem)] font-black tracking-tighter leading-none text-[var(--kt-concrete)]/50 uppercase pointer-events-none will-change-transform"
      >
        {word}
      </div>

      {/* Foreground Occluding Element (Protagonist or Media crossing baseline) */}
      {foregroundElement && (
        <div className="relative z-10 -mt-14 sm:-mt-24 md:-mt-36 lg:-mt-44 pointer-events-none">
          {foregroundElement}
        </div>
      )}
    </div>
  );
}
