import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, notFound, unprocessable, serverError } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  updateDeliveryRegion,
  toggleDeliveryRegionActive,
} from "@/lib/services/admin-regions.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const UpdateRegionSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().max(100).optional(),
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  coverageRadiusKm: z.number().min(0).max(500).optional(),
  baseFee: z.number().min(0).optional(),
  maxDistanceKm: z.number().min(0).max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  displayOrder: z.number().int().min(0).optional(),
  toggleActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.REGIONS_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = UpdateRegionSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  // Handle toggle-active shorthand
  if (parsed.data.toggleActive === true) {
    const region = await toggleDeliveryRegionActive(id);
    if (!region) return notFound();
    await recordAdminActivity({
      actorUserId: user.id,
      action: "STATUS_CHANGE",
      entityType: "DeliveryRegion",
      entityId: region.id,
      message: `${region.active ? "Activated" : "Deactivated"} delivery region: ${region.name}`,
    });
    return ok({ region });
  }

  try {
    const region = await updateDeliveryRegion(id, parsed.data);
    if (!region) return notFound();
    await recordAdminActivity({
      actorUserId: user.id,
      action: "UPDATE",
      entityType: "DeliveryRegion",
      entityId: region.id,
      message: `Updated delivery region: ${region.name}`,
    });
    return ok({ region });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Failed to update region");
  }
}
