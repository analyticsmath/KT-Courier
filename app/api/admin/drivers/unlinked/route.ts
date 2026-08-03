import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listUnlinkedDriverUsers } from "@/lib/services/admin-drivers.service";
import { ok, badRequest } from "@/lib/api/response";

export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_CREATE);
  if (auth.response) return auth.response;

  try {
    const users = await listUnlinkedDriverUsers();
    return ok(users);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list unlinked driver users.";
    return badRequest(message);
  }
}
