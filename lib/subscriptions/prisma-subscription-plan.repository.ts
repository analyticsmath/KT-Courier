/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 22 Prisma client generation is deferred. */
import { prisma } from "@/lib/db/prisma";
import type { SubscriptionPlanLifecycleRepository } from "@/lib/subscriptions/subscription-plan.service";

const db = prisma as any;
export function createPrismaSubscriptionPlanLifecycleRepository(database: any = db): SubscriptionPlanLifecycleRepository {
  return Object.freeze({
    async getPlan(reference) { const plan = await database.subscriptionPlanVersion.findUnique({ where: { publicReference: reference }, select: { id: true, status: true, currency: true, priceAmount: true, contractTermType: true, effectiveFrom: true, effectiveUntil: true } }); return plan && { ...plan, priceAmount: plan.priceAmount.toFixed(2) }; },
    async transitionPlan({ id, from, to, actorUserId, operationId, rejectionReason }) {
      await database.$transaction(async (tx: any) => {
        const plan = await tx.subscriptionPlanVersion.findUnique({ where: { id } }); if (!plan || plan.status !== from) throw new Error("STALE_SUBSCRIPTION_PLAN");
        const at = new Date(); await tx.subscriptionPlanVersion.update({ where: { id }, data: { status: to, approvedByUserId: to === "APPROVED" ? actorUserId : plan.approvedByUserId, approvedAt: to === "APPROVED" ? at : plan.approvedAt, activatedAt: to === "ACTIVE" ? at : plan.activatedAt, retiredAt: to === "RETIRED" ? at : plan.retiredAt, rejectedAt: to === "REJECTED" ? at : plan.rejectedAt, rejectionReason: to === "REJECTED" ? rejectionReason : plan.rejectionReason } });
        await tx.subscriptionPlanVersionStatusHistory.create({ data: { planVersionId: id, fromStatus: from, toStatus: to, actorUserId, operationId, reasonCode: rejectionReason ?? null } });
      });
    },
  });
}
