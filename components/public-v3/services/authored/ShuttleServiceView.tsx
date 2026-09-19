import Image from "next/image";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import type { AuthoredServiceViewProps } from "./types";

export function ShuttleServiceView({ service }: AuthoredServiceViewProps) {
  const mediaSet = ktMediaV3.pages.services.shuttle;
  const heroMedia = mediaSet.primary;
  const detailMediaItems = [mediaSet.secondary, mediaSet.detail];

  return (
    <div className="space-y-16">
      {/* Planned Shuttle Hero Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-brand-blue-accessible)] font-semibold">
              Scheduled Route Transport
            </span>
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
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] font-bold text-xs uppercase tracking-wider hover:bg-[#23272B] transition-colors"
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
          <div className="relative aspect-[4/3] w-full bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/60 overflow-hidden">
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

      {/* Route Coordination Notice */}
      <section className="p-6 bg-white/70 border border-[var(--kt-concrete)]/60 space-y-2">
        <h3 className="font-display text-lg font-bold text-[var(--kt-asphalt)]">
          Commercial Hub-to-Hub Transport
        </h3>
        <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed">
          Shuttle movements are coordinated directly between confirmed commercial facilities and pickup points. There are no public passenger schedules or fixed timetables. Availability and timing are established during the quote review process.
        </p>
      </section>

      {/* Workflow */}
      <section className="space-y-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--kt-road-grey)] block mb-2">
            Movement Planning
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--kt-asphalt)]">
            How shuttle routes are confirmed
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {service.process.map((step, idx) => (
            <div
              key={idx}
              className="p-6 bg-white/60 border border-[var(--kt-concrete)]/60 space-y-3"
            >
              <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">
                Step 0{idx + 1}
              </span>
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

      {/* Suitable Items & Scheduling Guide */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-[var(--kt-concrete)]/40">
        <div className="p-8 bg-white/60 border border-[var(--kt-concrete)]/60 space-y-4">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Suitable Shuttle Requests
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

        <div className="p-8 bg-white/60 border border-[var(--kt-concrete)]/60 space-y-4">
          <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)]">
            Scheduling Preparation
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

      {/* Detail Media Mosaic */}
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
