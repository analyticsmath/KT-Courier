"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { KTMediaV3Asset } from "../../media/kt-media-v3";

export interface HorizontalMediaItem {
  asset: KTMediaV3Asset;
  title: string;
  tag?: string;
  description?: string;
}

interface ServiceHorizontalMediaProps {
  items: HorizontalMediaItem[];
  className?: string;
}

/**
 * ServiceHorizontalMedia (client motion primitive).
 * Creates a physical horizontal media shelf / corridor.
 * Allows smooth horizontal drag/touch while preserving vertical page scroll.
 */
export function ServiceHorizontalMedia({
  items,
  className = "",
}: ServiceHorizontalMediaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 24 : 320;
    const current = Math.round(el.scrollLeft / cardWidth);
    setActiveIdx(Math.max(0, Math.min(items.length - 1, current)));
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-6 overflow-x-auto pb-6 pt-2 snap-x snap-mandatory scrollbar-none overscroll-x-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item, idx) => {
          const isActive = idx === activeIdx;

          return (
            <div
              key={idx}
              className={`relative w-[280px] sm:w-[360px] shrink-0 snap-start bg-[var(--kt-concrete)]/20 border transition-colors duration-300 overflow-hidden ${
                isActive ? "border-[var(--kt-asphalt)]" : "border-[var(--kt-concrete)]/60"
              }`}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <Image
                  src={item.asset.src}
                  alt={item.asset.alt}
                  fill
                  sizes="(max-width: 640px) 280px, 360px"
                  className="object-cover"
                  style={{
                    objectPosition: `${item.asset.focalPoint[0] * 100}% ${item.asset.focalPoint[1] * 100}%`,
                  }}
                />
                {item.tag && (
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider">
                    {item.tag}
                  </div>
                )}
              </div>
              <div className="p-4 bg-[var(--kt-freight-paper)] border-t border-[var(--kt-concrete)]/40">
                <h4 className="font-display text-base font-bold text-[var(--kt-asphalt)]">
                  {item.title}
                </h4>
                {item.description && (
                  <p className="text-xs text-[var(--kt-road-grey)] mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
