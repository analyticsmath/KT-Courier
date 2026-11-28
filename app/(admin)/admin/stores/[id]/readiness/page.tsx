import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStorePickupOperationalPreflight } from "@/lib/admin/store-pickup-preflight.service";
import { evaluateStoreCheckoutCapabilityPreflight } from "@/lib/admin/store-checkout-certification.service";
import { CHECKOUT_CAPABILITY_BLOCKER_MESSAGES } from "@/lib/admin/store-operational-preflight";
import { diagnoseStoreOffersSellability } from "@/lib/admin/store-offer-diagnostics.service";
import { StoreOfferDiagnosticsPanel } from "@/components/admin/StoreOfferDiagnosticsPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store pickup preflight" };

const BLOCKER_LABELS: Record<string, string> = {
  STORE_ACCOUNT_PAUSED: "Store account is paused or disabled.",
  STORE_CONTACT_MISSING: "Add the store's business email or phone.",
  PICKUP_ADDRESS_MISSING: "Save a complete courier collection address in the store's own account.",
  PICKUP_SUBURB_MISSING: "Add the pickup suburb or area.",
  PICKUP_POSTAL_CODE_MISSING: "Add a valid four-digit postal code to the collection address.",
  PICKUP_MAP_LOCATION_MISSING: "Confirm the collection location on the map.",
  PICKUP_COVERAGE_UNVERIFIED: "The saved pickup is not confirmed within enabled coverage. Review regions and geocoding.",
  ACTIVE_COURIER_SERVICE_MISSING: "No active courier service currently includes this pickup region.",
  ...CHECKOUT_CAPABILITY_BLOCKER_MESSAGES,
};
const REMAINING_LABELS: Record<string, string> = {
  TRADING_HOURS_NOT_CONFIRMED: "Trading hours have not been saved in structured format yet.",
  TRADING_HOURS_INVALID: "Saved trading hours failed structured validation; save valid trading hours in Store settings.",
  DESTINATION_ROUTE_NOT_TESTED: "No buyer destination and actual road route have been tested.",
  CHECKOUT_NOT_TESTED: "Marketplace checkout and payment have not been certified.",
};

