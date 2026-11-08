import { type NextRequest } from "next/server";
import { gone, tooManyRequests } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

/**
 * Deprecated Phase-B endpoint. Never accept caller-supplied amounts or
 * evidence strings to clear real driver cash. Verified cash deposits are
 * reviewed via POST /api/admin/cash-deposits/[id]/review, which checks the
 * linked driver, receipt media, bank statement/physical handover and posts the
 * immutable reconciliation receipt through its finance-controlled service.
 *
 * Return 410 instead of silently forwarding an unaudited amount. The
 * authentication, origin and rate controls remain in place so unauthorized
 * callers cannot probe this protected operational endpoint.
 */
export async function POST(request: NextRequest) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const auth = await requireAdminApiPermission(PERMISSIONS.COD_OPERATIONS_MANAGE, { request });
  if (auth.response) return auth.response;
  const limit = await checkIpRateLimit(request, `cod-reconciliation:${auth.user.id}`, RATE_LIMITS.COD_RECONCILIATION);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  const response = gone("Direct COD reconciliation is retired. Review a verified driver cash deposit in Admin > Cash deposits.");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
