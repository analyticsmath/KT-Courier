import Image from "next/image";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
 import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import type { AuthoredServiceViewProps } from "./types";

export function DriverNetworkServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.driverNetwork;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  return (
    <div className="space-y-16">
      {/* Network Hero Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-6">
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
        </div>

        <div className="lg:col-span-6">
          <div className="relative aspect-[4/3] w-full bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/40 overflow-hidden">
            <Image
              src={heroMedia.src}
              alt={heroMedia.alt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 50vw"
              className="object-cover"
              style={{ objectPosition: `${heroMedia.focalPoint[0] * 100}% ${heroMedia.focalPoint[1] * 100}%` }}
            />
          </div>
        </div>
      </section>

      {/* Network Inquiries Notice — Unboxed Editorial Note */}
      <section className="py-4 border-l-2 border-[var(--kt-asphalt)] pl-6 space-y-1">
        <h3 className="font-display text-base font-bold text-[var(--kt-asphalt)]">
          Network Participation Information
        </h3>
        <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed">
          Contact KT for current participation details. This page does not provide an automated public registration, gig-bidding interface, or earnings calculator. Courier coordination is conducted through confirmed operational onboarding.
        </p>
      </section>

      {/* Participation Steps — Unboxed Editorial Sequence */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            How network participation works
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

      {/* Standards & Inquiries — Unboxed Two-Column Layout */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[var(--kt-concrete)]/40 md:divide-x md:divide-[var(--kt-concrete)]/40">
        <div className="space-y-4 md:pr-6">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Network Profile
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
            Enquiry Checklist
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

      {/* Detail Media Frames */}
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
