import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { checkOperatorReadiness } from "@/lib/health/checks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_READ, {
    request,
    message: "System readiness diagnostics require the exact readiness permission.",
  });
  if (auth.response) return auth.response;

  const payload = await checkOperatorReadiness();
  return Response.json(payload, {
    status: payload.status === "ready" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
