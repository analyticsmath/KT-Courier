import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, notFound, unprocessable, serverError, conflict } from "@/lib/api/response";
import { RegionConfigurationError } from "@/lib/maps/region-boundaries";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  updateDeliveryRegion,
  toggleDeliveryRegionActive,
} from "@/lib/services/admin-regions.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const UpdateRegionSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
  pricingEnabled: z.boolean().optional(),
  expectedUpdatedAt: z.iso.datetime(),
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().max(100).nullable().optional(),
  centerLat: z.number().min(-90).max(90).nullable().optional(),
  centerLng: z.number().min(-180).max(180).nullable().optional(),
  coverageRadiusKm: z.number().min(0).max(500).nullable().optional(),
  baseFee: z.number().min(0).optional(),
  maxDistanceKm: z.number().min(0).max(500).nullable().optional(),
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
  try {
  if (parsed.data.toggleActive === true) {
    const region = await toggleDeliveryRegionActive(id, parsed.data.expectedUpdatedAt, user.id);
    if (!region) return notFound();
    return ok({ region });
  }

    const region = await updateDeliveryRegion(id, parsed.data, user.id);
    if (!region) return notFound();
    return ok({ region });
  } catch (err) {
    if (err instanceof RegionConfigurationError) return err.status === 409 ? conflict(err.message) : unprocessable(err.message);
    if (err instanceof Error && "code" in err && err.code === "P2025") return conflict("Region changed. Refresh before saving.");
    return serverError(err instanceof Error ? err.message : "Failed to update region");
  }
}
