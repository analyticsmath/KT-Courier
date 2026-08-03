import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { retireCommissionPlan } from "@/lib/services/commission-plan.service";
import { runCommissionPlanAction } from "@/lib/commissions/admin-plan-action";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return runCommissionPlanAction(request, params, "/api/admin/commission-plans/[id]/retire", PERMISSIONS.COMMISSION_PLANS_APPROVE, retireCommissionPlan); }
