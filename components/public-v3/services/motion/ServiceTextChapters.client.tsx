"use client";

import { useEffect, useRef } from "react";

export interface ServiceChapterItem {
  id: string;
  stepNumber: string;
  title: string;
  description: string;
  badge?: string;
}

interface ServiceTextChaptersProps {
  chapters: ServiceChapterItem[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  className?: string;
}

/**
 * ServiceTextChapters (client motion primitive).
 * Replaces static 3-column process steps with moving narrative chapters.
 * Text lights up on active chapter, smoothly dimming inactive ones.
 */
export function ServiceTextChapters({
  chapters,
  activeIndex = 0,
  onActiveIndexChange,
  className = "",
}: ServiceTextChaptersProps) {
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = Number(entry.target.getAttribute("data-chapter-index"));
            if (!Number.isNaN(idx)) {
              onActiveIndexChange?.(idx);
            }
          }
        });
      },
      { threshold: [0.5] }
    );

    chapterRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [onActiveIndexChange]);

  return (
    <div className={`space-y-6 ${className}`}>
      {chapters.map((chapter, idx) => {
        const isActive = activeIndex === idx;

        return (
          <div
            key={chapter.id}
            ref={(el) => {
              chapterRefs.current[idx] = el;
            }}
            data-chapter-index={idx}
            onClick={() => onActiveIndexChange?.(idx)}
            onMouseEnter={() => onActiveIndexChange?.(idx)}
            className={`p-6 border-l-2 cursor-pointer transition-all duration-300 ${
              isActive
                ? "border-l-[var(--kt-asphalt)] bg-black/[0.02] translate-x-1"
                : "border-l-[var(--kt-concrete)]/60 opacity-60 hover:opacity-90 hover:border-l-[var(--kt-road-grey)]"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">
                {chapter.stepNumber}
              </span>
              {chapter.badge && (
                <span className="text-[10px] font-mono tracking-widest uppercase bg-black/[0.04] px-2 py-0.5 text-[var(--kt-asphalt)]">
                  {chapter.badge}
                </span>
              )}
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--kt-asphalt)]">
              {chapter.title}
            </h3>
            <p className="text-sm sm:text-base text-[var(--kt-road-grey)] leading-relaxed mt-2">
              {chapter.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
