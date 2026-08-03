import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { heroStatusItems, heroTrustChips, storyImages } from "@/lib/constants/homepage-visuals";

const heroImages = [storyImages[0], storyImages[1], storyImages[5]];

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 5.292a1 1 0 0 1 .004 1.414l-7.88 7.93a1 1 0 0 1-1.42.002L3.29 10.48a1 1 0 1 1 1.42-1.408l3.408 3.44 7.17-7.216a1 1 0 0 1 1.416-.004Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DeliveryRequestCard() {
  return (
    <div className="rounded-3xl bg-[var(--kt-surface)] p-5 kt-card-shadow ring-1 ring-[var(--kt-border)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-bold uppercase text-[var(--kt-text-muted)]">
            Delivery request
          </p>
          <h3 className="mt-1 font-display text-lg font-extrabold text-[var(--kt-brand-navy)]">
            Store pickup today
          </h3>
        </div>
        <span className="rounded-full bg-[var(--kt-green-soft)] px-3 py-1 text-xs font-bold text-[var(--kt-green)]">
          Received
        </span>
      </div>

      <div className="space-y-3">
        {[
          ["Pickup", "Local store counter"],
          ["Drop off", "Customer address"],
          ["Parcel", "Packed order"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-[var(--kt-surface-muted)] px-4 py-3 ring-1 ring-white">
            <p className="text-[0.7rem] font-bold uppercase text-[var(--kt-text-muted)]">
              {label}
            </p>
            <p className="mt-0.5 text-sm font-bold text-[var(--kt-brand-navy)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--kt-blue-soft)] p-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--kt-brand-blue)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--kt-brand-blue)]">
            <CheckIcon />
          </span>
          Ready for admin review
        </div>
      </div>
    </div>
  );
}

function RouteStatusCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[var(--kt-brand-navy)] p-5 text-white kt-strong-shadow sm:p-6">
      <div className="absolute inset-0 kt-route-pattern opacity-20" aria-hidden="true" />
      <div
        className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(37,99,235,0.22),rgba(37,99,235,0))]"
        aria-hidden="true"
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-bold uppercase text-white/70">
              Delivery board
            </p>
            <h3 className="mt-1 font-display text-xl font-extrabold">Request to delivery</h3>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
            Order workflow
          </span>
        </div>

        <div className="relative mt-8 min-h-[230px] overflow-hidden rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 260" fill="none" aria-hidden="true">
            <path
              className="animate-kt-route-draw"
              d="M46 188C128 94 182 78 246 132C318 192 364 76 474 88"
              stroke="url(#route-gradient)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <circle cx="46" cy="188" r="10" fill="var(--kt-amber)" />
            <circle cx="474" cy="88" r="10" fill="var(--kt-green)" />
            <defs>
              <linearGradient id="route-gradient" x1="46" y1="188" x2="474" y2="88" gradientUnits="userSpaceOnUse">
                <stop stopColor="var(--kt-amber)" />
                <stop offset="0.52" stopColor="var(--kt-brand-blue)" />
                <stop offset="1" stopColor="var(--kt-green)" />
              </linearGradient>
            </defs>
          </svg>

          <div className="relative z-10 grid h-full min-h-[210px] grid-cols-2 gap-3">
            <div className="self-end rounded-2xl bg-white p-3 text-[var(--kt-brand-navy)] shadow-lg">
              <p className="text-[0.68rem] font-bold uppercase text-[var(--kt-text-muted)]">
                Pickup
              </p>
              <p className="mt-1 text-sm font-extrabold">Ready at store</p>
              <span className="mt-3 inline-flex rounded-full bg-[var(--kt-amber-soft)] px-2.5 py-1 text-xs font-bold text-[var(--kt-copper-flame)]">
                Scheduled
              </span>
            </div>
            <div className="self-start justify-self-end rounded-2xl bg-white p-3 text-[var(--kt-brand-navy)] shadow-lg">
              <p className="text-[0.68rem] font-bold uppercase text-[var(--kt-text-muted)]">
                Drop off
              </p>
              <p className="mt-1 text-sm font-extrabold">Customer handoff</p>
              <span className="mt-3 inline-flex rounded-full bg-[var(--kt-green-soft)] px-2.5 py-1 text-xs font-bold text-[var(--kt-green)]">
                Delivered
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {heroStatusItems.map((status, index) => (
            <div key={status} className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
              <p className="text-[0.65rem] font-bold uppercase text-white/60">
                0{index + 1}
              </p>
              <p className="mt-0.5 text-xs font-bold text-white">{status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BusinessMiniCard() {
  return (
    <div className="rounded-3xl bg-[var(--kt-lavender-soft)] p-5 kt-card-shadow ring-1 ring-[var(--kt-border)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.68rem] font-bold uppercase text-[var(--kt-text-muted)]">
            Business courier
          </p>
          <h3 className="mt-1 font-display text-lg font-extrabold text-[var(--kt-brand-navy)]">
            Store delivery flow
          </h3>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--kt-brand-navy)] text-white">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M5 7l1 13h12l1-13M9 7V5a3 3 0 0 1 6 0v2" />
          </svg>
        </span>
      </div>
      <div className="mt-5 space-y-3">
        <div className="rounded-2xl bg-white/75 p-3">
          <p className="text-xs font-bold text-[var(--kt-text-muted)]">Saved pickup address</p>
          <p className="mt-1 text-sm font-extrabold text-[var(--kt-brand-navy)]">Dispatch counter</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/75 p-3">
            <p className="text-xs font-bold text-[var(--kt-text-muted)]">Active orders</p>
            <p className="mt-1 text-sm font-extrabold text-[var(--kt-brand-navy)]">Status view</p>
          </div>
          <div className="rounded-2xl bg-white/75 p-3">
            <p className="text-xs font-bold text-[var(--kt-text-muted)]">History</p>
            <p className="mt-1 text-sm font-extrabold text-[var(--kt-brand-navy)]">Repeat flow</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroImageTile() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {heroImages.map((image, index) => (
        <div
          key={image.title}
          className={`group relative overflow-hidden rounded-[1.5rem] kt-card-shadow ${
            index === 0 ? "aspect-[5/4]" : index === 1 ? "mt-8 aspect-[4/5]" : "col-span-2 aspect-[16/9]"
          }`}
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 220px, 45vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 kt-image-overlay" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <p className="text-xs font-bold uppercase text-white/70">{image.label}</p>
            <p className="mt-1 text-sm font-extrabold">{image.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FloatingImageCard({ image, className }: { image: (typeof storyImages)[number]; className: string }) {
  return (
    <div
      className={`pointer-events-none absolute hidden overflow-hidden rounded-[1.35rem] bg-white p-2 kt-card-shadow ring-1 ring-[var(--kt-border)] xl:block ${className}`}
      aria-hidden="true"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1rem]">
        <Image
          src={image.src}
          alt=""
          fill
          sizes="180px"
          className="object-cover"
        />
        <div className="absolute inset-0 kt-image-overlay" />
      </div>
      <p className="px-2 pb-1 pt-2 text-xs font-extrabold text-[var(--kt-brand-navy)]">
        {image.label}
      </p>
    </div>
  );
}

export function PremiumHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--kt-canvas)] pt-12 pb-10 sm:pt-20 sm:pb-16 lg:pt-20">
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,var(--kt-polar-white)_0%,var(--kt-cloud-blue)_62%,var(--kt-studio-white)_100%)]"
        aria-hidden="true"
      />
      <div className="absolute inset-0 kt-route-pattern opacity-55" aria-hidden="true" />
      <svg
        className="absolute left-1/2 top-[21rem] hidden h-56 w-[54rem] -translate-x-1/2 text-[var(--kt-brand-blue)] opacity-20 lg:block"
        viewBox="0 0 860 220"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M20 134C130 42 231 189 338 103C470 -3 548 159 661 86C735 38 782 50 840 91"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="10 14"
        />
      </svg>

      <div className="container-public relative z-10">
        <FloatingImageCard image={storyImages[0]} className="left-8 top-28 w-44 -rotate-6" />
        <FloatingImageCard image={storyImages[5]} className="right-10 top-48 w-48 rotate-3" />

        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-xs font-extrabold uppercase text-[var(--kt-brand-blue)] shadow-sm ring-1 ring-[var(--kt-border)]">
            Courier services for customers and local businesses
          </p>
          <h1 className="mt-6 font-display text-[2.72rem] font-black leading-[0.98] tracking-normal text-[var(--kt-brand-navy)] text-balance sm:text-6xl lg:text-7xl">
            <span className="block">Delivery clarity</span>{" "}
            <span className="block">for customers stores</span>{" "}
            <span className="block">and local business</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[var(--kt-text-soft)] sm:text-lg sm:leading-8">
            Request deliveries. Manage orders. Follow every step from pickup to drop off.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/account/request-delivery" variant="primary" size="lg" className="min-w-52 kt-card-shadow">
              Request a Delivery
            </Button>
            <Button href="/signup" variant="secondary" size="lg" className="min-w-52 bg-white/90 shadow-sm">
              Open Business Account
            </Button>
          </div>
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2" aria-label="Platform support">
            {heroTrustChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1.5 text-xs font-bold text-[var(--kt-text-soft)] shadow-sm ring-1 ring-[var(--kt-border)]"
              >
                <span className="text-[var(--kt-green)]">
                  <CheckIcon />
                </span>
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto mt-9 max-w-6xl sm:mt-10 lg:mt-12">
          <div className="relative grid gap-5 lg:grid-cols-[0.86fr_1.28fr_0.86fr] lg:items-center">
            <div className="space-y-5 lg:-mr-4 lg:pt-8">
              <DeliveryRequestCard />
              <div className="hidden lg:block animate-kt-float-slow">
                <HeroImageTile />
              </div>
            </div>

            <div className="order-first lg:order-none">
              <RouteStatusCard />
            </div>

            <div className="space-y-5 lg:-ml-4 lg:pb-8">
              <div className="lg:hidden">
                <HeroImageTile />
              </div>
              <BusinessMiniCard />
              <div className="rounded-3xl bg-white p-4 kt-card-shadow ring-1 ring-[var(--kt-border)]">
                <p className="text-[0.68rem] font-bold uppercase text-[var(--kt-text-muted)]">
                  Delivery management
                </p>
                <div className="mt-3 space-y-2">
                  {["Customer request", "Store update", "Status review"].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-2xl bg-[var(--kt-surface-muted)] px-3 py-2 text-sm font-bold text-[var(--kt-brand-navy)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--kt-brand-blue)]" aria-hidden="true" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
