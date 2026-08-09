import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { executeUnifiedRecoveryCommand } from "@/lib/reconciliation/service";
import type { ReconciliationDomain } from "@/lib/reconciliation/types";

const recoverySchema = z
  .object({
    operationId: z.string().regex(/^[A-Z0-9-]{8,80}$/),
    reasonCode: z.string().trim().min(2).max(80),
    note: z.string().trim().max(512).optional(),
    confirmAction: z.string().trim().min(2).max(80),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string; reference: string; action: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(
    [
      PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.REFUNDS_PROCESS,
      PERMISSIONS.WITHDRAWALS_PROCESS,
      PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE,
      PERMISSIONS.STORE_ORDERS_RETRY_ADJUSTMENT,
      PERMISSIONS.SUBSCRIPTION_BILLING_RECONCILE,
      PERMISSIONS.PROMOTIONS_RECONCILIATION_MANAGE,
      PERMISSIONS.ADVERTISING_RECONCILIATION_MANAGE,
      PERMISSIONS.NOTIFICATION_RECONCILIATION_RETRY,
      PERMISSIONS.DEVELOPER_RECONCILIATION_RETRY,
      PERMISSIONS.REPORT_RECONCILIATION_RETRY,
    ],
    { request },
  );
  if (auth.response) return auth.response;

  if (Number(request.headers.get("content-length") ?? "0") > 8_192) {
    return badRequest("Request body is too large.");
  }

  const { domain, reference, action } = await params;
  const parsed = recoverySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmAction !== action) {
    return unprocessable("Recovery execution confirmation is invalid.");
  }

  const effectiveKeys = await getEffectivePermissionKeysForUser({ userId: auth.user.id, role: auth.user.role });
  const actorPermissionKeys = new Set(effectiveKeys);

  try {
    const result = await executeUnifiedRecoveryCommand(auth.user.id, actorPermissionKeys, {
      domain: domain as ReconciliationDomain,
      reference,
      actionKey: action,
      actorUserId: auth.user.id,
      operationId: parsed.data.operationId,
      reasonCode: parsed.data.reasonCode,
      note: parsed.data.note,
    });
    return ok({ data: result });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Recovery execution failed.");
  }
}
