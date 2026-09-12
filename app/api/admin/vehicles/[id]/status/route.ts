import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { reviewVehicle, VehicleComplianceError } from "@/lib/services/vehicle-compliance.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { ok, unprocessable, badRequest, conflict } from "@/lib/api/response";

const ReviewVehicleSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "ARCHIVED"]),
  reason: z.string().trim().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_STATUS_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const session = auth.user;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = ReviewVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.");
  }

  try {
    const updated = await reviewVehicle({
      adminUserId: session.id,
      vehicleId: id,
      status: parsed.data.status,
      reason: parsed.data.reason,
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof VehicleComplianceError) {
      if (error.status === 409) return conflict(error.message);
      if (error.status === 422) return unprocessable(error.message);
    }
    const message = error instanceof Error ? error.message : "Failed to review vehicle.";
    return badRequest(message);
  }
}
