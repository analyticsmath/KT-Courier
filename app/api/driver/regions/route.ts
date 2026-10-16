import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOwnDriverRegions, updateOwnDriverRegions } from "@/lib/services/driver-profile.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ok,
  unauthorized,
  forbidden,
  unprocessable,
  badRequest,
} from "@/lib/api/response";
import { DriverSelfRegionsSchema } from "@/lib/validation/driver";
import { formatZodErrors } from "@/lib/validation/auth";
import { UserRole } from "@/types/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.DRIVER) return forbidden();

  try {
    const data = await getOwnDriverRegions(session.id);
    return ok(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load delivery regions.";
    return badRequest(message);
  }
}

async function handleUpdate(req: NextRequest) {
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

  const parsed = DriverSelfRegionsSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await updateOwnDriverRegions(
      session.id,
      parsed.data.regionIds,
      parsed.data.primaryRegionId
    );
    return ok(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update operating regions.";
    return badRequest(message);
  }
}

export async function PUT(req: NextRequest) {
  return handleUpdate(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req);
}
