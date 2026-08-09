import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { executeUnifiedBulkRecovery, listUnifiedReconciliationCases } from "@/lib/reconciliation/service";
import type { NormalizedReconciliationStatus, ReconciliationSeverity } from "@/lib/reconciliation/types";

function queryOption<T extends string>(value: string | null, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

const bulkSchema = z
  .object({
    domain: z.enum([
      "payments",
      "marketplace_checkout",
      "store_orders",
      "refunds",
      "withdrawals",
      "store_earnings",
      "driver_earnings",
      "commissions",
      "subscriptions",
      "promotions",
      "advertising",
      "notifications",
      "developer_api",
      "reporting",
    ]),
    caseType: z.string().trim().min(2).max(80),
    actionKey: z.string().trim().min(2).max(80),
    references: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
    operationIdPrefix: z.string().regex(/^[A-Z0-9-]{4,32}$/),
  })
  .strict();

export async function GET(request: NextRequest) {
  // Permission gate for reading reconciliation cases
  const auth = await requireAdminApiPermission(
    [
      PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      PERMISSIONS.REFUNDS_RECONCILE,
      PERMISSIONS.WITHDRAWALS_RECONCILE,
      PERMISSIONS.COMMISSION_RECONCILIATION_READ,
      PERMISSIONS.STORE_EARNINGS_RECONCILE,
      PERMISSIONS.DRIVER_EARNINGS_RECONCILE,
      PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE,
      PERMISSIONS.STORE_ORDERS_RECONCILE,
      PERMISSIONS.SUBSCRIPTION_CONTRACTS_RECONCILE,
      PERMISSIONS.PROMOTIONS_RECONCILIATION_READ,
      PERMISSIONS.ADVERTISING_RECONCILIATION_READ,
      PERMISSIONS.NOTIFICATION_RECONCILIATION_READ,
      PERMISSIONS.DEVELOPER_RECONCILIATION_READ,
      PERMISSIONS.REPORT_RECONCILIATION_READ,
    ],
    { request },
  );
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const domain = queryOption(url.searchParams.get("domain"), ["payments", "marketplace_checkout", "store_orders", "refunds", "withdrawals", "store_earnings", "driver_earnings", "commissions", "subscriptions", "promotions", "advertising", "notifications", "developer_api", "reporting"] as const);
  const severity = queryOption<ReconciliationSeverity>(url.searchParams.get("severity"), ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  const status = queryOption<NormalizedReconciliationStatus>(url.searchParams.get("status"), ["OPEN", "IN_PROGRESS", "CONVERGED", "RESOLVED", "FAILED"]);
  const reasonCode = url.searchParams.get("reasonCode") ?? undefined;
  const isBlocking = url.searchParams.has("isBlocking") ? url.searchParams.get("isBlocking") === "true" : undefined;
  const searchReference = url.searchParams.get("search") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = url.searchParams.has("limit") ? Number.parseInt(url.searchParams.get("limit")!, 10) : 50;

  const effectiveKeys = await getEffectivePermissionKeysForUser({ userId: auth.user.id, role: auth.user.role });
  const actorPermissionKeys = new Set(effectiveKeys);

  const result = await listUnifiedReconciliationCases(actorPermissionKeys, {
    domain,
    severity,
    status,
    reasonCode,
    isBlocking,
    searchReference,
    cursor,
    limit,
  });

  return ok({ data: result });
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(
    [
      PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      PERMISSIONS.REFUNDS_RECONCILE,
      PERMISSIONS.WITHDRAWALS_RECONCILE,
      PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE,
      PERMISSIONS.STORE_ORDERS_RECONCILE,
      PERMISSIONS.SUBSCRIPTION_BILLING_RECONCILE,
    ],
    { request },
  );
  if (auth.response) return auth.response;

  if (Number(request.headers.get("content-length") ?? "0") > 16_384) {
    return badRequest("Request body exceeds permitted length.");
  }

  const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return unprocessable("Bulk recovery request is invalid.");
  }

  const effectiveKeys = await getEffectivePermissionKeysForUser({ userId: auth.user.id, role: auth.user.role });
  const actorPermissionKeys = new Set(effectiveKeys);

  try {
    const bulkResult = await executeUnifiedBulkRecovery(
      auth.user.id,
      actorPermissionKeys,
      parsed.data.domain,
      parsed.data.caseType,
      parsed.data.actionKey,
      parsed.data.references,
      parsed.data.operationIdPrefix,
    );
    return ok({ data: bulkResult });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Bulk recovery execution failed.");
  }
}
