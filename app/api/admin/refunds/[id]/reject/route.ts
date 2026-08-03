import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prepareAdminRefundMutation, readAdminRefundMutationBody } from "@/lib/refunds/admin-mutation-route";
import { refundApiError, refundNoStoreJson, requireRefundAdminPermission } from "@/lib/refunds/api-policy";
import { rejectRefund } from "@/lib/services/refund-finance-review.service";
import { RefundFinanceActionSchema } from "@/lib/validation/refunds";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRefundAdminPermission(PERMISSIONS.REFUNDS_REVIEW, request); if ("response" in auth) return auth.response;
  const prepared = await prepareAdminRefundMutation(request, params, "/api/admin/refunds/[id]/reject", auth.user.id); if ("response" in prepared) return prepared.response;
  const payload = await readAdminRefundMutationBody(request); if ("response" in payload) return payload.response;
  const parsed = RefundFinanceActionSchema.safeParse(payload.body); if (!parsed.success) return refundNoStoreJson({ error: "Invalid refund rejection request." }, 422);
  try { const refund = await rejectRefund({ actorUserId: auth.user.id, publicReference: prepared.publicReference, operationId: parsed.data.operationId, financeNote: parsed.data.financeNote }); return refundNoStoreJson({ refund: { publicReference: refund.publicReference, status: refund.status } }); }
  catch (error) { return refundApiError(error); }
}

