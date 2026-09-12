import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { reviewVehicleDocument, VehicleComplianceError } from "@/lib/services/vehicle-compliance.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { ok, unprocessable, badRequest, notFound } from "@/lib/api/response";

const ReviewVehicleDocSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_STATUS_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const session = auth.user;

  const { docId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = ReviewVehicleDocSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.");
  }

  try {
    const updated = await reviewVehicleDocument({
      adminUserId: session.id,
      vehicleDocumentId: docId,
      status: parsed.data.status,
      reason: parsed.data.reason,
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof VehicleComplianceError) {
      if (error.status === 404) return notFound(error.message);
      if (error.status === 422) return unprocessable(error.message);
    }
    const message = error instanceof Error ? error.message : "Failed to review vehicle document.";
    return badRequest(message);
  }
}
