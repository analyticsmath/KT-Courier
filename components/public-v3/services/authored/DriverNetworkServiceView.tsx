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
} from "../motion";
import type { AuthoredServiceViewProps } from "./types";

export function DriverNetworkServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.driverNetwork;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  const [activeChapter, setActiveChapter] = useState(0);

  const driverChapters = service.process.map((step, idx) => ({
    id: `driver-step-${idx}`,
    stepNumber: `0${idx + 1}`,
    title: step.title,
    description: step.description,
    badge: idx === 0 ? "APPLICATION" : idx === 1 ? "ONBOARDING" : "ACTIVE DISPATCH",
  }));

  return (
    <div className="space-y-16">
      {/* 1. Network Hero Stage — Human-First Presence */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--kt-asphalt)]" />
            <span>Human Courier & Professional Operator Network</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--kt-asphalt)] leading-none">
            {service.title}
          </h1>
          <p className="text-lg sm:text-xl text-[var(--kt-road-grey)] leading-relaxed max-w-xl">
            {service.summary}
          </p>
          <div className="pt-2 flex items-center gap-4 flex-wrap">
            <Link
              href={service.primaryAction.href || "/contact"}
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

          {/* Human-First Role Index (Truthful: No Fake Earnings or Quotas) */}
          <div className="pt-6 border-t border-[var(--kt-concrete)]/40 space-y-3">
            <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
              Operational Roles
            </div>
            <div className="divide-y divide-[var(--kt-concrete)]/40 border-y border-[var(--kt-concrete)]/40">
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-display text-sm font-bold text-[var(--kt-asphalt)]">Urban Courier</div>
                  <div className="text-xs text-[var(--kt-road-grey)]">Direct parcel collection & last-mile custody</div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--kt-asphalt)]">Fleet / Van</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-display text-sm font-bold text-[var(--kt-asphalt)]">Line-Haul Operator</div>
                  <div className="text-xs text-[var(--kt-road-grey)]">Regional highway freight and pallet transit</div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--kt-asphalt)]">Heavy Haul</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-display text-sm font-bold text-[var(--kt-asphalt)]">Merchant Dispatch Lead</div>
                  <div className="text-xs text-[var(--kt-road-grey)]">Store counter staging and manifest coordination</div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--kt-asphalt)]">Hub Ops</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <ServiceStickyMedia
            media={[heroMedia, ...detailMediaItems]}
            activeIndex={activeChapter}
            aspectRatio="aspect-[4/3]"
          />

          {/* Courier Protagonist Presence */}
          <div className="p-4 bg-black/[0.02] border border-[var(--kt-concrete)]/40 flex items-center gap-6">
            <div className="w-24 shrink-0 filter drop-shadow-sm">
              <CourierActor stateId="portrait-upper-body" priority />
            </div>
            <div className="space-y-1">
              <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">Courier Standards</div>
              <div className="font-display text-base font-bold text-[var(--kt-asphalt)]">Professional Custody</div>
              <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
                Trained in chain-of-custody verification, digital handover confirmation, and safe parcel handling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Onboarding Workflow — Text Chapters */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-1">
            Network Pathway
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            How drivers join the network
          </h2>
        </div>

        <ServiceTextChapters
          chapters={driverChapters}
          activeIndex={activeChapter}
          onActiveIndexChange={setActiveChapter}
        />
      </section>

      {/* 3. Secondary Media Drift */}
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
