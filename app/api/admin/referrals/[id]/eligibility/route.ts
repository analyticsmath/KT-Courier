import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { tooManyRequests, ok, serverError, unprocessable } from "@/lib/api/response";
import { inspectOrdinaryReferralEligibility } from "@/lib/rewards/ordinary-referral-eligibility.service";

const reference = z.string().trim().min(1).max(200);

/** Finance/identity dual-permission read-only preflight.
 * Never claims an earned R5, changes the referral status or posts wallet money.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireAdminApiPermission(PERMISSIONS.CUSTOMERS_READ, { request });
  if (owner.response) return owner.response;
  const finance = await requireAdminApiPermission(PERMISSIONS.FINANCE_READ, { request });
  if (finance.response) return finance.response;
  const rate = await checkIpRateLimit(request, "admin-ordinary-referrals-review:" + owner.user.id, {
    max: 30, windowMs: 60000, distributedRequired: true,
  });
  if (!rate.ok) return tooManyRequests(rate.retryAfterSeconds);
  const { id } = await context.params;
  const parsed = reference.safeParse(id);
  if (!parsed.success) return unprocessable("A valid referral event identifier is required.");
  try {
    const evidence = await inspectOrdinaryReferralEligibility(parsed.data);
    const response = ok({
      evidence,
      designation: "READ_ONLY_FINANCIAL_EVIDENCE",
      releaseAuthorization: false,
      walletCreditCreated: false,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return serverError();
  }
}
