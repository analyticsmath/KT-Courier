import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDriverProfileByUserId, updateOwnDriverProfile } from "@/lib/services/driver-profile.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  unprocessable,
  badRequest,
} from "@/lib/api/response";
import { DriverSelfUpdateSchema } from "@/lib/validation/driver";
import { formatZodErrors } from "@/lib/validation/auth";
import { UserRole } from "@/types/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.DRIVER) return forbidden();

  const driver = await getDriverProfileByUserId(session.id);
  if (!driver) return notFound("Driver profile not found.");

  return ok(driver);
}

export async function PATCH(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.DRIVER) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = DriverSelfUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await updateOwnDriverProfile(session.id, parsed.data);
    return ok(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile.";
    return badRequest(message);
  }
}
