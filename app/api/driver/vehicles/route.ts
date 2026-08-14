import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { badRequest, created, forbidden, ok, unauthorized, unprocessable } from "@/lib/api/response";
import { CreateVehicleSchema } from "@/lib/validation/private-media";
import { createOwnVehicle, listOwnVehicles, VehicleComplianceError } from "@/lib/services/vehicle-compliance.service";
import { UserRole } from "@/types/db";

function failure(error: unknown) {
  if (error instanceof VehicleComplianceError) return error.status === 404 ? badRequest(error.message) : error.status === 409 ? badRequest(error.message) : unprocessable(error.message);
  return badRequest("Vehicle request could not be completed.");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();
  try { return ok(await listOwnVehicles(user.id)); } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();
  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateVehicleSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Validation failed.");
  try { return created(await createOwnVehicle(user.id, parsed.data)); } catch (error) { return failure(error); }
}
