import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, serverError } from "@/lib/api/response";
import { getDispatchBoardData } from "@/lib/services/admin-dispatch.service";

export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_READ);
  if (auth.response) return auth.response;

  try {
    const data = await getDispatchBoardData();
    return ok(data);
  } catch (err) {
    console.error("[admin/dispatch GET]", err);
    return serverError();
  }
}
