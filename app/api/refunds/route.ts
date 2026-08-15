import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { refundApiError, refundNoStoreJson, validateRefundJsonRequest } from "@/lib/refunds/api-policy";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { listCustomerRefunds } from "@/lib/services/refund-query.service";
import { createRefundRequest } from "@/lib/services/refund-request.service";
import { RefundCreateSchema, RefundListQuerySchema, refundSearchParams } from "@/lib/validation/refunds";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return refundNoStoreJson({ error: "Authentication required." }, 401);
  if (user.role !== "CUSTOMER" || user.status !== "ACTIVE") return refundNoStoreJson({ error: "Refunds are unavailable for this account." }, 403);
  const parsed = RefundListQuerySchema.safeParse(refundSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return refundNoStoreJson({ error: "Invalid refund filters." }, 422);
  try { return refundNoStoreJson(await listCustomerRefunds(user.id, parsed.data)); }
  catch { return refundNoStoreJson({ error: "Refunds are temporarily unavailable." }, 503); }
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/refunds" });
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return refundNoStoreJson({ error: "Authentication required." }, 401);
  if (user.role !== "CUSTOMER" || user.status !== "ACTIVE") return refundNoStoreJson({ error: "Refunds are unavailable for this account." }, 403);
  const rate = await checkIpRateLimit(request, `refund-request:${user.id}`, RATE_LIMITS.REFUND_REQUEST);
  if (!rate.ok) return refundNoStoreJson({ error: "Too many refund requests." }, 429);
  const requestFailure = validateRefundJsonRequest(request);
  if (requestFailure) return requestFailure;
  let body: unknown;
  try { body = await request.json(); } catch { return refundNoStoreJson({ error: "Invalid JSON body." }, 422); }
  const parsed = RefundCreateSchema.safeParse(body);
  if (!parsed.success) return refundNoStoreJson({ error: "Invalid refund request." }, 422);
  try {
    const refund = await createRefundRequest({ actorUserId: user.id, ...parsed.data });
    return refundNoStoreJson({ refund: { publicReference: refund.publicReference, amount: refund.amount.toFixed(2), currency: "ZAR", status: refund.status, method: refund.method, reasonCode: refund.reasonCode, createdAt: refund.createdAt.toISOString() } }, 201);
  } catch (error) { return refundApiError(error); }
}

