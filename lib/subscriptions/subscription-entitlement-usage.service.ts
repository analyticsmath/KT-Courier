/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is intentionally deferred to Phase 26.5. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertEntitlementUsage } from "@/lib/subscriptions/entitlement-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";

type UsageAction = "RESERVE" | "CONSUME" | "RELEASE" | "REVERSE";
const db = prisma as any;
const ref = (prefix: string, value: string) => `${prefix}_${value.replace(/[^A-Za-z0-9_-]/g, "").slice(-36)}`;

export type SubscriptionEntitlementUsageRepository = Readonly<{
  apply(input: Readonly<{ grantReference: string; action: UsageAction; operationId: string; requestHash: string; amount: string | null; quantity: number | null; sourceType: "PRICING_QUOTE" | "MARKETPLACE_CHECKOUT" | "MARKETPLACE_ORDER" | "REFUND"; sourceReference: string }>): Promise<Readonly<{ usageReference: string; replayed: boolean; remainingAmount: string | null; remainingQuantity: number | null }>>;
}>;

export async function reserveDeliveryEntitlement(repository: SubscriptionEntitlementUsageRepository, input: Parameters<SubscriptionEntitlementUsageRepository["apply"]>[0]) { return repository.apply({ ...input, action: "RESERVE" }); }
export async function consumeDeliveryEntitlement(repository: SubscriptionEntitlementUsageRepository, input: Parameters<SubscriptionEntitlementUsageRepository["apply"]>[0]) { return repository.apply({ ...input, action: "CONSUME" }); }
export async function releaseDeliveryEntitlement(repository: SubscriptionEntitlementUsageRepository, input: Parameters<SubscriptionEntitlementUsageRepository["apply"]>[0]) { return repository.apply({ ...input, action: "RELEASE" }); }
export async function reverseDeliveryEntitlement(repository: SubscriptionEntitlementUsageRepository, input: Parameters<SubscriptionEntitlementUsageRepository["apply"]>[0]) { return repository.apply({ ...input, action: "REVERSE" }); }

export function createPrismaSubscriptionEntitlementUsageRepository(database: any = db): SubscriptionEntitlementUsageRepository {
  return Object.freeze({
    async apply(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionEntitlementGrant" WHERE "publicReference" = ${input.grantReference} FOR UPDATE`);
        const grant = await tx.subscriptionEntitlementGrant.findUnique({ where: { publicReference: input.grantReference } });
        if (!grant || grant.status !== "ACTIVE" || grant.effectiveUntil <= new Date()) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_INVALID", "Subscription entitlement is not active.");
        const existing = await tx.subscriptionEntitlementUsage.findUnique({ where: { grantId_operationId_action: { grantId: grant.id, operationId: input.operationId, action: input.action } } });
        if (existing) {
          if (existing.requestHash !== input.requestHash) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_INVALID", "Entitlement operation was reused with different meaning.");
          return { usageReference: existing.publicReference, replayed: true, remainingAmount: grant.remainingAmount?.toFixed(2) ?? null, remainingQuantity: grant.remainingQuantity ?? null };
        }
        if (input.action === "RESERVE") assertEntitlementUsage({ action: input.action, amount: input.amount, quantity: input.quantity, remainingAmount: grant.remainingAmount?.toFixed(2) ?? null, remainingQuantity: grant.remainingQuantity });
        if (input.action === "CONSUME" || input.action === "RELEASE") {
          const reservation = await tx.subscriptionEntitlementUsage.findFirst({ where: { grantId: grant.id, action: "RESERVE", sourceReference: input.sourceReference }, select: { id: true } });
          if (!reservation) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_INVALID", "Entitlement consumption or release requires its prior reservation.");
        }
        // Reservations debit available allowance. Consumption settles that
        // reservation without a second debit; release restores it; reversal
        // preserves consumed evidence for refund reconciliation.
        const isDebit = input.action === "RESERVE";
        const isCredit = input.action === "RELEASE";
        const amountDelta = input.amount ? new Prisma.Decimal(input.amount) : null;
        const quantityDelta = input.quantity ?? null;
        const nextAmount = amountDelta && grant.remainingAmount ? (isDebit ? grant.remainingAmount.minus(amountDelta) : isCredit ? grant.remainingAmount.plus(amountDelta) : grant.remainingAmount) : grant.remainingAmount;
        const nextQuantity = quantityDelta !== null && grant.remainingQuantity !== null ? (isDebit ? grant.remainingQuantity - quantityDelta : isCredit ? grant.remainingQuantity + quantityDelta : grant.remainingQuantity) : grant.remainingQuantity;
        if ((nextAmount && nextAmount.lessThan(0)) || (nextQuantity !== null && nextQuantity < 0)) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_EXHAUSTED", "Entitlement usage exceeds its paid grant.");
        if ((nextAmount && grant.originalAmount && nextAmount.greaterThan(grant.originalAmount)) || (nextQuantity !== null && grant.originalQuantity !== null && nextQuantity > grant.originalQuantity)) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_INVALID", "Entitlement release exceeds its original paid grant.");
        const exhausted = (nextAmount?.equals(0) ?? false) || nextQuantity === 0;
        const usage = await tx.subscriptionEntitlementUsage.create({ data: { publicReference: ref("subuse", `${grant.id}_${input.action}_${input.operationId}`), grantId: grant.id, operationId: input.operationId, requestHash: input.requestHash, action: input.action, amount: input.amount, quantity: input.quantity, sourceType: input.sourceType, sourceReference: input.sourceReference } });
        await tx.subscriptionEntitlementGrant.update({ where: { id: grant.id }, data: { remainingAmount: nextAmount, remainingQuantity: nextQuantity, status: exhausted ? "EXHAUSTED" : "ACTIVE", ...(exhausted ? { exhaustedAt: new Date() } : {}) } });
        return { usageReference: usage.publicReference, replayed: false, remainingAmount: nextAmount?.toFixed(2) ?? null, remainingQuantity: nextQuantity };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
  });
}
