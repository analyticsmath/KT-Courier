import Image from "next/image";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { VanActor } from "../../actors/VanActor";
import type { AuthoredServiceViewProps } from "./types";

export function EcommerceServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.ecommerce;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  return (
    <div className="space-y-16">
      {/* Commerce Hero Stage with Sticky Text */}
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

        <div className="lg:col-span-6">
          <div className="relative aspect-[4/3] w-full bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/40 overflow-hidden group">
            <Image
              src={heroMedia.src}
              alt={heroMedia.alt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              style={{ objectPosition: `${heroMedia.focalPoint[0] * 100}% ${heroMedia.focalPoint[1] * 100}%` }}
            />
          </div>
        </div>
      </section>

      {/* Dispatch Sequence: Merchant -> Packing -> Van Transit */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            Connecting checkout to courier transit
          </h2>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">
            Merchant &rarr; Packing &rarr; Van
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Step 1: Merchant */}
          <div className="pt-4 border-t border-[var(--kt-concrete)] space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">01 / MERCHANT</span>
                <div className="h-px flex-1 bg-[var(--kt-concrete)]/60" />
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
                {service.process[0]?.title || "Cart Integration"}
              </h3>
              <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed mt-2">
                {service.process[0]?.description || "Order data syncs immediately when customer checks out."}
              </p>
            </div>
            {detailMediaItems[0] && (
              <div className="relative aspect-[16/10] w-full mt-4 bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/40 overflow-hidden">
                <Image
                  src={detailMediaItems[0].src}
                  alt={detailMediaItems[0].alt}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            )}
          </div>

          {/* Step 2: Packing */}
          <div className="pt-4 border-t border-[var(--kt-concrete)] space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">02 / PACKING</span>
                <div className="h-px flex-1 bg-[var(--kt-concrete)]/60" />
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
                {service.process[1]?.title || "Verification & Label"}
              </h3>
              <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed mt-2">
                {service.process[1]?.description || "Barcode generated, item verified and packaged for transport."}
              </p>
            </div>
            {detailMediaItems[1] && (
              <div className="relative aspect-[16/10] w-full mt-4 bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/40 overflow-hidden">
                <Image
                  src={detailMediaItems[1].src}
                  alt={detailMediaItems[1].alt}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            )}
          </div>

          {/* Step 3: Van */}
          <div className="pt-4 border-t border-[var(--kt-concrete)] space-y-3 flex flex-col justify-between bg-black/[0.015] p-4 rounded-sm border-r border-b border-l border-[var(--kt-concrete)]/40">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs font-bold text-[var(--kt-asphalt)]">03 / VAN TRANSIT</span>
                <div className="h-px flex-1 bg-[var(--kt-concrete)]/60" />
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
                {service.process[2]?.title || "Custody & Dispatch"}
              </h3>
              <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed mt-2">
                {service.process[2]?.description || "Courier scans custody into the urban van network for scheduled delivery."}
              </p>
            </div>
            <div className="mt-4 filter drop-shadow-sm">
              <VanActor stateId="side-left" priority />
            </div>
          </div>
        </div>
      </section>

      {/* Ideal For & Merchant Preparation — Unboxed Two-Column Layout */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[var(--kt-concrete)]/40 md:divide-x md:divide-[var(--kt-concrete)]/40">
        <div className="space-y-4 md:pr-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Ideal For Online Merchants
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
            Dispatch Preparation
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

      {/* Secondary Media Mosaic */}
      {detailMediaItems.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-[var(--kt-concrete)]/40">
          {detailMediaItems.map((item, idx) => (
            <div
              key={idx}
              className="relative aspect-[16/10] w-full bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/60 overflow-hidden"
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-cover"
                style={{ objectPosition: `${item.focalPoint[0] * 100}% ${item.focalPoint[1] * 100}%` }}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
