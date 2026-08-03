import { getCurrentUser } from "@/lib/auth/current-user";
import { getDriverProfileByUserId } from "@/lib/services/driver-profile.service";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/api/response";
import { UserRole } from "@/types/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.DRIVER) return forbidden();

  const driver = await getDriverProfileByUserId(session.id);
  if (!driver) return notFound("Driver profile not found.");

  // Clean, real dashboard shell data
  return ok({
    driverCode: driver.driverCode,
    displayName: driver.displayName,
    status: driver.status,
    availability: driver.availability,
    onboardingStatus: driver.onboardingStatus,
    vehicleType: driver.vehicleType,
    vehicleRegistration: driver.vehicleRegistration,
    regionCount: driver.serviceRegions.length,
    primaryRegion: driver.serviceRegions.find(r => r.isPrimary)?.name || null,
    assignmentsInfo: "Assignments will appear after dispatch is enabled.",
    earningsInfo: "Earnings dashboard will be enabled in a future update.",
    trackingInfo: "Live tracking is disabled until order dispatch begins.",
  });
}
