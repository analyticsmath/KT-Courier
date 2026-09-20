"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { KTMediaV3Asset } from "../../media/kt-media-v3";

interface ServiceStickyMediaProps {
  media: KTMediaV3Asset[];
  activeIndex?: number;
  className?: string;
  aspectRatio?: string;
  overlayGradient?: boolean;
}

/**
 * ServiceStickyMedia (client motion primitive).
 * Pins/holds media stage while narrative chapters advance.
 * Smoothly transitions between images or shifts crops without teleporting.
 */
export function ServiceStickyMedia({
  media,
  activeIndex = 0,
  className = "",
  aspectRatio = "aspect-[4/3]",
  overlayGradient = true,
}: ServiceStickyMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIdx, setCurrentIdx] = useState(activeIndex);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);

  if (activeIndex !== currentIdx && activeIndex >= 0 && activeIndex < media.length) {
    setPrevIdx(currentIdx);
    setCurrentIdx(activeIndex);
  }

  useEffect(() => {
    if (prevIdx !== null) {
      const timer = setTimeout(() => {
        setPrevIdx(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [prevIdx]);

  const activeAsset = media[currentIdx] || media[0];
  const prevAsset = prevIdx !== null ? media[prevIdx] : null;

  if (!activeAsset) return null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${aspectRatio} bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/40 overflow-hidden ${className}`}
    >
      {/* Previous outgoing media */}
      {prevAsset && (
        <div
          key={`prev-${prevAsset.src}`}
          className="absolute inset-0 transition-opacity duration-500 ease-out z-0 opacity-0 pointer-events-none"
        >
          <Image
            src={prevAsset.src}
            alt={prevAsset.alt}
            fill
            sizes="(max-width: 1023px) 100vw, 50vw"
            className="object-cover"
            style={{
              objectPosition: `${prevAsset.focalPoint[0] * 100}% ${prevAsset.focalPoint[1] * 100}%`,
            }}
          />
        </div>
      )}

      {/* Current active incoming media */}
      <div
        key={`curr-${activeAsset.src}`}
        className="absolute inset-0 transition-opacity duration-500 ease-out z-1 opacity-100"
      >
        <Image
          src={activeAsset.src}
          alt={activeAsset.alt}
          fill
          priority
          sizes="(max-width: 1023px) 100vw, 50vw"
          className="object-cover transition-transform duration-1000 ease-out scale-100"
          style={{
            objectPosition: `${activeAsset.focalPoint[0] * 100}% ${activeAsset.focalPoint[1] * 100}%`,
          }}
        />
      </div>

      {overlayGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none z-2" />
      )}
    </div>
  );
}
