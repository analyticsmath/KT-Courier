import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { refundApiError, refundNoStoreJson, validateRefundJsonRequest } from "@/lib/refunds/api-policy";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { cancelRefundRequest } from "@/lib/services/refund-request.service";
import { RefundActionSchema, RefundPublicParamsSchema } from "@/lib/validation/refunds";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/refunds/[publicReference]/cancel" });
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return refundNoStoreJson({ error: "Authentication required." }, 401);
  if (user.role !== "CUSTOMER" || user.status !== "ACTIVE") return refundNoStoreJson({ error: "Refund not found." }, 404);
  const parameter = RefundPublicParamsSchema.safeParse(await params);
  if (!parameter.success) return refundNoStoreJson({ error: "Refund not found." }, 404);
  const rate = await checkIpRateLimit(request, `refund-cancel:${user.id}`, RATE_LIMITS.REFUND_MUTATION);
  if (!rate.ok) return refundNoStoreJson({ error: "Too many refund actions." }, 429);
  const requestFailure = validateRefundJsonRequest(request);
  if (requestFailure) return requestFailure;
  let body: unknown; try { body = await request.json(); } catch { return refundNoStoreJson({ error: "Invalid JSON body." }, 422); }
  const parsed = RefundActionSchema.safeParse(body);
  if (!parsed.success) return refundNoStoreJson({ error: "A valid operation ID is required." }, 422);
  try {
    const refund = await cancelRefundRequest({ actorUserId: user.id, publicReference: parameter.data.publicReference, operationId: parsed.data.operationId });
    return refundNoStoreJson({ refund: { publicReference: refund.publicReference, amount: refund.amount.toFixed(2), currency: "ZAR", status: refund.status } });
  } catch (error) { return refundApiError(error); }
}

