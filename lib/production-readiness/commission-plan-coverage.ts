type CommissionPlanCandidate = Readonly<{
  subjectType: string;
  scopeKey: string;
  currency: string;
  status: string;
  basisType: string;
  effectiveFrom: Date | string;
  effectiveUntil: Date | string | null;
  calculationVersion: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | string | null;
  rules: readonly unknown[];
}>;

type CommissionCoverageInput = Readonly<{
  now: Date;
  activeStoreIds: readonly string[];
  plans: readonly CommissionPlanCandidate[];
}>;

function isCurrentIndependentlyApprovedPlan(plan: CommissionPlanCandidate, now: Date): boolean {
  const effectiveFrom = new Date(plan.effectiveFrom).getTime();
  const effectiveUntil = plan.effectiveUntil === null ? null : new Date(plan.effectiveUntil).getTime();
  const approvedAt = plan.approvedAt === null ? null : new Date(plan.approvedAt).getTime();
  return plan.currency === "ZAR" && plan.status === "ACTIVE" &&
    Number.isFinite(effectiveFrom) && effectiveFrom <= now.getTime() &&
    (effectiveUntil === null || (Number.isFinite(effectiveUntil) && effectiveUntil > now.getTime())) &&
    approvedAt !== null && Number.isFinite(approvedAt) && approvedAt <= now.getTime() &&
    !!plan.approvedByUserId && plan.approvedByUserId !== plan.createdByUserId &&
    !!plan.calculationVersion.trim() && plan.rules.length > 0;
}

export function evaluateCommissionPlanCoverage(input: CommissionCoverageInput) {
  const activeStoreIds = [...new Set(input.activeStoreIds)];
  const candidates = input.plans.filter((plan) => isCurrentIndependentlyApprovedPlan(plan, input.now));
  const courierPlans = candidates.filter((plan) =>
    plan.subjectType === "COURIER_ORDER" && plan.scopeKey === "GLOBAL:COURIER_ORDER",
  );
  const storePlanCounts = new Map<string, number>();
  for (const plan of candidates) {
    if (plan.subjectType !== "MARKETPLACE_STORE_ORDER" || plan.basisType !== "ORDER_SUBTOTAL") continue;
    const match = /^STORE:(.+)$/.exec(plan.scopeKey);
    if (!match || !activeStoreIds.includes(match[1]!)) continue;
    storePlanCounts.set(match[1]!, (storePlanCounts.get(match[1]!) ?? 0) + 1);
  }

  const missingStorePlanCount = activeStoreIds.filter((id) => !storePlanCounts.has(id)).length;
  const ambiguousStorePlanCount = activeStoreIds.filter((id) => (storePlanCounts.get(id) ?? 0) > 1).length;
  const courierPlanReady = courierPlans.length === 1;
  const ready = courierPlanReady && missingStorePlanCount === 0 && ambiguousStorePlanCount === 0;
  const reasonCode = ready
    ? "APPROVED_COMMISSION_SCOPE_COVERAGE_CURRENT"
    : !courierPlanReady
      ? courierPlans.length > 1 ? "COURIER_COMMISSION_SCOPE_AMBIGUOUS" : "COURIER_COMMISSION_PLAN_MISSING"
      : ambiguousStorePlanCount > 0
        ? "STORE_COMMISSION_SCOPE_AMBIGUOUS"
        : "STORE_COMMISSION_PLAN_COVERAGE_INCOMPLETE";

  return {
    ready,
    reasonCode,
    summary: ready
      ? "Current independently approved courier and active-store commission plans cover launch settlement scopes."
      : "Require one current independently approved global courier plan and one current marketplace subtotal plan for every active store; drafts and unrelated scopes do not count.",
    evidence: {
      activeStoreCount: activeStoreIds.length,
      courierPlanCount: courierPlans.length,
      activeStorePlanCount: activeStoreIds.filter((id) => storePlanCounts.get(id) === 1).length,
      missingStorePlanCount,
      ambiguousStorePlanCount,
    },
  } as const;
}
