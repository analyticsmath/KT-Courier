import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { getDriverAssignmentDetail, getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");

  const { id } = await params;

  try {
    const assignment = await getDriverAssignmentDetail(id, driverProfileId);
    if (!assignment) return notFound("Assignment not found.");
    return ok(assignment);
  } catch (err) {
    console.error("[driver/assignments/[id] GET]", err);
    return serverError();
  }
}
