import Link from "next/link";

export function QaSandboxBanner({
  persona,
  description,
  ctaHref,
  ctaLabel,
  nonWithdrawable = false,
}: {
  persona: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
  nonWithdrawable?: boolean;
}) {
  return (
    <aside
      role="note"
      aria-label="Isolated QA sandbox warning"
      className="mb-4 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold uppercase tracking-wide text-amber-900">
            QA SANDBOX — NON-COMMERCIAL{nonWithdrawable ? " / NON-WITHDRAWABLE" : ""} ({persona})
          </p>
          <p className="mt-0.5 text-xs text-amber-900">
            {description ??
              "This account is operating inside the isolated Issue #40 QA acceptance lane. Transactions use Paystack test mode and settle strictly into isolated sandbox ledger accounts excluded from commercial metrics."}
          </p>
        </div>
        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className="shrink-0 rounded-lg border border-amber-700 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