export default async function StorePickupPreflightPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.STORES_READ);
  const { id } = await params;
  const [report, capabilityPreflight, offerDiagnostics] = await Promise.all([
    getStorePickupOperationalPreflight(id),
    evaluateStoreCheckoutCapabilityPreflight(id),
    diagnoseStoreOffersSellability(id),
  ]);
  if (!report) notFound();

  const liveRouteVerified = Boolean(capabilityPreflight?.routeFeasibility.verified ?? report.routeVerified);
  const liveCheckoutCertified =
    capabilityPreflight?.independentReviewerStatus === "APPROVED_CURRENT" || report.checkoutCertified;

  return <ProtectedPageFrame>
    <ProtectedPageHeader title="Store collection preflight" description="Read-only operational evidence for saved collection address, structured trading hours, and courier pickup region." />
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" href={`/admin/stores/${encodeURIComponent(id)}`}>Back to store dossier</Link>
    <OperationalPanel title={report.stage === "PICKUP_AREA_READY" && liveCheckoutCertified ? "Pickup region verified & checkout certification current" : report.stage === "PICKUP_AREA_READY" ? "Pickup region verified — checkout or route checks pending" : report.stage === "PAUSED" ? "Store paused" : "Store setup requires review"} description="A positive pickup-area check alone does not confirm physical premises attendance, road routes to buyers, seller approval, stock, tariff or payment.">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm">Account status</dt><dd className="font-semibold">{report.accountStatus}</dd></div>
        <div><dt className="text-sm">Collection assessment</dt><dd className="font-semibold">{report.stage.replaceAll("_", " ")}</dd></div>
        <div><dt className="text-sm">Pickup region</dt><dd className="font-semibold">{report.pickupRegionName ?? "Not independently confirmed"}</dd></div>
        <div><dt className="text-sm">Matching active courier services</dt><dd className="font-semibold">{report.matchingServiceCount}</dd></div>
        <div>
          <dt className="text-sm">Structured trading hours</dt>
          <dd className="font-semibold">
            {report.operatingHoursState.status === "CONFIGURED"
              ? `Configured (${report.operatingHoursState.summary ?? "SAST schedule saved"})`
              : report.operatingHoursState.status === "INVALID"
                ? "Malformed schedule JSON (repair required)"
                : "Not saved"}
          </dd>
          <dd className="text-xs text-[var(--kt-text-soft)]">
            Independent review recorded: {report.operatingHoursState.independentReviewRecorded ? "Yes" : "No"} · Physical premises check: Not claimed
          </dd>
        </div>
        <div>
          <dt className="text-sm">Route &amp; checkout state</dt>
          <dd className="font-semibold">
            Route: {liveRouteVerified ? "Verified" : "Not tested"} · Checkout: {liveCheckoutCertified ? "Certified" : "Not certified"}
          </dd>
        </div>
      </dl>
      {report.blockers.length ? <section className="mt-5"><h2 className="font-semibold">Required corrections</h2><ul className="mt-2 list-disc space-y-1 pl-5">{report.blockers.map(code => <li key={code}>{BLOCKER_LABELS[code] ?? code}</li>)}</ul></section> : <p className="mt-4">Pickup evidence is recorded for the current active service area. Inspect any remaining checks below.</p>}
      {report.outstandingChecks.length > 0 ? <section className="mt-5"><h2 className="font-semibold">Remaining verification checks</h2><ul className="mt-2 list-disc space-y-1 pl-5">{report.outstandingChecks.map(code => <li key={code}>{REMAINING_LABELS[code] ?? code}</li>)}</ul></section> : null}
    </OperationalPanel>
    {capabilityPreflight ? (
      <OperationalPanel title={capabilityPreflight.liveReady ? "Checkout capability preflight: Ready & independently certified" : capabilityPreflight.preflightReady ? "Checkout capability preflight: Ready for independent certification review" : "Checkout capability preflight: Blockers detected"} description="Canonical non-mutating CheckoutCapabilityPreflight evaluated against current pickup, seller identity, coverage, route feasibility, operational/commission policies and payment provider readiness.">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm">Preflight capability ready</dt><dd className="font-semibold">{capabilityPreflight.preflightReady ? "YES" : "NO"}</dd></div>
          <div><dt className="text-sm">Independent reviewer status</dt><dd className="font-semibold">{capabilityPreflight.independentReviewerStatus}</dd></div>
          <div><dt className="text-sm">Route feasibility</dt><dd className="font-semibold">{capabilityPreflight.routeFeasibility.verified ? `Verified (${capabilityPreflight.routeFeasibility.provider ?? "route"})` : "Unverified"}</dd></div>
          <div><dt className="text-sm">Payment provider readiness</dt><dd className="font-semibold">{capabilityPreflight.policySummary.paymentProviderReady ? `Ready (${capabilityPreflight.policySummary.paymentProviderEnvironment ?? "configured"})` : "Not ready"}</dd></div>
          <div><dt className="text-sm">Engine proof suite SHA</dt><dd className="font-mono text-xs">{capabilityPreflight.engineProofSuiteSha.slice(0, 16)}…</dd></div>
          {capabilityPreflight.certificationProvenance ? (
            <div>
              <dt className="text-sm">Certification provenance</dt>
              <dd className="font-semibold">{capabilityPreflight.certificationProvenance.evidenceType.replaceAll("_", " ")}</dd>
              {capabilityPreflight.certificationProvenance.engineProofReference ? (
                <dd className="font-mono text-xs">{capabilityPreflight.certificationProvenance.engineProofReference}</dd>
              ) : null}
            </div>
          ) : null}
        </dl>
        {capabilityPreflight.certificationProvenance?.stageResults?.length ? (
          <section className="mt-5">
            <h2 className="font-semibold">Recorded engine proof stages</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {capabilityPreflight.certificationProvenance.stageResults.map((stage) => (
                <li key={stage.stage}>
                  <span className={stage.passed ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                    {stage.passed ? "PASS" : "FAIL"}
                  </span>{" "}
                  <span className="font-mono text-xs">{stage.stage}</span>: {stage.summary}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {capabilityPreflight.blockers.length > 0 ? (
          <section className="mt-5">
            <h2 className="font-semibold">Capability and certification blockers</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {capabilityPreflight.blockers.map((code) => (
                <li key={code}>
                  <span className="font-mono text-xs font-semibold">{code}</span>:{" "}
                  {capabilityPreflight.blockerMessages[code] ?? BLOCKER_LABELS[code] ?? code}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold underline underline-offset-4">
              <Link href={`/admin/stores/${encodeURIComponent(id)}`}>Review store dossier & certification</Link>
              <Link href="/admin/settings">Review policies & payment settings</Link>
            </div>
          </section>
        ) : null}
      </OperationalPanel>
    ) : null}
    {offerDiagnostics ? <StoreOfferDiagnosticsPanel report={offerDiagnostics} /> : null}
    <p className="text-sm">No store status or payment data is changed by this check.</p>
  </ProtectedPageFrame>;
}
