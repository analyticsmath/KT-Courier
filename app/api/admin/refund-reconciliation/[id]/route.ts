import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { refundNoStoreJson, requireRefundAdminPermission } from "@/lib/refunds/api-policy";
import { getRefundReconciliation } from "@/lib/services/refund-query.service";
import { RefundReconciliationParamsSchema } from "@/lib/validation/refunds";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRefundAdminPermission(PERMISSIONS.REFUNDS_RECONCILE, request); if ("response" in auth) return auth.response;
  const parameter = RefundReconciliationParamsSchema.safeParse(await params);
  if (!parameter.success) return refundNoStoreJson({ error: "Refund reconciliation case not found." }, 404);
  try { const item = await getRefundReconciliation(parameter.data.id); return item ? refundNoStoreJson({ reconciliation: item }) : refundNoStoreJson({ error: "Refund reconciliation case not found." }, 404); }
  catch { return refundNoStoreJson({ error: "Refund reconciliation is temporarily unavailable." }, 503); }
}

