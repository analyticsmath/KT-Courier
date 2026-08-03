import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { createCommissionPlan } from "@/lib/services/commission-plan.service";
import { listCommissionPlans } from "@/lib/services/commission-plan-query.service";
import { CommissionPlanCreateSchema, CommissionPlanListQuerySchema, commissionSearchParams } from "@/lib/validation/commissions";
import { commissionApiError, commissionNoStoreJson } from "@/lib/commissions/api-policy";
import { prepareCommissionMutation } from "@/lib/commissions/admin-mutation-route";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_PLANS_READ, { request }); if (auth.response) return auth.response;
  const parsed = CommissionPlanListQuerySchema.safeParse(commissionSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return commissionNoStoreJson({ error: "Invalid commission plan filters." }, 422);
  try { return commissionNoStoreJson(await listCommissionPlans(parsed.data)); }
  catch { return commissionNoStoreJson({ error: "Commission plans are temporarily unavailable." }, 503); }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_PLANS_MANAGE, { request }); if (auth.response) return auth.response;
  const payload = await prepareCommissionMutation(request, auth.user.id, "/api/admin/commission-plans", "plan"); if ("response" in payload) return payload.response;
  const parsed = CommissionPlanCreateSchema.safeParse(payload.body); if (!parsed.success) return commissionNoStoreJson({ error: "Invalid commission plan draft." }, 422);
  try { const plan = await createCommissionPlan({ ...parsed.data, actorUserId: auth.user.id }); return commissionNoStoreJson({ plan }, 201); }
  catch (error) { return commissionApiError(error); }
}
