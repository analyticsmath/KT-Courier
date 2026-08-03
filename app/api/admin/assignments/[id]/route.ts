import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, notFound, serverError } from "@/lib/api/response";
import { getAssignmentDetail } from "@/lib/services/admin-dispatch.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;

  try {
    const assignment = await getAssignmentDetail(id);
    if (!assignment) return notFound("Assignment not found.");
    return ok(assignment);
  } catch (err) {
    console.error("[admin/assignments/[id] GET]", err);
    return serverError();
  }
}
