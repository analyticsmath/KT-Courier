import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStorePickupOperationalPreflight } from "@/lib/admin/store-pickup-preflight.service";
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
};
const REMAINING_LABELS: Record<string, string> = {
  TRADING_HOURS_NOT_CONFIRMED: "Trading hours still require structured verification.",
  DESTINATION_ROUTE_NOT_TESTED: "No buyer destination and actual road route have been tested.",
  CHECKOUT_NOT_TESTED: "Marketplace checkout and payment have not been certified.",
};

export default async function StorePickupPreflightPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.STORES_READ);
  const { id } = await params;
  const report = await getStorePickupOperationalPreflight(id);
  if (!report) notFound();

  return <ProtectedPageFrame>
    <ProtectedPageHeader title="Store collection preflight" description="Read-only operational evidence for saved collection address and courier pickup region." />
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" href={`/admin/stores/${encodeURIComponent(id)}`}>Back to store dossier</Link>
    <OperationalPanel title={report.stage === "PICKUP_AREA_READY" ? "Pickup region verified — checkout still untested" : report.stage === "PAUSED" ? "Store paused" : "Store setup requires review"} description="A positive pickup-area check does not confirm a road route to a customer, trading hours, seller approval, stock, tariff or payment.">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm">Account status</dt><dd className="font-semibold">{report.accountStatus}</dd></div>
        <div><dt className="text-sm">Collection assessment</dt><dd className="font-semibold">{report.stage.replaceAll("_", " ")}</dd></div>
        <div><dt className="text-sm">Pickup region</dt><dd className="font-semibold">{report.pickupRegionName ?? "Not independently confirmed"}</dd></div>
        <div><dt className="text-sm">Matching active courier services</dt><dd className="font-semibold">{report.matchingServiceCount}</dd></div>
      </dl>
      {report.blockers.length ? <section className="mt-5"><h2 className="font-semibold">Required corrections</h2><ul className="mt-2 list-disc space-y-1 pl-5">{report.blockers.map(code => <li key={code}>{BLOCKER_LABELS[code] ?? code}</li>)}</ul></section> : <p className="mt-4">Pickup evidence is recorded for the current active service area. Proceed to the remaining checks before store publication.</p>}
      <section className="mt-5"><h2 className="font-semibold">Still required before Live status</h2><ul className="mt-2 list-disc space-y-1 pl-5">{report.outstandingChecks.map(code => <li key={code}>{REMAINING_LABELS[code] ?? code}</li>)}</ul></section>
    </OperationalPanel>
    <p className="text-sm">No store status or payment data is changed by this check.</p>
  </ProtectedPageFrame>;
}
