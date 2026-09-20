"use client";

import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { CourierActor } from "../../actors/CourierActor";
import {
  ServiceStickyMedia,
  ServiceMediaHandoff,
  ServiceTypeOcclusion,
  type MediaHandoffStage,
} from "../motion";
import type { AuthoredServiceViewProps } from "./types";

export function FoodServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.food;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  const foodStages: MediaHandoffStage[] = [
    {
      id: "stage-kitchen",
      stageName: "Kitchen Dispatch",
      title: "Prepared freshly in local food kitchens",
      subtitle: "Orders are prepared by independent restaurants, bakeries, and culinary kitchens for immediate handoff.",
      asset: heroMedia,
    },
    {
      id: "stage-pack",
      stageName: "Thermal Pack",
      title: "Protected in insulated food carriers",
      subtitle: "Meals are sealed in temperature-preserving transit packs to preserve dish quality from pickup to doorstep.",
      asset: mediaSet.secondary,
    },
    {
      id: "stage-courier",
      stageName: "Courier Transit",
      title: "Direct dedicated delivery to recipient",
      subtitle: "Couriers complete the delivery run directly without intermediate consolidation.",
      asset: mediaSet.detail,
    },
  ];

  return (
    <div className="space-y-16">
      {/* 1. Large FOOD Word Moving Behind Image */}
      <ServiceTypeOcclusion
        word="FOOD"
        rate={0.3}
        foregroundElement={
          <div className="max-w-xs ml-4 sm:ml-12 filter drop-shadow-sm">
            <CourierActor stateId="look-viewer-parcel" priority />
          </div>
        }
      />

      {/* 2. Editorial Hero Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start relative z-10">
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
            Kitchen Collection & Direct Transit
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
            activeIndex={0}
            aspectRatio="aspect-[4/3]"
          />
        </div>
      </section>

      {/* 3. Fast Rhythm Sequence: Kitchen -> Pack -> Courier */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-1">
              Fresh Transit Flow
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
              Kitchen collection and direct delivery
            </h2>
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
            Kitchen &rarr; Pack &rarr; Courier
          </span>
        </div>

        <ServiceMediaHandoff stages={foodStages} />
      </section>

      {/* 4. Kitchen Standards & Handling Guidelines */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[var(--kt-concrete)]/40 md:divide-x md:divide-[var(--kt-concrete)]/40">
        <div className="space-y-4 md:pr-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Suitable Orders
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
            Kitchen Packing Checklist
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
