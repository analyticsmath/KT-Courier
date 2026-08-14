import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { badRequest, created, forbidden, unauthorized, unprocessable } from "@/lib/api/response";
import { AttachVehicleDocumentSchema } from "@/lib/validation/private-media";
import { attachOwnVehicleDocument, VehicleComplianceError } from "@/lib/services/vehicle-compliance.service";
import { UserRole } from "@/types/db";

export async function POST(request: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();
  const body: unknown = await request.json().catch(() => null);
  const parsed = AttachVehicleDocumentSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Validation failed.");
  try {
    const { vehicleId } = await context.params;
    return created(await attachOwnVehicleDocument({ driverUserId: user.id, vehicleId, ...parsed.data }));
  } catch (error) {
    return error instanceof VehicleComplianceError ? unprocessable(error.message) : badRequest("Vehicle document could not be attached.");
  }
}
