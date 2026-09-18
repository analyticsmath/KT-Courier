"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { WhiteTruckActor } from "../actors/WhiteTruckActor";

interface ServiceItem {
  id: string;
  slug: string;
  title: string;
  headline: string;
  summary: string;
  href: string;
  image: string;
  actorNote: string;
}

const SERVICES_LIST: ServiceItem[] = [
  {
    id: "parcel",
    slug: "parcel",
    title: "Parcel & documents",
    headline: "From pickup to doorstep.",
    summary: "Same-day and scheduled delivery for everyday envelopes, small cartons, and time-sensitive packages.",
    href: "/services/parcel",
    image: "/images/kt-couriers/provisional/r2/documentary/r2-doc-06-handoff.webp",
    actorNote: "Courier & direct parcel handoff",
  },
  {
    id: "ecommerce",
    slug: "ecommerce",
    title: "E-commerce",
    headline: "The order doesn’t stop at checkout.",
    summary: "Integrated merchant dispatch connecting local online purchases with dedicated courier transit.",
    href: "/services/ecommerce",
    image: "/media/public/images/jhb-rosebank-bags.webp",
    actorNote: "Order to merchant to parcel transit",
  },
  {
    id: "food",
    slug: "food",
    title: "Food",
    headline: "Picked up. Brought over.",
    summary: "Food-related local deliveries arranged from store kitchens and local food producers directly to customers.",
    href: "/services/food",
    image: "/media/public/images/cape-town-market-food-bowl.webp",
    actorNote: "Kitchen preparation & van delivery",
  },
  {
    id: "grocery",
    slug: "grocery",
    title: "Grocery",
    headline: "From the shop to your door.",
    summary: "Market staples, fresh produce, and household pantry provisions collected and delivered directly.",
    href: "/services/grocery",
    image: "/media/public/images/cape-town-market-vegetables.webp",
    actorNote: "Store collection to doorstep",
  },
  {
    id: "pharmacy",
    slug: "pharmacy",
    title: "Pharmacy",
    headline: "A careful handoff, clearly arranged.",
    summary: "Pharmacy-related deliveries arranged with careful handling and verified drop-off coordinates.",
    href: "/services/pharmacy",
    image: "/media/public/images/jhb-rosebank-plants.webp",
    actorNote: "Direct transit & careful custody",
  },
  {
    id: "moving",
    slug: "moving",
    title: "Moving",
    headline: "When it’s more than a parcel.",
    summary: "Larger household goods, office equipment, and bulky volume moves coordinated with cargo transport.",
    href: "/services/moving",
    image: "/media/public/images/jhb-maboneng-vehicle-workshop.webp",
    actorNote: "Volume transport vehicle scale",
  },
  {
    id: "freight",
    slug: "freight",
    title: "Freight",
    headline: "Bigger loads need a clear plan.",
    summary: "Scheduled heavy haulage and pallet freight coordinated across South African regional highways.",
    href: "/services/freight",
    image: "/media/public/images/truck_asset_pack_12_images/01_full_side_view_facing_right.png",
    actorNote: "Red freight truck & highway transit",
  },
  {
    id: "shuttle",
    slug: "shuttle",
    title: "Shuttle",
    headline: "Planned transport, clearly arranged.",
    summary: "Scheduled route transport coordinated between confirmed commercial hubs and departure points.",
    href: "/services/shuttle",
    image: "/media/public/images/cape-town-road-night.webp",
    actorNote: "Scheduled route transit",
  },
  {
    id: "business",
    slug: "business",
    title: "Business",
    headline: "Delivery built into the day-to-day.",
    summary: "Account-based delivery management for local merchants and businesses with repeat daily orders.",
    href: "/services/business",
    image: "/images/kt-couriers/provisional/r2/documentary/r2-doc-02-driver-arrival.webp",
    actorNote: "Dedicated merchant account coordination",
  },
  {
    id: "driver-network",
    slug: "driver-network",
    title: "Driver network",
    headline: "Meet the people who move it.",
    summary: "Professional couriers and transport operators providing reliable physical delivery across active regions.",
    href: "/services/driver-network",
    image: "/media/public/images/KT_Courier_20_Transparent_PNG_Assets/01_original_pose_refined.png",
    actorNote: "Courier team & physical handoffs",
  },
  {
    id: "pricing",
    slug: "pricing",
    title: "Pricing",
    headline: "What shapes your quote.",
    summary: "Clear, transparent delivery cost factors based on vehicle type, parcel size, and confirmed distance.",
    href: "/services/pricing",
    image: "/media/public/images/illustration/Package delivery.svg",
    actorNote: "Factual distance and parcel dimensions",
  },
];

export function PublicServicesOverview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeService = SERVICES_LIST[activeIdx] || SERVICES_LIST[0];

  return (
    <article className="min-h-screen bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)]">
      {/* Hero: Giant Low-Contrast SERVICES with White Truck Baseline */}
      <section className="relative pt-16 pb-20 px-6 md:px-12 border-b border-[var(--kt-concrete)]/50 overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--kt-road-grey)] block mb-4">
            Delivery Services
          </span>

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

      {/* Explorer: Stable Service Rows + Active Media Preview */}
      <section className="max-w-6xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Stable Interactive Rows */}
          <div className="lg:col-span-7 space-y-2">
            {SERVICES_LIST.map((service, idx) => {
              const isActive = idx === activeIdx;

              return (
                <div
                  key={service.id}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onFocus={() => setActiveIdx(idx)}
                  className={`p-6 border transition-all duration-200 block ${
                    isActive
                      ? "bg-white border-[var(--kt-asphalt)] shadow-sm"
                      : "bg-transparent border-[var(--kt-concrete)]/50 hover:border-[var(--kt-road-grey)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-medium text-[var(--kt-road-grey)] block mb-1">
                        0{idx + 1} · {service.actorNote}
                      </span>
                      <Link
                        href={service.href}
                        className="font-display text-xl sm:text-2xl font-bold tracking-tight hover:text-[var(--kt-brand-blue)] transition-colors block"
                      >
                        {service.title}
                      </Link>
                    </div>

                    <Link
                      href={service.href}
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[var(--kt-brand-blue-accessible)] hover:underline ml-4 shrink-0"
                    >
                      View &rarr;
                    </Link>
                  </div>

                  {isActive && (
                    <p className="mt-3 text-sm text-[var(--kt-road-grey)] leading-relaxed border-t border-[var(--kt-concrete)]/40 pt-3">
                      {service.summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Sticky Active Service Stage */}
          <div className="lg:col-span-5 sticky top-28 space-y-6">
            <div className="relative aspect-[4/3] w-full bg-white border border-[var(--kt-concrete)] overflow-hidden shadow-sm">
              <Image
                src={activeService.image}
                alt={activeService.title}
                fill
                sizes="(max-width: 1023px) 94vw, 450px"
                className="object-cover"
                priority
              />
            </div>

            <div className="p-6 bg-white border border-[var(--kt-concrete)] space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--kt-road-grey)] block">
                {activeService.actorNote}
              </span>
              <h3 className="font-display text-2xl font-bold tracking-tight">
                {activeService.headline}
              </h3>
              <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed">
                {activeService.summary}
              </p>
              <div className="pt-4">
                <Link
                  href={activeService.href}
                  className="inline-flex items-center justify-center px-6 py-3 bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] font-bold text-xs uppercase tracking-wider hover:bg-[#23272B] transition-colors w-full"
                >
                  Explore {activeService.title} Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
