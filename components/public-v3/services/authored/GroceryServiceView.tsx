"use client";

import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import {
  ServiceStickyMedia,
  ServiceHorizontalMedia,
  type HorizontalMediaItem,
} from "../motion";
import type { AuthoredServiceViewProps } from "./types";

export function GroceryServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.grocery;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  const groceryShelfItems: HorizontalMediaItem[] = [
    {
      asset: mediaSet.primary,
      title: "Fresh Produce Staging",
      tag: "Market Fresh",
      description: "Morning market crates, regional fruits, and crisp greens sorted for dispatch.",
    },
    {
      asset: mediaSet.secondary,
      title: "Farm-Selected Vegetables",
      tag: "Farm Direct",
      description: "Root vegetables and local pantry provisions packed in ventilated cartons.",
    },
    {
      asset: mediaSet.detail,
      title: "Protected Packing",
      tag: "Cold & Pantry",
      description: "Careful partition packing preventing crushing during local urban transit.",
    },
  ];

  return (
    <div className="space-y-16">
      {/* 1. Anchored Text + Sticky Media Shelf Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
            Market Staples & Produce Shelf
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

      {/* 2. Horizontal Media Shelf: Market / Shelf / Selected Produce */}
      <section className="space-y-4 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-1">
              Produce Shelf
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
              Selected provisions & handling standards
            </h2>
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
            Market Shelf &rarr; Cool Pack &rarr; Delivery
          </span>
        </div>

        <ServiceHorizontalMedia items={groceryShelfItems} />
      </section>

      {/* 3. Suitable Categories & Storage Guides */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[var(--kt-concrete)]/40 md:divide-x md:divide-[var(--kt-concrete)]/40">
        <div className="space-y-4 md:pr-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Grocery Categories
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
            Packing & Transit Standards
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
