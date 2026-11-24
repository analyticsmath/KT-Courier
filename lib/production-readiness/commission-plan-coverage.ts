type CommissionDecimalLike = { toString(): string } | string | number;

type CommissionRuleCandidate = Readonly<{
  id?: string;
  ruleCode?: string | null;
  allocationType?: string | null;
  beneficiaryType?: string | null;
  calculationMethod?: string | null;
  rateBasisPoints?: number | null;
  fixedAmount?: CommissionDecimalLike | null;
  minimumAmount?: CommissionDecimalLike | null;
  maximumAmount?: CommissionDecimalLike | null;
  priority?: number | null;
}>;

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
  rules: readonly (CommissionRuleCandidate | unknown)[];
}>;

type CommissionCoverageInput = Readonly<{
  now: Date;
  activeStoreIds: readonly string[];
  plans: readonly CommissionPlanCandidate[];
}>;

function parseNonNegativeAmount(value: CommissionDecimalLike | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === "number" ? String(value) : value.toString().trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return Number.NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function rulesHaveValidBounds(
  rules: readonly unknown[],
  subjectType: string,
): boolean {
  if (!Array.isArray(rules) || rules.length === 0) return false;
  let totalBps = 0;
  const seenCodes = new Set<string>();
  const seenPriorities = new Set<number>();

  for (const raw of rules) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return false;
    }
    const rule = raw as CommissionRuleCandidate;

    if (rule.ruleCode !== undefined) {
      const code = typeof rule.ruleCode === "string" ? rule.ruleCode.trim().toUpperCase() : "";
      if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(code) || seenCodes.has(code)) {
        return false;
      }
      seenCodes.add(code);
    }

    if (rule.priority !== undefined) {
      if (!Number.isInteger(rule.priority) || seenPriorities.has(rule.priority!)) {
        return false;
      }
      seenPriorities.add(rule.priority!);
    }

    if (rule.allocationType != null || rule.beneficiaryType != null) {
      if (
        (rule.allocationType !== "PLATFORM_COMMISSION_REVENUE" && rule.allocationType !== "BENEFICIARY_COMMISSION_PAYABLE") ||
        (rule.beneficiaryType !== "PLATFORM" && rule.beneficiaryType !== "PROMOTER") ||
        (rule.allocationType === "PLATFORM_COMMISSION_REVENUE") !== (rule.beneficiaryType === "PLATFORM")
      ) {
        return false;
      }
      if (subjectType === "MARKETPLACE_STORE_ORDER" && rule.beneficiaryType !== "PLATFORM") {
        return false;
      }
    }

    const min = parseNonNegativeAmount(rule.minimumAmount);
    const max = parseNonNegativeAmount(rule.maximumAmount);
    if (Number.isNaN(min) || Number.isNaN(max)) return false;
    if (min !== null && max !== null && min > max) return false;

    if (rule.calculationMethod === "PERCENTAGE_BPS") {
      if (
        !Number.isInteger(rule.rateBasisPoints) ||
        rule.rateBasisPoints! < 0 ||
        rule.rateBasisPoints! > 10000 ||
        rule.fixedAmount != null
      ) {
        return false;
      }
      totalBps += rule.rateBasisPoints!;
    } else if (rule.calculationMethod === "FIXED_AMOUNT") {
      const fixed = parseNonNegativeAmount(rule.fixedAmount);
      if (fixed === null || Number.isNaN(fixed) || (rule.rateBasisPoints !== undefined && rule.rateBasisPoints !== null)) {
        return false;
      }
    } else {
      return false;
    }
  }
  return totalBps <= 10000;
}

function isCurrentIndependentlyApprovedPlan(plan: CommissionPlanCandidate, now: Date): boolean {
  const effectiveFrom = new Date(plan.effectiveFrom).getTime();
  const effectiveUntil = plan.effectiveUntil === null ? null : new Date(plan.effectiveUntil).getTime();
  const approvedAt = plan.approvedAt === null ? null : new Date(plan.approvedAt).getTime();
  const validBasis =
    plan.subjectType === "MARKETPLACE_STORE_ORDER"
      ? plan.basisType === "ORDER_SUBTOTAL"
      : plan.basisType === "ORDER_SUBTOTAL" || plan.basisType === "ORDER_TOTAL";
  return (
    validBasis &&
    plan.currency === "ZAR" &&
    plan.status === "ACTIVE" &&
    Number.isFinite(effectiveFrom) &&
    effectiveFrom <= now.getTime() &&
    (effectiveUntil === null || (Number.isFinite(effectiveUntil) && effectiveUntil > now.getTime() && effectiveUntil > effectiveFrom)) &&
    approvedAt !== null &&
    Number.isFinite(approvedAt) &&
    approvedAt <= now.getTime() &&
    !!plan.approvedByUserId &&
    plan.approvedByUserId !== plan.createdByUserId &&
    !!plan.calculationVersion.trim() &&
    rulesHaveValidBounds(plan.rules, plan.subjectType)
  );
}

export function evaluateCommissionPlanCoverage(input: CommissionCoverageInput) {
  const activeStoreIds = [...new Set(input.activeStoreIds)];
  const candidates = input.plans.filter((plan) => isCurrentIndependentlyApprovedPlan(plan, input.now));
  const courierPlans = candidates.filter((plan) => plan.subjectType === "COURIER_ORDER" && plan.scopeKey === "GLOBAL:COURIER_ORDER");
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
      ? courierPlans.length > 1
        ? "COURIER_COMMISSION_SCOPE_AMBIGUOUS"
        : "COURIER_COMMISSION_PLAN_MISSING"
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
