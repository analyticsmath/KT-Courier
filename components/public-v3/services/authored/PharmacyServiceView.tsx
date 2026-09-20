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

export function PharmacyServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.pharmacy;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  const [activeChapter, setActiveChapter] = useState(0);

  const pharmacyChapters = service.process.map((step, idx) => ({
    id: `pharmacy-step-${idx}`,
    stepNumber: `0${idx + 1}`,
    title: step.title,
    description: step.description,
    badge: idx === 0 ? "COLLECTION" : idx === 1 ? "PROTECTED" : "DIRECT HANDOFF",
  }));

  return (
    <div className="space-y-16">
      {/* 1. Controlled Editorial Split Stage: Sticky Copy + Media */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--kt-asphalt)]" />
            <span>Careful Handling & Direct Transit</span>
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
        </div>

        <div className="lg:col-span-6">
          <ServiceStickyMedia
            media={[heroMedia, ...detailMediaItems]}
            activeIndex={activeChapter}
            aspectRatio="aspect-[4/3]"
          />
        </div>
      </section>

      {/* 2. Restrained Factual Notice (Zero HUD, Zero Speculation) */}
      <section className="py-5 px-6 bg-black/[0.02] border-l-2 border-[var(--kt-asphalt)] border-y border-r border-[var(--kt-concrete)]/30 space-y-1.5">
        <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-asphalt)] font-bold">
          Careful Transport Protocol
        </div>
        <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed">
          KT Couriers coordinates careful, dedicated local transport for health and wellness products prepared by certified pharmacies and dispensaries. Items are transported directly from pickup to the designated destination address.
        </p>
      </section>

      {/* 3. Text Chapters — Direct Handoff Steps */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-1">
            Custody Sequence
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            Careful handling from counter to recipient
          </h2>
        </div>

        <ServiceTextChapters
          chapters={pharmacyChapters}
          activeIndex={activeChapter}
          onActiveIndexChange={setActiveChapter}
        />
      </section>

      {/* 4. Suitable Categories & Preparation Standards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[var(--kt-concrete)]/40 md:divide-x md:divide-[var(--kt-concrete)]/40">
        <div className="space-y-4 md:pr-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Suitable Shipments
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
            Preparation Guide
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

      {/* 5. Documentary Detail Media Drift */}
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
