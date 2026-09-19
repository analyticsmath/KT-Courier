"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { WhiteTruckActor } from "../actors/WhiteTruckActor";
import { ktMediaV3, type KTMediaV3Asset } from "../media/kt-media-v3";

interface ServiceItem {
  id: string;
  slug: string;
  title: string;
  headline: string;
  summary: string;
  href: string;
  asset: KTMediaV3Asset;
}

const SERVICES_LIST: ServiceItem[] = [
  {
    id: "parcel",
    slug: "parcel",
    title: "Parcel & documents",
    headline: "From pickup to doorstep.",
    summary: "Same-day and scheduled delivery for everyday envelopes, small cartons, and time-sensitive packages.",
    href: "/services/parcel",
    asset: ktMediaV3.pages.services.overview.parcel,
  },
  {
    id: "ecommerce",
    slug: "ecommerce",
    title: "E-commerce",
    headline: "The order doesn’t stop at checkout.",
    summary: "Integrated merchant dispatch connecting local online purchases with dedicated courier transit.",
    href: "/services/ecommerce",
    asset: ktMediaV3.pages.services.overview.ecommerce,
  },
  {
    id: "food",
    slug: "food",
    title: "Food",
    headline: "Picked up. Brought over.",
    summary: "Food-related local deliveries arranged from store kitchens and local food producers directly to customers.",
    href: "/services/food",
    asset: ktMediaV3.pages.services.overview.food,
  },
  {
    id: "grocery",
    slug: "grocery",
    title: "Grocery",
    headline: "From the shop to your door.",
    summary: "Market staples, fresh produce, and household pantry provisions collected and delivered directly.",
    href: "/services/grocery",
    asset: ktMediaV3.pages.services.overview.grocery,
  },
  {
    id: "pharmacy",
    slug: "pharmacy",
    title: "Pharmacy",
    headline: "A careful handoff, clearly arranged.",
    summary: "Pharmacy-related deliveries arranged with careful handling and verified drop-off coordinates.",
    href: "/services/pharmacy",
    asset: ktMediaV3.pages.services.overview.pharmacy,
  },
  {
    id: "moving",
    slug: "moving",
    title: "Moving",
    headline: "When it’s more than a parcel.",
    summary: "Larger household goods, office equipment, and bulky volume moves coordinated with cargo transport.",
    href: "/services/moving",
    asset: ktMediaV3.pages.services.overview.moving,
  },
  {
    id: "freight",
    slug: "freight",
    title: "Freight",
    headline: "Bigger loads need a clear plan.",
    summary: "Scheduled heavy haulage and pallet freight coordinated across South African regional highways.",
    href: "/services/freight",
    asset: ktMediaV3.pages.services.overview.freight,
  },
  {
    id: "shuttle",
    slug: "shuttle",
    title: "Shuttle",
    headline: "Planned transport, clearly arranged.",
    summary: "Scheduled route transport coordinated between confirmed commercial hubs and departure points.",
    href: "/services/shuttle",
    asset: ktMediaV3.pages.services.overview.shuttle,
  },
  {
    id: "business",
    slug: "business",
    title: "Business",
    headline: "Delivery built into the day-to-day.",
    summary: "Account-based delivery management for local merchants and businesses with repeat daily orders.",
    href: "/services/business",
    asset: ktMediaV3.pages.services.overview.business,
  },
  {
    id: "driver-network",
    slug: "driver-network",
    title: "Driver network",
    headline: "Meet the people who move it.",
    summary: "Professional couriers and transport operators providing reliable physical delivery across active regions.",
    href: "/services/driver-network",
    asset: ktMediaV3.pages.services.overview.driverNetwork,
  },
  {
    id: "pricing",
    slug: "pricing",
    title: "Pricing",
    headline: "What shapes your quote.",
    summary: "Clear, transparent delivery cost factors based on vehicle type, parcel size, and confirmed distance.",
    href: "/services/pricing",
    asset: ktMediaV3.pages.services.overview.pricing,
  },
];

