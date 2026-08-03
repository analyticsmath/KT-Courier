import { Button } from "@/components/ui/Button";

interface CTASectionProps {
  headline: string;
  subtext?: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export function CTASection({ headline, subtext, primaryCta, secondaryCta }: CTASectionProps) {
  return (
    <section className="bg-[var(--kt-canvas)] py-16 sm:py-24">
      <div className="container-public">
        <div className="relative overflow-hidden rounded-[2rem] bg-[var(--kt-blue-soft)] p-6 kt-strong-shadow sm:p-10 lg:p-12">
          <div className="absolute inset-0 kt-route-pattern opacity-70" aria-hidden="true" />
          <div
            className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(0deg,rgba(79,70,229,0.14),rgba(79,70,229,0))]"
            aria-hidden="true"
          />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div className="text-center lg:text-left">
              <p className="text-xs font-extrabold uppercase text-[var(--kt-brand-blue)]">
                Start with one delivery
              </p>
              <h2 className="mt-3 font-display text-3xl font-black tracking-normal text-[var(--kt-brand-navy)] text-balance sm:text-5xl">
                {headline}
              </h2>
              {subtext && (
                <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[var(--kt-text-soft)] lg:mx-0">
                  {subtext}
                </p>
              )}
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Button href={primaryCta.href} variant="primary" size="lg" className="min-w-48 kt-card-shadow">
                  {primaryCta.label}
                </Button>
                {secondaryCta && (
                  <Button
                    href={secondaryCta.href}
                    variant="secondary"
                    size="lg"
                    className="min-w-48 bg-white/90 shadow-sm"
                  >
                    {secondaryCta.label}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Delivery request", "Pickup and drop off details"],
                ["Business account", "Repeat store delivery"],
                ["Order status", "Progress stays visible"],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-[1.4rem] bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-[var(--kt-amber)]" aria-hidden="true" />
                    <p className="text-sm font-extrabold text-[var(--kt-brand-navy)]">{title}</p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kt-text-muted)]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
