import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDriverDocuments } from "@/lib/services/admin-drivers.service";
import { ok, badRequest } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const documents = await listDriverDocuments(id);
    return ok(documents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load driver documents.";
    return badRequest(message);
  }
}
