import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { assignDriverRegions } from "@/lib/services/admin-drivers.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ok,
  unprocessable,
  badRequest,
} from "@/lib/api/response";
import { AdminDriverRegionsSchema } from "@/lib/validation/driver";
import { formatZodErrors } from "@/lib/validation/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_REGIONS_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const session = auth.user;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = AdminDriverRegionsSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await assignDriverRegions(
      session.id,
      id,
      parsed.data.regionIds,
      parsed.data.primaryRegionId
    );
    return ok(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update driver coverage regions.";
    return badRequest(message);
  }
}
