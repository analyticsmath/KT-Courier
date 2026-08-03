import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getCommissionPlan } from "@/lib/services/commission-plan-query.service";
import { updateDraftCommissionPlan } from "@/lib/services/commission-plan.service";
import { CommissionPlanParamsSchema, CommissionPlanUpdateSchema } from "@/lib/validation/commissions";
import { commissionApiError, commissionNoStoreJson } from "@/lib/commissions/api-policy";
import { prepareCommissionMutation } from "@/lib/commissions/admin-mutation-route";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_PLANS_READ, { request }); if (auth.response) return auth.response;
  const parsed = CommissionPlanParamsSchema.safeParse(await params); if (!parsed.success) return commissionNoStoreJson({ error: "Commission plan was not found." }, 404);
  try { const plan = await getCommissionPlan(parsed.data.id); return plan ? commissionNoStoreJson({ plan }) : commissionNoStoreJson({ error: "Commission plan was not found." }, 404); }
  catch { return commissionNoStoreJson({ error: "Commission plan is temporarily unavailable." }, 503); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_PLANS_MANAGE, { request }); if (auth.response) return auth.response;
  const id = CommissionPlanParamsSchema.safeParse(await params); if (!id.success) return commissionNoStoreJson({ error: "Commission plan was not found." }, 404);
  const payload = await prepareCommissionMutation(request, auth.user.id, "/api/admin/commission-plans/[id]", "plan"); if ("response" in payload) return payload.response;
  const parsed = CommissionPlanUpdateSchema.safeParse(payload.body); if (!parsed.success) return commissionNoStoreJson({ error: "Invalid commission plan draft." }, 422);
  try { const plan = await updateDraftCommissionPlan(id.data.id, { ...parsed.data, actorUserId: auth.user.id }); return commissionNoStoreJson({ plan }); }
  catch (error) { return commissionApiError(error); }
}
