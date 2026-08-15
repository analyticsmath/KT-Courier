import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createPricingQuote } from "@/lib/services/pricing-quote.service";
import { PricingError } from "@/lib/pricing/errors";
import { PricingQuoteRequestSchema } from "@/lib/validation/pricing";
import { formatZodErrors } from "@/lib/validation/auth";
import { ok, unauthorized, forbidden, unprocessable, serverError, tooManyRequests } from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "CUSTOMER" && user.role !== "STORE") return forbidden();
  const limit = await checkIpRateLimit(req, `pricing-quote:${user.id}`, RATE_LIMITS.ORDER_ESTIMATE);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  let body: unknown;
  try { body = await req.json(); } catch { return unprocessable("Invalid request body."); }
  const parsed = PricingQuoteRequestSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  try {
    return ok(await createPricingQuote(user, parsed.data));
  } catch (error) {
    if (error instanceof PricingError) return unprocessable(error.message, { code: error.code });
    return serverError();
  }
}
