import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getCommissionPlan } from "@/lib/services/commission-plan-query.service";
import { previewCommissionPlan } from "@/lib/services/commission-preview.service";
import { CommissionPlanParamsSchema, CommissionPlanPreviewSchema } from "@/lib/validation/commissions";
import { commissionApiError, commissionNoStoreJson } from "@/lib/commissions/api-policy";
import { prepareCommissionMutation } from "@/lib/commissions/admin-mutation-route";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_PLANS_READ, { request }); if (auth.response) return auth.response;
  const id = CommissionPlanParamsSchema.safeParse(await params); if (!id.success) return commissionNoStoreJson({ error: "Commission plan was not found." }, 404);
  const payload = await prepareCommissionMutation(request, auth.user.id, "/api/admin/commission-plans/[id]/preview", "plan"); if ("response" in payload) return payload.response;
  const parsed = CommissionPlanPreviewSchema.safeParse(payload.body); if (!parsed.success) return commissionNoStoreJson({ error: "Invalid non-authoritative preview values." }, 422);
  try {
    const plan = await getCommissionPlan(id.data.id); if (!plan) return commissionNoStoreJson({ error: "Commission plan was not found." }, 404);
    const preview = previewCommissionPlan({ plan: { basisType: plan.basisType, calculationVersion: plan.calculationVersion, rules: plan.rules.map((rule) => ({ id: rule.publicReference, ...rule, fixedAmount: rule.fixedAmount ? new Prisma.Decimal(rule.fixedAmount) : null, minimumAmount: rule.minimumAmount ? new Prisma.Decimal(rule.minimumAmount) : null, maximumAmount: rule.maximumAmount ? new Prisma.Decimal(rule.maximumAmount) : null })) }, basis: { subjectType: "COURIER_ORDER", subjectId: "preview", subjectPublicReference: "PREVIEW", pricingReference: "preview", pricingVersion: "preview", subtotal: parsed.data.subtotal, tax: parsed.data.tax, total: parsed.data.total, currency: "ZAR", authoritativeAt: "2026-01-01T00:00:00.000Z" }, beneficiaries: parsed.data.beneficiary ? [{ beneficiaryType: "PROMOTER", ...parsed.data.beneficiary }] : [] });
    return commissionNoStoreJson({ preview, authoritative: false, notice: "Preview only. No financial evidence was created." });
  } catch (error) { return commissionApiError(error); }
}
