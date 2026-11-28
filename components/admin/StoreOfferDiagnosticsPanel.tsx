import Link from "next/link";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import type { StoreOfferDiagnosticsReport } from "@/lib/admin/store-offer-diagnostics.service";

export function StoreOfferDiagnosticsPanel({
  report,
}: {
  report: StoreOfferDiagnosticsReport;
}) {
  return (
    <OperationalPanel
      title="Offer sellability & packaging predicate diagnostics"
      description="Read-only per-offer inspection against publication, pricing, media, stock, parcel profile, and trusted packaging rules. Never substitutes for checkout certification."
      action={
        <ProtectedStatus
          label={`${report.sellableCount} / ${report.totalOffers} SELLABLE`}
          tone={report.sellableCount > 0 ? "success" : "warning"}
        />
      }
    >
      {report.trustedPackageLoadIssuesCount > 0 ? (
        <p className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Warning: {report.trustedPackageLoadIssuesCount} legacy or malformed{" "}
          <code className="font-mono">production_marketplace_trusted_packages_v*</code> record(s)
          failed schema validation and were isolated from classification.
        </p>
      ) : null}

      {report.offers.length === 0 ? (
        <p className="text-sm text-[var(--kt-text-soft)]">
          This store has no non-archived offers yet.
        </p>
      ) : (
        <div className="space-y-4">
          {report.offers.map((offer) => (
            <article
              key={offer.offerReference}
              className="rounded-xl border border-[var(--kt-border)] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--kt-brand-navy)]">
                    {offer.title} · {offer.variantTitle}
                  </h3>
                  <p className="text-xs text-[var(--kt-text-soft)] font-mono">
                    {offer.offerReference} · SKU {offer.storeSku} · offer rev v{offer.offerVersion} ·{" "}
                    {offer.offerStatus}/{offer.publicationStatus} · {offer.fulfilmentMode}
                  </p>
                </div>
                <ProtectedStatus
                  label={offer.sellableForCheckout ? "SELLABLE_FOR_CHECKOUT" : "BLOCKED"}
                  tone={offer.sellableForCheckout ? "success" : "warning"}
                />
              </div>

              {offer.failedReasonCodes.length > 0 ? (
                <div className="rounded bg-amber-50/70 px-3 py-2 text-xs text-amber-950">
                  <span className="font-semibold">Failed predicates: </span>
                  <span className="font-mono">{offer.failedReasonCodes.join(", ")}</span>
                </div>
              ) : null}

              <ul className="grid gap-2 text-xs sm:grid-cols-2">
                {offer.checks.map((chk) => (
                  <li
                    key={chk.code}
                    className={`rounded border p-2 ${
                      chk.passed
                        ? "border-emerald-200 bg-emerald-50/30"
                        : "border-amber-300 bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-semibold">
                      <span>{chk.label}</span>
                      <span className={chk.passed ? "text-emerald-700" : "text-amber-800"}>
                        {chk.passed ? "PASS" : chk.code}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--kt-text-soft)]">{chk.detail}</p>
                  </li>
                ))}
              </ul>

              <div className="rounded bg-[var(--kt-surface-muted)] p-3 text-xs space-y-1">
                <p>
                  <span className="font-semibold">Vendor declaration: </span>
                  {offer.packaging.declarationPresent
                    ? `${offer.packaging.declarationDimensionsCm} cm · ${offer.packaging.declarationWeightKg} kg (submitted ${offer.packaging.declarationSubmittedAt})`
                    : "None recorded"}
                </p>
                <p>
                  <span className="font-semibold">Trusted package candidates: </span>
                  {offer.packaging.candidateTrustedVersions.length > 0
                    ? offer.packaging.candidateTrustedVersions
                        .map(
                          (v) =>
                            `v${v.version} [${v.status}] offerRev=${v.publicationVersion} (${v.authorityReference})`,
                        )
                        .join(" | ")
                    : "None"}
                </p>
              </div>

              {offer.repairLinks.length > 0 ? (
                <div className="flex flex-wrap gap-3 text-xs font-semibold">
                  {offer.repairLinks.map((lnk) => (
                    <Link
                      key={lnk.href}
                      href={lnk.href}
                      className="text-[var(--kt-brand-blue)] underline underline-offset-4"
                    >
                      Repair: {lnk.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </OperationalPanel>
  );
}
