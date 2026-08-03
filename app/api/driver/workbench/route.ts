import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { getDriverWorkbench } from "@/lib/services/driver-workbench.service";
import { parsePagination } from "@/lib/api/response";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");

  try {
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams);
    return ok(await getDriverWorkbench(driverProfileId, { page, pageSize }));
  } catch (err) {
    console.error("[driver/workbench GET]", err);
    return serverError();
  }
}
