import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { awardVerifiedOrdinaryReferral, OrdinaryReferralAwardError } from "@/lib/rewards/ordinary-referral-award.service";

const commandSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:_-]{7,95}$/),
}).strict();
const reference = z.string().trim().min(1).max(200);
const headers = { "Cache-Control": "private, no-store" };

/** Explicit operator-controlled, idempotent referral award command.
 * Ordinary signup and payment callbacks CANNOT call this public route.
 * This does not enable automatic issuing or bank withdrawals.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const auth = await requireSuperAdminApi({ request });
  if (auth.response) return auth.response;
  const rate = await checkIpRateLimit(request, `admin-referral-award:${auth.user.id}`, {
    max: 12, windowMs: 60 * 60 * 1000, distributedRequired: true,
  });
  if (!rate.ok) return Response.json({ error: "Referral awards are temporarily unavailable." }, {
    status: rate.failClosed ? 503 : 429, headers,
  });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "JSON content type is required." }, { status: 415, headers });
  }
  const { id } = await context.params;
  const validReference = reference.safeParse(id);
  if (!validReference.success) return Response.json({ error: "Invalid referral event." }, { status: 422, headers });
  const raw = await request.json().catch(() => null);
  const parsed = commandSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "A stable operation ID is required." }, { status: 422, headers });
  try {
    const result = await awardVerifiedOrdinaryReferral({
      referralEventId: validReference.data, actorUserId: auth.user.id,
      operationId: parsed.data.operationId,
    });
    return Response.json({ reward: result, releaseAuthorization: false }, {
      status: result.status === "REPLAYED" ? 200 : 201, headers,
    });
  } catch (error) {
    if (error instanceof OrdinaryReferralAwardError) {
      const status = error.code === "FORBIDDEN" ? 403
        : error.code === "EVIDENCE_CONFLICT" ? 409
        : error.code === "DISABLED" ? 503 : 422;
      return Response.json({ error: error.message }, { status, headers });
    }
    // Never send customer, payment, wallet, journal or provider internals.
    return Response.json({ error: "The referral award was not confirmed. Retry the same operation ID." }, {
      status: 503, headers,
    });
  }
}
