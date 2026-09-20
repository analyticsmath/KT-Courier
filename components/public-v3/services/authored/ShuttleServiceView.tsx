"use client";

import { useState } from "react";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import {
  ServiceStickyMedia,
  ServiceTextChapters,
  ServiceImageShift,
} from "../motion";
import type { AuthoredServiceViewProps } from "./types";

export function ShuttleServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.shuttle;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  const [activeChapter, setActiveChapter] = useState(0);

  const shuttleChapters = service.process.map((step, idx) => ({
    id: `shuttle-step-${idx}`,
    stepNumber: `0${idx + 1}`,
    title: step.title,
    description: step.description,
    badge: idx === 0 ? "COORDINATION" : idx === 1 ? "ORIGIN" : "CORRIDOR",
  }));

  return (
    <div className="space-y-16">
      {/* 1. Planned Shuttle Hero Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--kt-asphalt)]" />
            <span>Dedicated Hub-to-Hub Transport</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--kt-asphalt)] leading-none">
            {service.title}
          </h1>
          <p className="text-lg sm:text-xl text-[var(--kt-road-grey)] leading-relaxed max-w-xl">
            {service.summary}
          </p>
          <div className="pt-2 flex items-center gap-4 flex-wrap">
            <Link
              href={service.primaryAction.href || "/account/request-delivery"}
              className="kt-action-filled px-6 py-3.5 inline-flex items-center gap-2"
            >
              <span>{service.primaryAction.label}</span>
              <KtIconArrowRight size={16} />
            </Link>
            {service.secondaryAction && (
              <Link
                href={service.secondaryAction.href}
                className="text-xs font-bold uppercase tracking-wider text-[var(--kt-asphalt)] border-b border-[var(--kt-concrete)] hover:border-[var(--kt-asphalt)] pb-1 transition-colors"
              >
                {service.secondaryAction.label}
              </Link>
            )}
          </div>

          {/* Abstract Realistic Route Geometry (No Invented Highway/Zone Names) */}
          <div className="pt-6 border-t border-[var(--kt-concrete)]/40 space-y-3">
            <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
              Regional Route Geometry
            </div>
            <div className="p-4 bg-black/[0.02] border border-[var(--kt-concrete)]/40 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--kt-asphalt)]">COMMERCIAL TRANSIT LINK</span>
                <span className="text-[var(--kt-road-grey)]">Dedicated Route Movement</span>
              </div>
              <div className="relative h-2 w-full bg-[var(--kt-concrete)]/30 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-[var(--kt-asphalt)] w-3/4 rounded-full" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--kt-road-grey)]">
                <span>Origin Facility</span>
                <span className="font-bold text-[var(--kt-asphalt)]">Coordinated Run</span>
                <span>Destination Facility</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <ServiceStickyMedia
            media={[heroMedia, ...detailMediaItems]}
            activeIndex={activeChapter}
            aspectRatio="aspect-[4/3]"
          />
        </div>
      </section>

      {/* 2. Route Coordination Protocol Note */}
      <section className="py-4 border-l-2 border-[var(--kt-asphalt)] pl-6 space-y-1">
        <h3 className="font-display text-base font-bold text-[var(--kt-asphalt)]">
          Commercial Hub-to-Hub Transport
        </h3>
        <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed">
          Shuttle movements are coordinated directly between confirmed commercial facilities and pickup points. Availability and timing are established during the quote review process based on submitted addresses.
        </p>
      </section>

      {/* 3. Text Chapters — Route Confirmation */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-1">
            Route Procedure
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            How shuttle routes are confirmed
          </h2>
        </div>

        <ServiceTextChapters
          chapters={shuttleChapters}
          activeIndex={activeChapter}
          onActiveIndexChange={setActiveChapter}
        />
      </section>

      {/* 4. Secondary Media Drift */}
      {detailMediaItems.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-[var(--kt-concrete)]/40">
          {detailMediaItems.map((item, idx) => (
            <ServiceImageShift
              key={idx}
              asset={item}
              aspectRatio="aspect-[16/10]"
              sizes="(max-width: 767px) 100vw, 50vw"
            />
          ))}
        </section>
      )}
    </div>
  );
}
