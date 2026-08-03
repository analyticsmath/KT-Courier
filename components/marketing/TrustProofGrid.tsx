import { trustProofs, type TrustProof, type VisualTone } from "@/lib/constants/homepage-visuals";

const toneClasses: Record<VisualTone, { tile: string; icon: string }> = {
  blue: {
    tile: "bg-[var(--kt-blue-soft)]",
    icon: "bg-[var(--kt-brand-blue)] text-white",
  },
  amber: {
    tile: "bg-[var(--kt-amber-soft)]",
    icon: "bg-[var(--kt-amber)] text-[var(--kt-brand-navy)]",
  },
  mint: {
    tile: "bg-[var(--kt-mint-soft)]",
    icon: "bg-[var(--kt-green)] text-white",
  },
  lavender: {
    tile: "bg-[var(--kt-lavender-soft)]",
    icon: "bg-[var(--kt-violet)] text-white",
  },
  cyan: {
    tile: "bg-[var(--kt-cyan-soft)]",
    icon: "bg-[var(--kt-brand-navy)] text-white",
  },
};

function ProofIcon({ proof }: { proof: TrustProof }) {
  const title = proof.title.toLowerCase();
  const icon = title.includes("pickup")
    ? "M7 7h10M7 12h10M7 17h6"
    : title.includes("status")
    ? "M4 12h4l3 7 4-14 2 7h3"
    : title.includes("admin")
    ? "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z"
    : title.includes("accounts")
    ? "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0"
    : "M4 7l8 6 8-6M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z";

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
    </svg>
  );
}

export function TrustProofGrid() {
  return (
    <section className="bg-[var(--kt-lavender-soft)] py-16 sm:py-24">
      <div className="container-public">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="text-xs font-extrabold uppercase text-[var(--kt-brand-blue)]">
              Trust and operations
            </p>
            <h2 className="mt-3 font-display text-3xl font-black tracking-normal text-[var(--kt-brand-navy)] text-balance sm:text-5xl">
              Trust comes from clear details and steady status updates.
            </h2>
            <p className="mt-5 text-base leading-8 text-[var(--kt-text-soft)]">
              KT Couriers keeps delivery management practical for customers, stores and admin users.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {trustProofs.map((proof, index) => {
              const tone = toneClasses[proof.tone];
              return (
                <article
                  key={proof.title}
                  className={`rounded-[1.7rem] p-5 kt-card-shadow ${tone.tile} ${
                    index === 0 ? "sm:col-span-2" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                      <ProofIcon proof={proof} />
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-black tracking-normal text-[var(--kt-brand-navy)]">
                        {proof.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--kt-text-soft)]">{proof.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
