import Link from "next/link";
import type { EligibleDriversResult } from "@/lib/services/driver-eligibility.service";

function explain(reason: string) {
  if (reason === "DRIVER_DOCUMENT_ID_DOCUMENT_INVALID") return "Identity document needs approval or renewal.";
  if (reason === "DRIVER_DOCUMENT_LICENSE_INVALID") return "Driving licence needs approval or renewal.";
  if (reason === "NO_COMPLIANT_APPROVED_VEHICLE") return "Approve a vehicle with valid registration, licence disc and insurance documents.";
  return reason.replaceAll("_", " ");
}

export function DispatchDriverReadiness({ drivers }: { drivers: EligibleDriversResult }) {
  const blocked = [...drivers.regionMismatch, ...drivers.unavailable, ...drivers.notEligible];
  const total = blocked.length + drivers.recommended.length + drivers.available.length;
  return <div className="space-y-3">
    {total === 0 ? <p>No driver profiles have been registered. Drivers can create their profile and submit their documents from driver onboarding.</p> : null}
    {blocked.length ? <details open={drivers.recommended.length + drivers.available.length === 0}>
      <summary className="cursor-pointer font-semibold">Drivers needing attention ({blocked.length})</summary>
      <ul className="mt-3 space-y-3">{blocked.map(driver => <li key={driver.id}>
        <Link className="eo-table-link" href={`/admin/drivers/${driver.id}`}>{driver.displayName ?? driver.driverCode} · {driver.driverCode}</Link>
        <p className="text-sm">{driver.warnings.map(explain).join(" · ") || driver.eligibility.replaceAll("_", " ")}</p>
      </li>)}</ul>
    </details> : null}
    <p className="text-sm">Review <Link className="eo-inline-action" href="/admin/drivers">driver accounts, availability and service regions</Link> and <Link className="eo-inline-action" href="/admin/vehicles">vehicle documents and photos</Link>. Drivers must select Available before receiving an offer.</p>
  </div>;
}
