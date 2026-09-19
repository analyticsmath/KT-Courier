import Image from "next/image";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
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
      description: "Standard local courier, scheduled dispatch, bulk haulage, or direct dedicated movement.",
    },
    {
      title: "Parcel count, dimensions and weight",
      description: "Size, physical volume, and loading requirements that establish the appropriate transport vehicle.",
    },
    {
      title: "Scheduling requirements",
      description: "Same-day urgent dispatch, specific arrival window requests, or planned advance bookings.",
    },
    {
      title: "Current operational availability",
      description: "Confirmed fleet capacity and driver availability across the requested route at dispatch time.",
    },
  ];

  return (
    <div className="space-y-16">
      {/* Editorial Lead Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--kt-asphalt)] leading-none">
            {service.title}
          </h1>
          <p className="text-lg sm:text-xl text-[var(--kt-road-grey)] leading-relaxed">
            KT Couriers does not advertise speculative rate tables or deploy client-side guessing calculators. Every quote is calculated from real physical requirements submitted through our authenticated delivery request flow.
          </p>
          <div className="pt-2">
            <Link
              href="/account/request-delivery"
              className="kt-action-filled px-6 py-3.5 inline-flex items-center gap-2"
            >
              <span>Request a delivery quote</span>
              <KtIconArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative aspect-[4/3] w-full bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/40 overflow-hidden">
            <Image
              src={mediaSet.primary.src}
              alt={mediaSet.primary.alt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* The 5 Real Quote Factors — Unboxed Editorial Sequence */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            The five factors that shape your quote
          </h2>
        </div>

        <div className="divide-y divide-[var(--kt-concrete)]/40 border-y border-[var(--kt-concrete)]/40">
          {pricingFactors.map((factor, idx) => (
            <div
              key={idx}
              className="py-5 flex flex-col sm:flex-row sm:items-baseline gap-4 justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">
                    Factor 0{idx + 1}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
                  {factor.title}
                </h3>
                <p className="text-sm text-[var(--kt-road-grey)] max-w-2xl leading-relaxed">
                  {factor.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quote Process Steps — Unboxed Editorial Sequence */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            How your quote is prepared
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {service.process.map((step, idx) => (
            <div
              key={idx}
              className="pt-4 border-t border-[var(--kt-concrete)] space-y-2"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">
                  0{idx + 1}
                </span>
                <div className="h-px flex-1 bg-[var(--kt-concrete)]/60" />
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
                {step.title}
              </h3>
              <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Canonical Single Action Block */}
      <section className="py-12 border-t border-[var(--kt-concrete)]/40 space-y-6">
        <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
          Ready to get an accurate delivery quote?
        </h3>
        <p className="text-sm sm:text-base text-[var(--kt-road-grey)] max-w-xl leading-relaxed">
          Submit pickup, drop-off, and parcel details directly into the authenticated delivery request flow to receive a confirmed price.
        </p>
        <div className="pt-2">
          <Link
            href="/account/request-delivery"
            className="kt-action-filled px-8 py-3.5 inline-flex items-center gap-2"
          >
            <span>Request a delivery quote</span>
            <KtIconArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
