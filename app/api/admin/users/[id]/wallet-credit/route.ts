import type { NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { creditCustomerWalletBySuperAdmin } from "@/lib/services/admin-customer-wallet-grant.service";
import { AdminWalletGrantError, validateAdminWalletGrant } from "@/lib/services/admin-customer-wallet-grant-policy";

/** Superuser-only, idempotent platform-funded customer wallet grant.
 * No cash is claimed as received and customers cannot withdraw grants.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const auth = await requireSuperAdminApi({ request });
  if (auth.response) return auth.response;
  const rate = await checkIpRateLimit(request, `admin-wallet-grant:${auth.user.id}`, {
    max: 5, windowMs: 60 * 60 * 1000, distributedRequired: true,
  });
  if (!rate.ok) {
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (rate.retryAfterSeconds) headers.set("Retry-After", String(rate.retryAfterSeconds));
    return Response.json(
      { error: rate.failClosed ? "Wallet grants are temporarily unavailable." : "Too many wallet grants. Try again later." },
      { status: rate.failClosed ? 503 : 429, headers },
    );
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "JSON content type is required." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "A valid JSON request is required." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const { id } = await params;
    const command = validateAdminWalletGrant(body);
    const credit = await creditCustomerWalletBySuperAdmin({
      ...command, actorUserId: auth.user.id, customerUserId: id,
    });
    return Response.json({ credit }, {
      status: credit.status === "REPLAYED" ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AdminWalletGrantError) {
      const status = error.code === "UNAUTHORIZED" ? 403 : error.code === "CUSTOMER_NOT_FOUND" ? 404 : 422;
      return Response.json({ error: error.message }, { status, headers: { "Cache-Control": "no-store" } });
    }
    const code = (error as { code?: string })?.code;
    if (code === "LEDGER_IDEMPOTENCY_CONFLICT" || code === "LEDGER_SOURCE_REFERENCE_CONFLICT") {
      return Response.json({ error: "The operation identifier was used for a different wallet grant." },
        { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    // Do not reveal financial journal internals or customer details.
    return Response.json({ error: "The wallet credit could not be confirmed. Retry using the same operation ID." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
