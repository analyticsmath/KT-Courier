import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createCommissionPlanDraftInTransaction } from "@/lib/services/commission-plan.service";

export const OWNER_COMMISSION_DEFAULTS_APPROVAL = "OWNER_SELECTED_DOCUMENTS_OR_8_PERCENT_2026_10_14";

/** Prepare editable policies only where no operator-authored version exists. */
export async function prepareOwnerSelectedCommissionDefaults(actorUserId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('owner-selected-commission-defaults'))`;
    const stores = await tx.store.findMany({ where: { status: "ACTIVE" }, select: { id: true }, orderBy: { id: "asc" } });
    const scopes = [
      { subjectType: "COURIER_ORDER" as const, scopeKey: "GLOBAL:COURIER_ORDER", rateBasisPoints: 3000 },
      ...stores.map(store => ({ subjectType: "MARKETPLACE_STORE_ORDER" as const, scopeKey: `STORE:${store.id}`, rateBasisPoints: 800 })),
    ];
    let prepared = 0;
    let preserved = 0;
    const effectiveFrom = new Date().toISOString();
    for (const scope of scopes) {
      // Even DRAFT or retired operator terms are authoritative; never replace them.
      if (await tx.commissionPlan.findFirst({ where: { subjectType: scope.subjectType, scopeKey: scope.scopeKey, currency: "ZAR" }, select: { id: true } })) {
        preserved++;
        continue;
      }
      const plan = await createCommissionPlanDraftInTransaction(tx, {
        subjectType: scope.subjectType, scopeKey: scope.scopeKey, basisType: "ORDER_SUBTOTAL",
        effectiveFrom, calculationVersion: "owner-selected-commission-defaults-v1",
        actorUserId, operationId: `${OWNER_COMMISSION_DEFAULTS_APPROVAL}:${scope.scopeKey}`,
        rules: [{ ruleCode: "KT_PLATFORM_COMMISSION", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: scope.rateBasisPoints, priority: 1, isRequired: true }],
      });
      await tx.adminActivityLog.create({ data: {
        actorUserId, action: "CREATE", entityType: "CommissionPlan", entityId: plan.id,
        message: "Prepared editable owner-selected commission defaults for independent review.",
        metadata: { approvalReference: OWNER_COMMISSION_DEFAULTS_APPROVAL, authorizedMaintenance: true, subjectType: scope.subjectType, scopeKey: scope.scopeKey, rateBasisPoints: scope.rateBasisPoints, status: "DRAFT", independentReviewRequired: true, chargeCreated: false },
      } });
      prepared++;
    }
    return { prepared, preserved, status: "DRAFT" as const, independentReviewRequired: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
