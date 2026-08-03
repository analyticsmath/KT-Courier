import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listDriverAssignments, getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");

  const { searchParams } = new URL(req.url);
  const filterParam = searchParams.get("filter");
  const filter =
    filterParam === "active" || filterParam === "history" ? filterParam : "all";

  try {
    const assignments = await listDriverAssignments(driverProfileId, filter);
    return ok(assignments);
  } catch (err) {
    console.error("[driver/assignments GET]", err);
    return serverError();
  }
}
