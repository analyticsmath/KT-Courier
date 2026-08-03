import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { getDeliveryAssignments, getDeliveryWorkbenchSummary } from "@/lib/services/delivery-execution.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");

  try {
    const [assignments, summary] = await Promise.all([
      getDeliveryAssignments(driverProfileId),
      getDeliveryWorkbenchSummary(driverProfileId),
    ]);

    return ok({ assignments, summary });
  } catch (err) {
    console.error("[driver/delivery GET]", err);
    return serverError();
  }
}
