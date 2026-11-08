import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, conflict, forbidden, ok, serverError, tooManyRequests, unauthorized } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { CustomerLoyaltyRedemptionError, redeemCustomerLoyaltyPoints } from "@/lib/rewards/customer-loyalty-redemption.service";

const RequestSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:_-]{7,95}$/),
  points: z.string().regex(/^[1-9]\d{0,18}$/),
}).strict();

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  const customer = await getCurrentUser();
  if (!customer) return unauthorized();
  if (customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") {
    return forbidden("Loyalty conversion requires an active customer account.");
  }
  const rl = await checkIpRateLimit(req, `loyalty-redeem:${customer.id}`, RATE_LIMITS.ADDRESS_MUTATION);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("A unique operation ID and exact number of points are required.");
  try {
    const result = await redeemCustomerLoyaltyPoints({ userId: customer.id, ...parsed.data });
    const response = ok(result);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof CustomerLoyaltyRedemptionError) {
      if (error.code === "IDEMPOTENCY_CONFLICT" || error.code === "INSUFFICIENT_POINTS") return conflict(error.message);
      if (error.code === "DISABLED") return forbidden(error.message);
      return badRequest(error.message);
    }
    return serverError();
  }
}
