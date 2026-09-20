"use client";

import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { VanActor } from "../../actors/VanActor";
import {
  ServiceStickyMedia,
  ServiceMediaHandoff,
  type MediaHandoffStage,
} from "../motion";
import type { AuthoredServiceViewProps } from "./types";

export function EcommerceServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.ecommerce;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  const handoffStages: MediaHandoffStage[] = [
    {
      id: "stage-merchant",
      stageName: "Merchant Intake",
      title: "Cart and checkout orders sync directly",
      subtitle: "When a customer completes purchase, order manifests immediately register with the local delivery network.",
      asset: heroMedia,
    },
    {
      id: "stage-packing",
      stageName: "Packing & Staging",
      title: "Prepared with protective packaging",
      subtitle: "Items are packed, barcoded, and staged at the merchant pickup counter ready for collection.",
      asset: mediaSet.secondary,
    },
    {
      id: "stage-van",
      stageName: "Van Transit",
      title: "Loaded directly for local delivery",
      subtitle: "Assigned courier vans complete collections and carry orders into last-mile residential delivery routes.",
      asset: mediaSet.detail,
    },
  ];

  return (
    <div className="space-y-16">
      {/* 1. Commerce Hero Stage with Sticky Title & Active Van Baseline */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
            Merchant Direct Integration
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

        <div className="lg:col-span-6 relative">
          <ServiceStickyMedia
            media={[heroMedia, ...detailMediaItems]}
            activeIndex={0}
            aspectRatio="aspect-[4/3]"
          />
          <div className="absolute left-0 bottom-0 z-20 w-[58%] max-w-lg -translate-x-[8%] translate-y-[8%] pointer-events-none drop-shadow-lg">
            <VanActor className="w-full" stateId="side-left" priority />
          </div>
        </div>
      </section>

      {/* 2. Dispatch Sequence Handoff: MERCHANT -> PACKING -> VAN */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-1">
              Dispatch Pipeline
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
              Connecting checkout to courier transit
            </h2>
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
            Merchant &rarr; Packing &rarr; Van
          </span>
        </div>

        <ServiceMediaHandoff stages={handoffStages} />
      </section>

      {/* 3. Suitable Categories & Integration Guidelines */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[var(--kt-concrete)]/40 md:divide-x md:divide-[var(--kt-concrete)]/40">
        <div className="space-y-4 md:pr-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Store Types & Categories
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
            Merchant Preparation Guide
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
    </div>
  );
}
