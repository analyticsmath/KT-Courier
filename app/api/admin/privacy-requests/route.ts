import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok } from "@/lib/api/response";
import { listPrivacyRequests } from "@/lib/services/privacy-requests.service";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PRIVACY_REQUESTS_READ, { request });
  if (auth.response) return auth.response;
  return ok({ data: await listPrivacyRequests() });
}
