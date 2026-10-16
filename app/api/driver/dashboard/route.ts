import { getCurrentUser } from "@/lib/auth/current-user";
import { getDriverProfileByUserId } from "@/lib/services/driver-profile.service";
import { evaluateDriverReadiness } from "@/lib/services/driver-readiness.service";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/api/response";
import { UserRole, DriverAvailability } from "@/types/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.DRIVER) return forbidden();

  const driver = await getDriverProfileByUserId(session.id);
  if (!driver) return notFound("Driver profile not found.");

  const readiness = await evaluateDriverReadiness(driver.id);

  let assignmentsInfo: string;
  if (!readiness?.canBeAvailable) {
    assignmentsInfo = `Complete ${readiness?.blockers.length ?? 0} compliance and fleet requirement(s) before orders can be assigned.`;
  } else if (driver.availability !== DriverAvailability.AVAILABLE) {
    assignmentsInfo = "You are currently offline. Toggle your availability to Available to receive dispatch assignments.";
  } else if ((readiness?.activeAssignmentCount ?? 0) > 0) {
    assignmentsInfo = `${readiness?.activeAssignmentCount} active assignment(s) currently in progress.`;
  } else {
    assignmentsInfo = "You are online and ready for dispatch. New assignments will appear as orders are matched.";
  }

  const earningsInfo = "Earnings accrue on delivery completion. View individual run payouts in your earnings ledger.";
  const trackingInfo = "Live location tracking is active during operational assignments and pickups.";

  return ok({
    driverCode: driver.driverCode,
    displayName: driver.displayName,
    status: driver.status,
    availability: driver.availability,
    onboardingStatus: driver.onboardingStatus,
    vehicleType: driver.vehicleType,
    vehicleRegistration: driver.vehicleRegistration,
    regionCount: driver.serviceRegions.length,
    primaryRegion: driver.serviceRegions.find((r) => r.isPrimary)?.name || null,
    isDispatchReady: readiness?.isDispatchReady ?? false,
    canBeAvailable: readiness?.canBeAvailable ?? false,
    blockers: readiness?.blockers ?? [],
    checklist: readiness?.checklist ?? [],
    activeAssignmentCount: readiness?.activeAssignmentCount ?? 0,
    assignmentsInfo,
    earningsInfo,
    trackingInfo,
  });
}
