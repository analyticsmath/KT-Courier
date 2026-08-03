import { Button } from "@/components/ui/Button";

function MiniStatus({ label, tone = "blue" }: { label: string; tone?: "blue" | "amber" | "green" }) {
  const classes = {
    blue: "bg-[var(--kt-blue-soft)] text-[var(--kt-brand-blue)]",
    amber: "bg-[var(--kt-amber-soft)] text-[var(--kt-copper-flame)]",
    green: "bg-[var(--kt-green-soft)] text-[var(--kt-green)]",
  };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${classes[tone]}`}>{label}</span>;
}

export function BusinessOperationsPanel() {
  return (
    <section className="bg-[var(--kt-canvas)] py-16 sm:py-24">
      <div className="container-public">
        <div className="relative overflow-hidden rounded-[2rem] bg-[var(--kt-brand-navy)] p-5 text-white kt-strong-shadow sm:p-8 lg:p-10">
          <div className="absolute inset-0 kt-route-pattern opacity-20" aria-hidden="true" />
          <div
            className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(37,99,235,0.24),rgba(37,99,235,0))]"
            aria-hidden="true"
          />

          <div className="relative z-10 grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase text-white/70">
                For stores and local businesses
              </p>
              <h2 className="mt-3 font-display text-3xl font-black tracking-normal text-white text-balance sm:text-5xl">
                Store delivery work without loose message threads.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-white/75">
                Business accounts help stores request deliveries, reuse pickup details and review order history.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button href="/signup" variant="primary" size="lg" className="bg-white text-[var(--kt-brand-navy)] hover:bg-[var(--kt-amber-soft)]">
                  Open Business Account
                </Button>
                <Button href="/contact" variant="secondary" size="lg" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                  Talk to KT Couriers
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.7rem] bg-white p-5 text-[var(--kt-brand-navy)] kt-card-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-[var(--kt-text-muted)]">
                      Repeat delivery
                    </p>
                    <h3 className="mt-2 font-display text-xl font-black">Request card</h3>
                  </div>
                  <MiniStatus label="Draft" tone="amber" />
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-[var(--kt-surface-muted)] p-3">
                    <p className="text-xs font-bold text-[var(--kt-text-muted)]">Pickup</p>
                    <p className="text-sm font-extrabold">Saved store address</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--kt-surface-muted)] p-3">
                    <p className="text-xs font-bold text-[var(--kt-text-muted)]">Drop off</p>
                    <p className="text-sm font-extrabold">Customer location</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.7rem] bg-[var(--kt-mint-soft)] p-5 text-[var(--kt-brand-navy)] kt-card-shadow sm:mt-10">
                <p className="text-xs font-extrabold uppercase text-[var(--kt-green)]">
                  Saved pickup
                </p>
                <h3 className="mt-2 font-display text-xl font-black">Store dispatch point</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--kt-text-soft)]">
                  Keep repeat pickup details consistent for store staff.
                </p>
                <div className="mt-5 rounded-2xl bg-white/80 p-3">
                  <p className="text-xs font-bold text-[var(--kt-text-muted)]">Address reference</p>
                  <p className="mt-1 text-sm font-extrabold">Primary pickup counter</p>
                </div>
              </div>

              <div className="rounded-[1.7rem] bg-[var(--kt-blue-soft)] p-5 text-[var(--kt-brand-navy)] kt-card-shadow">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase text-[var(--kt-brand-blue)]">
                    Active orders
                  </p>
                  <MiniStatus label="Status view" />
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ["KT order", "Pickup scheduled", "amber"],
                    ["KT order", "Out for delivery", "blue"],
                    ["KT order", "Delivered", "green"],
                  ].map(([name, status, tone]) => (
                    <div key={`${name}-${status}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 p-3">
                      <p className="text-sm font-extrabold">{name}</p>
                      <MiniStatus label={status} tone={tone as "blue" | "amber" | "green"} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] bg-[var(--kt-amber-soft)] p-5 text-[var(--kt-brand-navy)] kt-card-shadow sm:-mt-4">
                <p className="text-xs font-extrabold uppercase text-[var(--kt-copper-flame)]">
                  Order history
                </p>
                <h3 className="mt-2 font-display text-xl font-black">Repeat visibility</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--kt-text-soft)]">
                  Completed deliveries remain available for later reference.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/80 p-3">
                    <p className="text-xs font-bold text-[var(--kt-text-muted)]">Details</p>
                    <p className="text-sm font-extrabold">Pickup/drop off</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-3">
                    <p className="text-xs font-bold text-[var(--kt-text-muted)]">Records</p>
                    <p className="text-sm font-extrabold">Status history</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
