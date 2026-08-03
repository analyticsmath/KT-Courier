import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listSettings } from "@/lib/services/admin-settings.service";
import { ok, serverError } from "@/lib/api/response";

export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.SETTINGS_READ);
  if (auth.response) return auth.response;

  try {
    const settings = await listSettings();
    return ok(settings);
  } catch {
    return serverError();
  }
}
