import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getAdminVehicleDetail, VehicleComplianceError } from "@/lib/services/vehicle-compliance.service";
import { ok, notFound, badRequest } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const vehicle = await getAdminVehicleDetail(id);
    return ok(vehicle);
  } catch (error) {
    if (error instanceof VehicleComplianceError && error.status === 404) {
      return notFound(error.message);
    }
    const message = error instanceof Error ? error.message : "Failed to load vehicle.";
    return badRequest(message);
  }
}
