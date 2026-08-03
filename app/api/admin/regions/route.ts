import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, unprocessable, serverError } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  listDeliveryRegions,
  createDeliveryRegion,
} from "@/lib/services/admin-regions.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const CreateRegionSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().default(true),
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().max(100).optional(),
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  coverageRadiusKm: z.number().min(0).max(500).optional(),
  baseFee: z.number().min(0).optional(),
  maxDistanceKm: z.number().min(0).max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  displayOrder: z.number().int().min(0).default(0),
});

export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.REGIONS_READ);
  if (auth.response) return auth.response;

  try {
    const regions = await listDeliveryRegions();
    return ok({ regions });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Failed to list regions");
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.REGIONS_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = CreateRegionSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const region = await createDeliveryRegion(parsed.data);
    await recordAdminActivity({
      actorUserId: user.id,
      action: "CREATE",
      entityType: "DeliveryRegion",
      entityId: region.id,
      message: `Created delivery region: ${region.name}`,
    });
    return ok({ region }, 201);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Failed to create region");
  }
}
