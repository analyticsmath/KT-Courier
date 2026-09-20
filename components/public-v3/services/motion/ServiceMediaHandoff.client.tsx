"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { KTMediaV3Asset } from "../../media/kt-media-v3";

export interface MediaHandoffStage {
  id: string;
  stageName: string;
  title: string;
  subtitle: string;
  asset: KTMediaV3Asset;
}

interface ServiceMediaHandoffProps {
  stages: MediaHandoffStage[];
  className?: string;
}

/**
 * ServiceMediaHandoff (client motion primitive).
 * Implements seamless multi-stage handoffs (e.g. MERCHANT -> PACKING -> VAN).
 * The incoming stage begins entering before previous media fully leaves.
 */
export function ServiceMediaHandoff({
  stages,
  className = "",
}: ServiceMediaHandoffProps) {
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId: number;
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return;

      const progress = Math.max(0, Math.min(1, (vh * 0.7 - rect.top) / (rect.height * 0.8)));
      const nextIdx = Math.min(stages.length - 1, Math.floor(progress * stages.length));
      setActiveStageIdx(nextIdx);
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
  }, [stages.length]);

  return (
    <div ref={containerRef} className={`w-full space-y-8 ${className}`}>
      {/* Stage Step Progress Indicator */}
      <div className="flex items-center justify-between border-b border-[var(--kt-concrete)]/60 pb-3">
        {stages.map((stage, idx) => {
          const isActive = idx === activeStageIdx;
          const isPassed = idx < activeStageIdx;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveStageIdx(idx)}
              className="flex items-center gap-2 group text-left cursor-pointer"
            >
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 transition-colors ${
                  isActive
                    ? "bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)]"
                    : isPassed
                    ? "bg-black/10 text-[var(--kt-asphalt)]"
                    : "text-[var(--kt-road-grey)]"
                }`}
              >
                0{idx + 1}
              </span>
              <span
                className={`font-display text-sm font-bold tracking-tight uppercase transition-colors hidden sm:inline ${
                  isActive
                    ? "text-[var(--kt-asphalt)]"
                    : "text-[var(--kt-road-grey)] group-hover:text-[var(--kt-asphalt)]"
                }`}
              >
                {stage.stageName}
              </span>
            </button>
          );
        })}
      </div>

      {/* Overlapping Media Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 relative aspect-[16/10] w-full bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/40 overflow-hidden">
          {stages.map((stage, idx) => {
            const isCurrent = idx === activeStageIdx;
            const isPrev = idx === activeStageIdx - 1;

            return (
              <div
                key={stage.id}
                className={`absolute inset-0 transition-all duration-700 ease-out ${
                  isCurrent
                    ? "opacity-100 scale-100 z-10 translate-x-0"
                    : isPrev
                    ? "opacity-0 scale-95 z-5 -translate-x-6"
                    : "opacity-0 scale-105 z-0 translate-x-6"
                }`}
              >
                <Image
                  src={stage.asset.src}
                  alt={stage.asset.alt}
                  fill
                  priority={idx === 0}
                  sizes="(max-width: 1023px) 100vw, 60vw"
                  className="object-cover"
                  style={{
                    objectPosition: `${stage.asset.focalPoint[0] * 100}% ${stage.asset.focalPoint[1] * 100}%`,
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
              </div>
            );
          })}
        </div>

        {/* Narrative Stage Copy */}
        <div className="lg:col-span-5 space-y-3">
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block">
            Stage 0{activeStageIdx + 1} &bull; {stages[activeStageIdx]?.stageName}
          </span>
          <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            {stages[activeStageIdx]?.title}
          </h3>
          <p className="text-sm sm:text-base text-[var(--kt-road-grey)] leading-relaxed">
            {stages[activeStageIdx]?.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
