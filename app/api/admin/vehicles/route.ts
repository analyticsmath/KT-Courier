import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listAdminVehicles } from "@/lib/services/vehicle-compliance.service";
import { ok, badRequest } from "@/lib/api/response";
import { VehicleComplianceStatus } from "@/types/db";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const search = searchParams.get("search") || undefined;

  const validStatuses = Object.values(VehicleComplianceStatus);
  const status = validStatuses.includes(statusParam as VehicleComplianceStatus)
    ? (statusParam as VehicleComplianceStatus)
    : undefined;

  try {
    const vehicles = await listAdminVehicles({ status, search });
    return ok(vehicles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load vehicles.";
    return badRequest(message);
  }
}
