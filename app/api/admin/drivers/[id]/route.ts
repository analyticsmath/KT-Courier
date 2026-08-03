import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getDriverDetail, updateDriverProfile } from "@/lib/services/admin-drivers.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ok,
  notFound,
  unprocessable,
  badRequest,
} from "@/lib/api/response";
import { AdminUpdateDriverSchema } from "@/lib/validation/driver";
import { formatZodErrors } from "@/lib/validation/auth";

// GET: retrieve driver details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;
  const driver = await getDriverDetail(id);
  if (!driver) return notFound("Driver profile not found.");

  return ok(driver);
}

// PATCH: update driver profile fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_UPDATE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const session = auth.user;

  const { id } = await params;
  const target = await getDriverDetail(id);
  if (!target) return notFound("Driver profile not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = AdminUpdateDriverSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await updateDriverProfile(session.id, id, parsed.data);
    return ok(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update driver profile.";
    return badRequest(message);
  }
}
