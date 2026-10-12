"use client";

import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { ServiceStickyMedia } from "../motion";
import type { AuthoredServiceViewProps } from "./types";

export function PricingServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.pricing;

  const pricingFactors = [
    {
      title: "Pickup and drop-off locations",
      description: "Accurate street addresses and verified destination coordinates determine the confirmed transit distance.",
    },
    {
      title: "Delivery service type",
      description: "Economy, Standard, or Express / Same-Day, where the selected service supports both addresses. A future collection date keeps the selected service tariff.",
    },
    {
      title: "Parcel count, dimensions and weight",
      description: "The selected approved parcel profile defines dimension and weight limits. Quotes use its current version.",
    },
    {
      title: "Scheduling requirements",
      description: "Choose a future collection date or window when booking. Scheduling is separate from the delivery service and does not create another tariff.",
    },
    {
      title: "Current operational availability",
      description: "The quote engine validates both addresses against enabled service areas and a verified road route. Booking remains subject to operational availability.",
    },
  ];

  return (
    <div className="space-y-16">
      {/* 1. Editorial Lead Stage — The Quietest Service Presentation */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 space-y-6 lg:sticky lg:top-28">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--kt-public-text-muted)] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--kt-public-surface-inverse)]" />
            <span>Deterministic Pricing Policy &bull; Zero Speculative Rates</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--kt-public-text-primary)] leading-none">
            {service.title}
          </h1>
          <p className="text-lg sm:text-xl text-[var(--kt-public-text-muted)] leading-relaxed">
            {service.summary}
          </p>
          <div className="pt-2">
            <Link
              href="/quote"
              className="kt-action-filled px-6 py-3.5 inline-flex items-center gap-2"
            >
              <span>Request a delivery quote</span>
              <KtIconArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <ServiceStickyMedia
            media={[mediaSet.primary]}
            activeIndex={0}
            aspectRatio="aspect-[4/3]"
          />
        </div>
      </section>

      {/* 2. The 5 Real Quote Factors — Unboxed Editorial Sequence */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-public-border-default)]/40">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-public-text-muted)] block mb-1">
            Quote Methodology
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-public-text-primary)]">
            The five factors that shape your quote
          </h2>
        </div>

        <div className="divide-y divide-[var(--kt-public-border-default)]/40 border-y border-[var(--kt-public-border-default)]/40">
          {pricingFactors.map((factor, idx) => (
            <div
              key={idx}
              className="py-5 flex flex-col sm:flex-row sm:items-baseline gap-4 justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-[var(--kt-public-text-muted)]">
                    Factor 0{idx + 1}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-[var(--kt-public-text-primary)]">
                  {factor.title}
                </h3>
                <p className="text-sm text-[var(--kt-public-text-muted)] max-w-2xl leading-relaxed">
                  {factor.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
