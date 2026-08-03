import Image from "next/image";
import Link from "next/link";
import { serviceStories, storyImages, type ServiceStory, type VisualTone } from "@/lib/constants/homepage-visuals";

const toneClasses: Record<VisualTone, { panel: string; icon: string; chip: string; text: string }> = {
  blue: {
    panel: "bg-[var(--kt-blue-soft)]",
    icon: "bg-[var(--kt-brand-blue)] text-white",
    chip: "bg-white/80 text-[var(--kt-brand-blue)]",
    text: "text-[var(--kt-brand-blue)]",
  },
  amber: {
    panel: "bg-[var(--kt-amber-soft)]",
    icon: "bg-[var(--kt-amber)] text-[var(--kt-brand-navy)]",
    chip: "bg-white/80 text-[var(--kt-copper-flame)]",
    text: "text-[var(--kt-copper-flame)]",
  },
  mint: {
    panel: "bg-[var(--kt-mint-soft)]",
    icon: "bg-[var(--kt-green)] text-white",
    chip: "bg-white/80 text-[var(--kt-green)]",
    text: "text-[var(--kt-green)]",
  },
  lavender: {
    panel: "bg-[var(--kt-lavender-soft)]",
    icon: "bg-[var(--kt-violet)] text-white",
    chip: "bg-white/80 text-[var(--kt-violet)]",
    text: "text-[var(--kt-violet)]",
  },
  cyan: {
    panel: "bg-[var(--kt-cyan-soft)]",
    icon: "bg-[var(--kt-brand-navy)] text-white",
    chip: "bg-white/80 text-[var(--kt-cyan)]",
    text: "text-[var(--kt-cyan)]",
  },
};

function ServiceIcon({ title }: { title: string }) {
  if (title.includes("Same")) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 3 4 14h7l-1 7 10-12h-7l0-6Z" />
      </svg>
    );
  }

  if (title.includes("Scheduled")) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M5 11h14M7 5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      </svg>
    );
  }

  if (title.includes("Business")) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 20V6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v14M4 20h16M8 8h5m-5 4h5m-5 4h2m7-6h1a2 2 0 0 1 2 2v8" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 8.5 12 3 3 8.5m18 0-9 5.5m9-5.5v7L12 21m0-7L3 8.5m9 5.5v7M3 8.5v7L12 21" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3 10a1 1 0 0 1 1-1h9.586l-3.293-3.293a1 1 0 1 1 1.414-1.414l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L13.586 11H4a1 1 0 0 1-1-1Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ServiceCard({ service }: { service: ServiceStory }) {
  const tone = toneClasses[service.tone];
  const isFeatured = service.layout === "featured";
  const isPanel = service.layout === "panel";
  const isImage = service.layout === "image";

  return (
    <article
      className={`relative overflow-hidden rounded-3xl p-6 transition-transform duration-200 hover:-translate-y-1 ${
        isFeatured
          ? "lg:col-span-2 lg:row-span-2 bg-[var(--kt-brand-navy)] text-white kt-strong-shadow"
          : isPanel
          ? "bg-[var(--kt-brand-blue)] text-white kt-card-shadow"
          : `${tone.panel} kt-card-shadow`
      }`}
    >
      {isImage && (
        <div className="absolute inset-0">
          <Image
            src={storyImages[2].src}
            alt=""
            fill
            sizes="(min-width: 1024px) 360px, 90vw"
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-[var(--kt-brand-navy)] opacity-80" aria-hidden="true" />
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isFeatured || isPanel || isImage ? "bg-white/15 text-white" : tone.icon}`}>
            <ServiceIcon title={service.title} />
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${isFeatured || isPanel || isImage ? "bg-white/15 text-white" : tone.chip}`}>
            {service.eyebrow}
          </span>
        </div>

        <div className={`${isFeatured ? "mt-12" : "mt-8"}`}>
          <h3 className={`font-display font-black tracking-normal ${isFeatured ? "max-w-md text-3xl sm:text-4xl" : "text-2xl"} ${isImage ? "text-white" : ""}`}>
            {service.title}
          </h3>
          <p className={`mt-4 max-w-xl text-sm leading-7 ${isFeatured || isPanel || isImage ? "text-white/80" : "text-[var(--kt-text-soft)]"}`}>
            {service.description}
          </p>
        </div>

        {isFeatured && (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Request", "Coordinate", "Update"].map((label, index) => (
              <div key={label} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <p className="text-xs font-extrabold uppercase text-white/50">0{index + 1}</p>
                <p className="mt-2 text-sm font-extrabold text-white">{label}</p>
              </div>
            ))}
          </div>
        )}

        <Link
          href={service.href}
          className={`mt-8 inline-flex items-center gap-2 text-sm font-extrabold transition-colors ${
            isFeatured || isPanel || isImage ? "text-white hover:text-white/80" : `${tone.text} hover:text-[var(--kt-brand-navy)]`
          }`}
        >
          {service.cta}
          <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}

export function ServiceStoryGrid() {
  return (
    <section className="bg-[var(--kt-canvas)] py-16 sm:py-24">
      <div className="container-public">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase text-[var(--kt-brand-blue)]">
              Courier services South Africa
            </p>
            <h2 className="mt-3 font-display text-3xl font-black tracking-normal text-[var(--kt-brand-navy)] text-balance sm:text-5xl">
              Local delivery services for everyday delivery work.
            </h2>
          </div>
          <p className="text-base leading-8 text-[var(--kt-text-soft)]">
            Request parcel delivery, store delivery or scheduled delivery through one clear workflow.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-4 lg:auto-rows-[minmax(240px,auto)]">
          {serviceStories.map((service) => (
            <ServiceCard key={service.title} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}
