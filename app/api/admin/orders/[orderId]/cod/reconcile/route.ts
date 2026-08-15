import { type NextRequest } from "next/server";
import { badRequest, ok, serverError, tooManyRequests, unprocessable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { CashOnDeliveryError, reconcileCashCollection } from "@/lib/services/cash-on-delivery.service";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { CodReconciliationSchema } from "@/lib/validation/cash-on-delivery";
import { formatZodErrors } from "@/lib/validation/auth";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin;
  const auth = await requireAdminApiPermission(PERMISSIONS.COD_OPERATIONS_MANAGE, { request }); if (auth.response) return auth.response;
  const limit = await checkIpRateLimit(request, `cod-reconciliation:${auth.user.id}`, RATE_LIMITS.COD_RECONCILIATION); if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  const parsed = CodReconciliationSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  try { return ok(await reconcileCashCollection({ orderId: (await params).orderId, actorUserId: auth.user.id, receivedAmount: parsed.data.amount, operationId: parsed.data.operationId, evidenceReference: parsed.data.evidenceReference })); }
  catch (error) { if (error instanceof CashOnDeliveryError) return badRequest(error.code); return serverError(); }
}
