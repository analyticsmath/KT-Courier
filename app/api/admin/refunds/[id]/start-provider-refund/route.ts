import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prepareAdminRefundMutation, readAdminRefundMutationBody } from "@/lib/refunds/admin-mutation-route";
import { refundApiError, refundNoStoreJson, requireRefundAdminPermission } from "@/lib/refunds/api-policy";
import { startProviderRefund } from "@/lib/services/refund-provider-execution.service";
import { RefundActionSchema } from "@/lib/validation/refunds";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRefundAdminPermission(PERMISSIONS.REFUNDS_PROCESS, request); if ("response" in auth) return auth.response;
  const prepared = await prepareAdminRefundMutation(request, params, "/api/admin/refunds/[id]/start-provider-refund", auth.user.id); if ("response" in prepared) return prepared.response;
  const payload = await readAdminRefundMutationBody(request); if ("response" in payload) return payload.response;
  const parsed = RefundActionSchema.safeParse(payload.body); if (!parsed.success) return refundNoStoreJson({ error: "A valid operation ID is required." }, 422);
  try { const refund = await startProviderRefund({ actorUserId: auth.user.id, publicReference: prepared.publicReference, operationId: parsed.data.operationId }); return refundNoStoreJson({ refund: { publicReference: refund.publicReference, status: refund.status } }); }
  catch (error) { return refundApiError(error); }
}

