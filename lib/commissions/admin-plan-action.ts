import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { CommissionPlanActionSchema, CommissionPlanParamsSchema } from "@/lib/validation/commissions";
import { commissionApiError, commissionNoStoreJson } from "./api-policy";
import { prepareCommissionMutation } from "./admin-mutation-route";

export async function runCommissionPlanAction(request: NextRequest, params: Promise<{ id: string }>, path: string, permission: Parameters<typeof requireAdminApiPermission>[0], operation: (id: string, actorUserId: string, operationId: string) => Promise<unknown>) {
  const auth = await requireAdminApiPermission(permission, { request }); if (auth.response) return auth.response;
  const id = CommissionPlanParamsSchema.safeParse(await params); if (!id.success) return commissionNoStoreJson({ error: "Commission plan was not found." }, 404);
  const payload = await prepareCommissionMutation(request, auth.user.id, path, "plan"); if ("response" in payload) return payload.response;
  const parsed = CommissionPlanActionSchema.safeParse(payload.body); if (!parsed.success) return commissionNoStoreJson({ error: "A valid operation ID is required." }, 422);
  try { const plan = await operation(id.data.id, auth.user.id, parsed.data.operationId); return commissionNoStoreJson({ plan }); }
  catch (error) { return commissionApiError(error); }
}
