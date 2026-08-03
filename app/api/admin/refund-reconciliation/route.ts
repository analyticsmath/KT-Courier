import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { refundNoStoreJson, requireRefundAdminPermission } from "@/lib/refunds/api-policy";
import { listRefundReconciliation } from "@/lib/services/refund-query.service";
import { RefundReconciliationListQuerySchema, refundSearchParams } from "@/lib/validation/refunds";

export async function GET(request: NextRequest) {
  const auth = await requireRefundAdminPermission(PERMISSIONS.REFUNDS_RECONCILE, request); if ("response" in auth) return auth.response;
  const parsed = RefundReconciliationListQuerySchema.safeParse(refundSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return refundNoStoreJson({ error: "Invalid refund reconciliation filters." }, 422);
  try { return refundNoStoreJson(await listRefundReconciliation(parsed.data)); }
  catch { return refundNoStoreJson({ error: "Refund reconciliation is temporarily unavailable." }, 503); }
}

