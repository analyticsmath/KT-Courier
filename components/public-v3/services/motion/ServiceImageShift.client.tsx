"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { KTMediaV3Asset } from "../../media/kt-media-v3";

interface ServiceImageShiftProps {
  asset: KTMediaV3Asset;
  aspectRatio?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * ServiceImageShift (client motion primitive).
 * Subtle documentary crop drift and parallax (1–3%) driven by scroll.
 * Strictly avoids generic hover zoom scale(1.05).
 */
export function ServiceImageShift({
  asset,
  aspectRatio = "aspect-[16/10]",
  className = "",
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
}: ServiceImageShiftProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId: number;
    const handleScroll = () => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img) return;

      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return;

      const progress = (vh - rect.top) / (vh + rect.height);
      const shiftPercent = (progress - 0.5) * 4; // -2% to +2% shift
      img.style.transform = `translateY(${shiftPercent.toFixed(2)}%) scale(1.03)`;
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
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${aspectRatio} bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/40 overflow-hidden ${className}`}
    >
      <Image
        ref={imgRef}
        src={asset.src}
        alt={asset.alt}
        fill
        preload={priority}
        sizes={sizes}
        className="object-cover will-change-transform"
        style={{
          objectPosition: `${asset.focalPoint[0] * 100}% ${asset.focalPoint[1] * 100}%`,
          transform: "scale(1.03)",
          transition: "transform 0.1s ease-out",
        }}
      />
    </div>
  );
}
