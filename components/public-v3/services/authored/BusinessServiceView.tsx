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

export function BusinessServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.business;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  const [activeChapter, setActiveChapter] = useState(0);

  const businessChapters = service.process.map((step, idx) => ({
    id: `business-step-${idx}`,
    stepNumber: `0${idx + 1}`,
    title: step.title,
    description: step.description,
    badge: idx === 0 ? "ACCOUNT" : idx === 1 ? "BATCHING" : "SETTLEMENT",
  }));

  return (
    <div className="space-y-16">
      {/* 1. Business Hero Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--kt-asphalt)]" />
            <span>Dedicated Merchant Accounts & Daily Rhythm</span>
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

          {/* Repeat-Dispatch Visual Rhythm (Cadence without Fake Clock Times) */}
          <div className="pt-6 border-t border-[var(--kt-concrete)]/40 space-y-3">
            <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
              Repeated Dispatch Cadence
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs text-center">
              <div className="p-3 bg-black/[0.02] border border-[var(--kt-concrete)]/40">
                <div className="text-[var(--kt-asphalt)] font-bold">BATCH 01</div>
                <div className="text-[10px] text-[var(--kt-road-grey)] uppercase mt-0.5">Morning Pickup</div>
              </div>
              <div className="p-3 bg-black/[0.02] border border-[var(--kt-concrete)]/40">
                <div className="text-[var(--kt-asphalt)] font-bold">BATCH 02</div>
                <div className="text-[10px] text-[var(--kt-road-grey)] uppercase mt-0.5">Midday Run</div>
              </div>
              <div className="p-3 bg-black/[0.02] border border-[var(--kt-concrete)]/40">
                <div className="text-[var(--kt-asphalt)] font-bold">BATCH 03</div>
                <div className="text-[10px] text-[var(--kt-road-grey)] uppercase mt-0.5">Daily Clearance</div>
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

      {/* 2. Account Operations Workflow — Text Chapters */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-1">
            Account Management
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            Account-based delivery management
          </h2>
        </div>

        <ServiceTextChapters
          chapters={businessChapters}
          activeIndex={activeChapter}
          onActiveIndexChange={setActiveChapter}
        />
      </section>

      {/* 3. Merchant Fit & Standards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[var(--kt-concrete)]/40 md:divide-x md:divide-[var(--kt-concrete)]/40">
        <div className="space-y-4 md:pr-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Merchant Partners
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
            Account Integration
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
