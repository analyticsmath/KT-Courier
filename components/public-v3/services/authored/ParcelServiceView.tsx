"use client";

import { useState } from "react";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { CourierActor } from "../../actors/CourierActor";
import {
  ServiceStickyMedia,
  ServiceTextChapters,
  ServiceImageShift,
  ServiceTypeOcclusion,
} from "../motion";
import type { AuthoredServiceViewProps } from "./types";

export function ParcelServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.parcel;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];
  const allMedia = [heroMedia, ...detailMediaItems];

  const [activeChapter, setActiveChapter] = useState(0);

  const processChapters = service.process.map((step, idx) => ({
    id: `parcel-step-${idx}`,
    stepNumber: `0${idx + 1}`,
    title: step.title,
    description: step.description,
    badge: idx === 0 ? "INTAKE" : idx === 1 ? "TRANSIT" : "HANDOFF",
  }));

  return (
    <div className="space-y-16">
      {/* 1. Monumental Typographic Depth Plane with Courier Crossing Baseline */}
      <ServiceTypeOcclusion
        word="PARCEL"
        rate={0.25}
        foregroundElement={
          <div className="max-w-xs ml-4 sm:ml-12 filter drop-shadow-sm">
            <CourierActor stateId="walk-right-one-parcel" priority />
          </div>
        }
      />

      {/* 2. Editorial Hero Stage: Sticky Title + Media Transition */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start relative z-10">
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
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
        </div>

        <div className="lg:col-span-6">
          <ServiceStickyMedia
            media={allMedia}
            activeIndex={activeChapter}
            aspectRatio="aspect-[4/3]"
          />
        </div>
      </section>

      {/* 3. Custody Chain & Text Chapters — Process steps drive adjacent media */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-1">
            Custody Protocol
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            How custody is maintained
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <ServiceTextChapters
              chapters={processChapters}
              activeIndex={activeChapter}
              onActiveIndexChange={setActiveChapter}
            />
          </div>
          <div className="lg:col-span-5 hidden lg:block sticky top-36">
            <div className="p-4 bg-black/[0.02] border border-[var(--kt-concrete)]/40 text-xs font-mono space-y-2 text-[var(--kt-road-grey)]">
              <div className="font-bold text-[var(--kt-asphalt)] uppercase">
                Active Chapter &bull; {processChapters[activeChapter]?.badge}
              </div>
              <p>
                Each transfer point records custody timestamp and confirmed delivery coordinates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Suitable Items & Packaging Guidelines */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[var(--kt-concrete)]/40 md:divide-x md:divide-[var(--kt-concrete)]/40">
        <div className="space-y-4 md:pr-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Suitable Items
          </h3>
          <ul className="space-y-2.5 text-sm text-[var(--kt-road-grey)]">
            {service.idealFor.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[var(--kt-asphalt)] font-bold mt-0.5">&bull;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4 md:pl-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Packaging & Handoff Guide
          </h3>
          <ul className="space-y-2.5 text-sm text-[var(--kt-road-grey)]">
            {service.preparation.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[var(--kt-asphalt)] font-bold mt-0.5">&bull;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Secondary Documentary Media Drift */}
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
