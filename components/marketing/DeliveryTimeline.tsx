const steps = [
  {
    label: "Request",
    title: "Send the delivery request",
    description: "Add pickup and drop off details. Include parcel notes and timing.",
    status: "Request sent",
  },
  {
    label: "Pickup",
    title: "Confirm pickup details",
    description: "KT Couriers reviews the order before fulfillment starts.",
    status: "Pickup planned",
  },
  {
    label: "Status",
    title: "Follow delivery status",
    description: "Status updates keep the delivery visible through completion.",
    status: "Delivered",
  },
];

function StepIcon({ index }: { index: number }) {
  const paths = [
    "M5 5h14v14H5z M8 9h8M8 13h5",
    "M4 9h16M6 9l1 10h10l1-10M9 9V6a3 3 0 0 1 6 0v3",
    "M5 12l4 4L19 6",
  ];

  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={paths[index]} />
    </svg>
  );
}

export function DeliveryTimeline() {
  return (
    <section className="relative overflow-hidden bg-[var(--kt-canvas-cool)] py-16 sm:py-24">
      <div className="absolute inset-0 kt-route-pattern opacity-70" aria-hidden="true" />
      <div className="container-public relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase text-[var(--kt-brand-blue)]">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal text-[var(--kt-brand-navy)] text-balance sm:text-5xl">
            A clear path from delivery request to drop off.
          </h2>
        </div>

        <div className="relative mt-12">
          <svg
            className="absolute left-0 right-0 top-20 hidden h-24 w-full lg:block"
            viewBox="0 0 1100 120"
            fill="none"
            aria-hidden="true"
          >
            <path
              className="animate-kt-route-draw"
              d="M72 70C230 8 353 110 512 56C680 -1 784 27 1028 62"
              stroke="var(--kt-brand-blue)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="10 14"
            />
          </svg>

          <div className="grid gap-5 lg:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.label}
                className={`relative rounded-3xl bg-[var(--kt-surface)] p-6 kt-card-shadow ring-1 ring-[var(--kt-border)] ${
                  index === 1 ? "lg:mt-14" : index === 2 ? "lg:mt-4" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--kt-brand-navy)] text-white shadow-lg">
                    <StepIcon index={index} />
                  </div>
                  <span className="rounded-full bg-[var(--kt-amber-soft)] px-3 py-1 text-xs font-extrabold text-[var(--kt-copper-flame)]">
                    {step.status}
                  </span>
                </div>
                <p className="mt-8 text-xs font-extrabold uppercase text-[var(--kt-brand-blue)]">
                  0{index + 1} / {step.label}
                </p>
                <h3 className="mt-2 font-display text-2xl font-black tracking-normal text-[var(--kt-brand-navy)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--kt-text-soft)]">{step.description}</p>

                <div className="mt-6 rounded-2xl bg-[var(--kt-surface-muted)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--kt-green)]" aria-hidden="true" />
                    <span className="text-xs font-extrabold uppercase text-[var(--kt-text-muted)]">
                      Order status
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[var(--kt-brand-blue)]"
                      style={{ width: `${34 + index * 33}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