const SERVICE_CTA_MAP: Record<string, string> = {
  parcel: "View parcel delivery",
  ecommerce: "View e-commerce delivery",
  food: "View food delivery",
  grocery: "View grocery delivery",
  pharmacy: "View pharmacy delivery",
  moving: "View moving transport",
  freight: "View freight delivery",
  shuttle: "View route shuttle",
  business: "View business delivery",
  "driver-network": "View driver network",
  pricing: "View delivery pricing",
};

export function PublicServicesOverview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeService = SERVICES_LIST[activeIdx] || SERVICES_LIST[0];

  return (
    <article className="min-h-screen bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)]">
      {/* Hero: Giant Low-Contrast SERVICES with White Truck Baseline */}
      <section className="relative pt-16 pb-20 px-6 md:px-12 border-b border-[var(--kt-concrete)]/50 overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          <h1 className="font-display text-[clamp(4rem,12vw,10rem)] font-extrabold tracking-tight leading-none text-[var(--kt-asphalt)]/90 mb-6 uppercase select-none">
            SERVICES
          </h1>

          <p className="text-lg sm:text-xl text-[var(--kt-road-grey)] max-w-xl leading-relaxed">
            From small parcels to planned freight, explore delivery services organized around what you are sending and how it moves.
          </p>

          {/* White truck traversing baseline */}
          <div className="mt-8 max-w-2xl opacity-95">
            <WhiteTruckActor stateId="side-right" />
          </div>
        </div>
      </section>

      {/* Explorer: Full-Width Stable Service Rows + Fixed Media Preview Stage */}
      <section className="max-w-6xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Stable Interactive Rows with Hairline Separators (5–49vw) */}
          <div className="lg:col-span-7 border-t border-[var(--kt-concrete)]/40 divide-y divide-[var(--kt-concrete)]/40">
            {SERVICES_LIST.map((service, idx) => {
              const isActive = idx === activeIdx;

              return (
                <div
                  key={service.id}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onFocus={() => setActiveIdx(idx)}
                  className={`group py-5 px-4 transition-colors duration-150 flex items-center justify-between border-l-2 ${
                    isActive
                      ? "border-l-[var(--kt-asphalt)] bg-black/[0.03]"
                      : "border-l-transparent hover:bg-black/[0.015] hover:border-l-[var(--kt-road-grey)]"
                  }`}
                >
                  <div className="pr-4">
                    <Link
                      href={service.href}
                      className={`font-display text-xl sm:text-2xl font-bold tracking-tight transition-colors block ${
                        isActive ? "text-[var(--kt-asphalt)]" : "text-[var(--kt-road-grey)] group-hover:text-[var(--kt-asphalt)]"
                      }`}
                    >
                      {service.title}
                    </Link>
                    <p className="text-xs text-[var(--kt-road-grey)] line-clamp-1 mt-1 font-normal">
                      {service.headline}
                    </p>
                  </div>

                  <Link
                    href={service.href}
                    aria-label={`View ${service.title} details`}
                    className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider shrink-0 transition-colors ${
                      isActive ? "text-[var(--kt-asphalt)]" : "text-[var(--kt-road-grey)] group-hover:text-[var(--kt-asphalt)]"
                    }`}
                  >
                    <span>View</span>
                    <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Right: Sticky Active Service Stage (64–70vh) */}
          <div className="lg:col-span-5 sticky top-28 space-y-4">
            <div className="relative h-[48vh] sm:h-[56vh] lg:h-[64vh] w-full bg-[var(--kt-concrete)]/20 overflow-hidden border border-[var(--kt-concrete)]/40">
              <Image
                src={activeService.asset.src}
                alt={activeService.asset.alt}
                fill
                sizes="(max-width: 1023px) 94vw, 450px"
                className="object-cover transition-all duration-300"
              />
            </div>

            <div className="pt-2 space-y-3">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--kt-asphalt)]">
                {activeService.headline}
              </h2>
              <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed">
                {activeService.summary}
              </p>
              <div className="pt-3 border-t border-[var(--kt-concrete)]/40">
                <Link
                  href={activeService.href}
                  className="kt-action-filled w-full py-3.5 inline-flex items-center justify-center font-bold text-xs uppercase tracking-wider"
                >
                  {SERVICE_CTA_MAP[activeService.id] || "View service details"} &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
