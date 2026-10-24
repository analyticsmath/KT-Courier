import { prisma } from "@/lib/db/prisma";

type PlanEvidence = Readonly<{
  id: string;
  publicReference: string;
  versionNumber: number;
  status: string;
  approvedAt: Date | null;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  rules: readonly { id: string }[];
}>;
type EntitlementRestriction = Readonly<{ planReference: string | null; planVersion: number | null }> | null;

export type StoreCommissionReadiness = Readonly<{
  ready: boolean;
  status: "READY" | "MISSING" | "NOT_APPROVED" | "APPROVED_NOT_ACTIVE" |
    "OUTSIDE_EFFECTIVE_PERIOD" | "ENTITLEMENT_MISMATCH";
  planId: string | null;
  planReference: string | null;
}>;

function result(status: StoreCommissionReadiness["status"], plan?: PlanEvidence): StoreCommissionReadiness {
  return Object.freeze({ status, ready: status === "READY", planId: plan?.id ?? null, planReference: plan?.publicReference ?? null });
}

/** Read-only projection of the same store, approval, period, rule and
 * subscription-entitlement constraints required by settlement review.
 * Never invent a commission or permit checkout based on a draft.
 */
export function classifyStoreCommissionReadiness(
  plans: readonly PlanEvidence[],
  entitlement: EntitlementRestriction,
  at: Date = new Date(),
): StoreCommissionReadiness {
  if (!plans.length) return result("MISSING");
  const mostRecent = [...plans].sort((a, b) => b.versionNumber - a.versionNumber)[0]!;
  const currentlyApproved = plans.filter(plan =>
    plan.status === "ACTIVE" && Boolean(plan.approvedAt) && plan.rules.length > 0 &&
    plan.effectiveFrom <= at && (plan.effectiveUntil === null || plan.effectiveUntil > at));
  if (!currentlyApproved.length) {
    const anyActive = plans.find(plan => plan.status === "ACTIVE");
    if (anyActive?.approvedAt && anyActive.rules.length > 0) return result("OUTSIDE_EFFECTIVE_PERIOD", anyActive);
    if (mostRecent.status === "APPROVED") return result("APPROVED_NOT_ACTIVE", mostRecent);
    return result("NOT_APPROVED", mostRecent);
  }
  if (entitlement) {
    const matching = currentlyApproved.find(plan =>
      plan.publicReference === entitlement.planReference &&
      (entitlement.planVersion === null || plan.versionNumber === entitlement.planVersion));
    return matching ? result("READY", matching) : result("ENTITLEMENT_MISMATCH", currentlyApproved[0]);
  }
  return result("READY", currentlyApproved.sort((a, b) => b.versionNumber - a.versionNumber)[0]);
}

export async function getStoreCommissionReadiness(
  storeId: string,
  database: Pick<typeof prisma, "commissionPlan" | "subscriptionEntitlementGrant"> = prisma,
  at: Date = new Date(),
): Promise<StoreCommissionReadiness> {
  const [plans, entitlementGrant] = await Promise.all([
    database.commissionPlan.findMany({
      where: { subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${storeId}`, currency: "ZAR" },
      select: { id: true, publicReference: true, versionNumber: true, status: true,
        approvedAt: true, effectiveFrom: true, effectiveUntil: true, rules: { select: { id: true } } },
      orderBy: { versionNumber: "desc" },
    }),
    database.subscriptionEntitlementGrant.findFirst({
      where: {
        storeId, status: "ACTIVE", effectiveFrom: { lte: at }, effectiveUntil: { gt: at },
        billingCycle: { status: "PAID" },
        contract: { status: { in: ["ACTIVE", "CANCELLATION_SCHEDULED"] } },
        benefitDefinition: { benefitType: "APPROVED_COMMISSION_PLAN_ELIGIBILITY", permittedConsumingPhase: "CHECKOUT_REVIEW" },
      },
      select: { benefitDefinition: { select: { eligibilityConditions: true } } },
      orderBy: { effectiveUntil: "asc" },
    }),
  ]);
  const conditions = entitlementGrant?.benefitDefinition.eligibilityConditions;
  const conditionObject = conditions && typeof conditions === "object" && !Array.isArray(conditions) ? conditions : null;
  const entitlement = entitlementGrant ? {
    planReference: typeof conditionObject?.approvedCommissionPlanReference === "string"
      ? conditionObject.approvedCommissionPlanReference : null,
    planVersion: typeof conditionObject?.approvedCommissionPlanVersion === "number"
      ? conditionObject.approvedCommissionPlanVersion : null,
  } : null;
  return classifyStoreCommissionReadiness(plans, entitlement, at);
}
