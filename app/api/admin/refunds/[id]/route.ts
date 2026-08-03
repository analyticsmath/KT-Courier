import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { refundNoStoreJson, requireRefundAdminPermission } from "@/lib/refunds/api-policy";
import { getFinanceRefund } from "@/lib/services/refund-query.service";
import { RefundAdminParamsSchema } from "@/lib/validation/refunds";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRefundAdminPermission(PERMISSIONS.REFUNDS_READ, request);
  if ("response" in auth) return auth.response;
  const parameter = RefundAdminParamsSchema.safeParse(await params);
  if (!parameter.success) return refundNoStoreJson({ error: "Refund not found." }, 404);
  try {
    const refund = await getFinanceRefund(parameter.data.id);
    return refund ? refundNoStoreJson({ refund }) : refundNoStoreJson({ error: "Refund not found." }, 404);
  } catch { return refundNoStoreJson({ error: "Refund is temporarily unavailable." }, 503); }
}

