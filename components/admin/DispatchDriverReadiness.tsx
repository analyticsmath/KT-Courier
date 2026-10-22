import Link from "next/link";
import type { EligibleDriversResult } from "@/lib/services/driver-eligibility.service";

function explain(reason: string) {
  if (reason === "DRIVER_DOCUMENT_ID_DOCUMENT_INVALID") return "Identity document requires review";
  if (reason === "DRIVER_DOCUMENT_LICENSE_INVALID") return "Driving licence requires review";
  if (reason === "NO_COMPLIANT_APPROVED_VEHICLE") return "Vehicle compliance documents required";
  return reason.replaceAll("_", " ").toLowerCase();
}

/** Compact and deliberately collapsed: dispatch operators need a queue, not an essay. */
export function DispatchDriverReadiness({ drivers }: { drivers: EligibleDriversResult }) {
  const blocked = [...drivers.regionMismatch, ...drivers.unavailable, ...drivers.notEligible];
  const ready = drivers.recommended.length + drivers.available.length;
  const total = blocked.length + ready;

  return (
    <div className="eo-readiness">
      <div className="eo-readiness__overview">
        <div>
          <strong className="eo-readiness__number">{ready}</strong>
          <span>eligible for dispatch</span>
        </div>
        <div>
          <strong className="eo-readiness__number">{blocked.length}</strong>
          <span>need attention</span>
        </div>
      </div>
      {total === 0 ? <p className="eo-readiness__hint">No driver profiles registered. Drivers can onboard and submit their documents.</p> : null}
      {blocked.length > 0 ? (
        <details className="eo-readiness__details">
          <summary>Review {blocked.length} driver{blocked.length === 1 ? "" : "s"} requiring attention</summary>
          <div className="eo-readiness__list">
            {blocked.map((driver) => (
              <div className="eo-readiness__row" key={driver.id}>
                <Link href={`/admin/drivers/${driver.id}`}>{driver.displayName ?? driver.driverCode}<span className="sr-only"> — {driver.driverCode}</span></Link>
                <p>{driver.warnings.map(explain).join(" · ") || explain(driver.eligibility)}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      <p className="eo-readiness__hint">Review <Link href="/admin/drivers">driver availability</Link> and <Link href="/admin/vehicles">vehicle approvals</Link> before assigning an order.</p>
    </div>
  );
}
