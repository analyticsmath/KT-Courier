import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, badRequest, unauthorized, forbidden, conflict, serverError } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { StartDeliverySchema } from "@/lib/validation/delivery";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { resumeDelivery } from "@/lib/services/delivery-execution.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  if (req.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json") return badRequest("Content-Type must be application/json.");
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();
  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");
  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body."); }
  const parsed = StartDeliverySchema.safeParse(body);
  if (!parsed.success) return badRequest("Validation failed.");
  try {
    const { id } = await params;
    const result = await resumeDelivery(id, driverProfileId, user.id, parsed.data);
    return result.ok ? ok({ ...result.assignment, operationResult: result.operationResult ?? null }) : conflict(result.error);
  } catch (error) {
    console.error("[driver/assignments/[id]/delivery/resume POST]", error);
    return serverError();
  }
}
