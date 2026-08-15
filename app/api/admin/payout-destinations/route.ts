import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { registerPayoutDestination } from "@/lib/services/payout-destination.service";
import { listFinancePayoutDestinations } from "@/lib/services/withdrawal-query.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { PayoutDestinationCreateSchema } from "@/lib/validation/withdrawals";
import { validateWithdrawalJsonRequest, withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYOUT_DESTINATIONS_READ, { request }); if (auth.response) return auth.response;
  try { return withdrawalNoStoreJson({ data: await listFinancePayoutDestinations() }); }
  catch { return withdrawalNoStoreJson({ error: "Payout destinations are temporarily unavailable." }, 503); }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYOUT_DESTINATIONS_MANAGE, { request }); if (auth.response) return auth.response;
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/admin/payout-destinations" }); if (originFailure) return originFailure;
  const rate = await checkIpRateLimit(request, `payout-destination:${auth.user.id}`, RATE_LIMITS.PAYOUT_DESTINATION_MANAGE); if (!rate.ok) return withdrawalNoStoreJson({ error: "Too many payout destination actions." }, 429);
  const requestFailure = validateWithdrawalJsonRequest(request); if (requestFailure) return requestFailure;
  let body: unknown; try { body = await request.json(); } catch { return withdrawalNoStoreJson({ error: "Invalid JSON body." }, 422); }
  const parsed = PayoutDestinationCreateSchema.safeParse(body); if (!parsed.success) return withdrawalNoStoreJson({ error: "Invalid payout destination. Raw bank data is not accepted." }, 422);
  try { const destination = await registerPayoutDestination({ actorUserId: auth.user.id, ownerType: parsed.data.ownerType, ownerId: parsed.data.ownerId, externalReference: parsed.data.externalReference, maskedLabel: parsed.data.maskedLabel, institutionName: parsed.data.institutionName, accountLast4: parsed.data.accountLast4, countryCode: parsed.data.countryCode }); return withdrawalNoStoreJson({ payoutDestination: { publicReference: destination.publicReference, status: destination.status, maskedLabel: destination.maskedLabel } }, 201); }
  catch (error) { return withdrawalApiError(error); }
}
