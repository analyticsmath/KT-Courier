/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is deferred to Phase 26.5. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import type { SubscriptionCancellationRepository } from "@/lib/subscriptions/subscription-cancellation.service";
import type { SubscriptionEntitlementRefundRepository } from "@/lib/subscriptions/subscription-entitlement-refund.service";
import type { SubscriptionProviderSynchronizationRepository } from "@/lib/subscriptions/subscription-provider-synchronization.service";

const db = prisma as any;
const reference = (prefix: string, value: string) => `${prefix}_${value.replace(/[^A-Za-z0-9_-]/g, "").slice(-48)}`;
const providerAuthority = (authority: any, contract: any) => authority?.providerSubscriptionReference
  ? Object.freeze({ authorityReference: authority.publicReference, contractReference: contract.publicReference, providerSubscriptionReference: authority.providerSubscriptionReference, tokenFingerprint: authority.providerTokenFingerprint ?? null })
  : undefined;
async function receipt(tx: any, contractId: string, operationId: string, operationType: string, outcome: string, safeEvidence: Record<string, unknown>) {
  await tx.subscriptionOperationReceipt.upsert({ where: { operationId }, create: { publicReference: reference("subop", operationId), contractId, operationId, operationType, requestHash: `${operationType}:${operationId}`, outcome, safeEvidence, completedAt: new Date() }, update: {} });
}

function cancellationCase(tx: any, contract: any, authority: any, operationId: string, reason: string) {
  return tx.subscriptionReconciliationCase.upsert({
    where: { caseKey: `subscription-cancellation:${contract.id}:${reason}` },
    create: { publicReference: reference("subrec", `${contract.id}_${reason}`), caseKey: `subscription-cancellation:${contract.id}:${reason}`, contractId: contract.id, providerAuthorityId: authority?.id ?? null, reason: "CANCELLATION_PROVIDER_MISMATCH", priority: "HIGH", safeSummary: "Subscription cancellation evidence requires reconciliation.", safeEvidence: { operationId, reason } },
    update: { lastObservedAt: new Date(), safeEvidence: { operationId, reason } },
  });
}

export function createPrismaSubscriptionCancellationRepository(database: any = db): SubscriptionCancellationRepository {
  return Object.freeze({
    async requestRollingCancellation(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "publicReference" = ${input.contractReference} FOR UPDATE`);
        const contract = await tx.subscriptionContract.findUnique({ where: { publicReference: input.contractReference }, include: { paymentAuthority: true } });
        if (!contract || contract.payerUserId !== input.payerUserId || (contract.storeId && !input.storePayerAuthorised) || !contract.currentPeriodEnd) throw new SubscriptionError("SUBSCRIPTION_ACCESS_DENIED", "Subscription cancellation is not available to this payer.");
        const prior = await tx.subscriptionContractStatusHistory.findUnique({ where: { contractId_operationId: { contractId: contract.id, operationId: input.operationId } } });
        if (prior) return { outcome: "REPLAY" as const, contractReference: contract.publicReference, effectiveAt: contract.cancellationEffectiveAt ?? contract.currentPeriodEnd };
        if (contract.status === "CANCELLATION_SCHEDULED") return { outcome: "REPLAY" as const, contractReference: contract.publicReference, effectiveAt: contract.cancellationEffectiveAt ?? contract.currentPeriodEnd };
        if (!["ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED"].includes(contract.status) || contract.contractTermType !== "ROLLING_MONTH_TO_MONTH") throw new SubscriptionError("SUBSCRIPTION_CONTRACT_TRANSITION_INVALID", "Subscription is not in a cancellable rolling state.");
        const effectiveAt = contract.currentPeriodEnd;
        await tx.subscriptionContract.update({ where: { id: contract.id }, data: { status: "CANCELLATION_SCHEDULED", cancellationScheduledAt: new Date(), cancellationEffectiveAt: effectiveAt, version: { increment: 1 } } });
        await tx.subscriptionCancellationNotice.upsert({ where: { publicReference: reference("subcancel", input.operationId) }, create: { publicReference: reference("subcancel", input.operationId), contractId: contract.id, requestType: "ROLLING_END_OF_PERIOD", proposedEffectiveAt: effectiveAt, legalPolicyVersion: input.legalPolicyVersion, safeEvidence: { operationId: input.operationId } }, update: {} });
        await tx.subscriptionRenewalJob.updateMany({ where: { contractId: contract.id, billingCycle: { periodStart: { gte: effectiveAt } }, status: { notIn: ["COMPLETED", "CANCELLED"] } }, data: { status: "CANCELLED", completedAt: new Date(), lastSafeError: "CANCELLATION_SCHEDULED" } });
        await tx.subscriptionContractStatusHistory.create({ data: { contractId: contract.id, fromStatus: contract.status, toStatus: "CANCELLATION_SCHEDULED", actorType: "PAYER", actorUserId: input.payerUserId, operationId: input.operationId, safeMetadata: { effectiveAt: effectiveAt.toISOString() } } });
        await tx.subscriptionEventIntent.upsert({ where: { contractId_type_operationId: { contractId: contract.id, type: "SUBSCRIPTION_CANCELLATION_SCHEDULED", operationId: input.operationId } }, create: { publicReference: reference("subevt", input.operationId), contractId: contract.id, type: "SUBSCRIPTION_CANCELLATION_SCHEDULED", operationId: input.operationId, safePayload: { effectiveAt: effectiveAt.toISOString() } }, update: {} });
        await receipt(tx, contract.id, input.operationId, "CANCELLATION_REQUEST", "SCHEDULED", { effectiveAt: effectiveAt.toISOString() });
        return { outcome: "SCHEDULED" as const, contractReference: contract.publicReference, effectiveAt, authorityReference: contract.paymentAuthority?.publicReference };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async loadProviderCancellation(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "publicReference" = ${input.contractReference} FOR UPDATE`);
        const contract = await tx.subscriptionContract.findUnique({ where: { publicReference: input.contractReference }, include: { paymentAuthority: true } });
        if (!contract || contract.status !== "CANCELLATION_SCHEDULED") return { outcome: "NOT_REQUIRED" as const };
        const authority = contract.paymentAuthority;
        if (authority) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionPaymentAuthority" WHERE "id" = ${authority.id} FOR UPDATE`);
        if (!authority || authority.status === "RECONCILIATION_REQUIRED") return { outcome: "RECONCILIATION_REQUIRED" as const };
        if (authority.status === "CANCELLED") return { outcome: "REPLAY" as const };
        const resolved = providerAuthority(authority, contract);
        return resolved ? { outcome: "READY" as const, providerAuthority: resolved } : { outcome: "RECONCILIATION_REQUIRED" as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async persistProviderCancellation(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "publicReference" = ${input.contractReference} FOR UPDATE`);
        const contract = await tx.subscriptionContract.findUnique({ where: { publicReference: input.contractReference }, include: { paymentAuthority: true } });
        if (!contract?.paymentAuthority) return { outcome: "RECONCILIATION_REQUIRED" as const };
        const authority = contract.paymentAuthority;
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionPaymentAuthority" WHERE "id" = ${authority.id} FOR UPDATE`);
        if (authority.status === "CANCELLED") return { outcome: "REPLAY" as const };
        if (input.status !== "CANCELLED") {
          await tx.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { status: "RECONCILIATION_REQUIRED", lastSynchronizedAt: new Date(), version: { increment: 1 } } });
          await cancellationCase(tx, contract, authority, input.operationId, input.status === "UNKNOWN" ? "PROVIDER_STATUS_UNKNOWN" : "CANCELLATION_PROVIDER_MISMATCH");
          return { outcome: "RECONCILIATION_REQUIRED" as const };
        }
        await tx.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { status: "CANCELLED", cancelledAt: new Date(), lastSynchronizedAt: new Date(), version: { increment: 1 } } });
        await receipt(tx, contract.id, input.operationId, "CANCELLATION_PROVIDER", "APPLIED", input.safeEvidence);
        return { outcome: "APPLIED" as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async applyEffectiveCancellation(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "publicReference" = ${input.contractReference} FOR UPDATE`);
        const contract = await tx.subscriptionContract.findUnique({ where: { publicReference: input.contractReference } });
        if (!contract) return { outcome: "RECONCILIATION_REQUIRED" as const };
        if (contract.status === "CANCELLED") return { outcome: "REPLAY" as const };
        if (contract.status !== "CANCELLATION_SCHEDULED" || !contract.cancellationEffectiveAt) return { outcome: "NOT_DUE" as const };
        if (contract.cancellationEffectiveAt > input.at) return { outcome: "NOT_DUE" as const };
        const grants = await tx.subscriptionEntitlementGrant.findMany({ where: { contractId: contract.id, status: { in: ["ACTIVE", "EXHAUSTED"] } }, select: { id: true } });
        for (const grant of grants) {
          await tx.subscriptionEntitlementUsage.upsert({ where: { grantId_operationId_action: { grantId: grant.id, operationId: `${input.operationId}:${grant.id}`, action: "EXPIRE" } }, create: { publicReference: reference("subuse", `${input.operationId}_${grant.id}`), grantId: grant.id, operationId: `${input.operationId}:${grant.id}`, requestHash: `cancellation:${input.operationId}`, action: "EXPIRE", amount: null, quantity: null, sourceType: "SYSTEM", sourceReference: contract.publicReference }, update: {} });
        }
        const expired = await tx.subscriptionEntitlementGrant.updateMany({ where: { id: { in: grants.map((grant: any) => grant.id) } }, data: { status: "EXPIRED" } });
        const jobs = await tx.subscriptionRenewalJob.updateMany({ where: { contractId: contract.id, status: { notIn: ["COMPLETED", "CANCELLED"] } }, data: { status: "CANCELLED", completedAt: new Date(), lastSafeError: "CANCELLATION_EFFECTIVE" } });
        await tx.subscriptionInvoice.updateMany({ where: { contractId: contract.id, billingCycle: { periodStart: { gte: contract.cancellationEffectiveAt } }, status: "ISSUED" }, data: { status: "VOID", voidedAt: new Date() } });
        await tx.subscriptionContract.update({ where: { id: contract.id }, data: { status: "CANCELLED", cancelledAt: input.at, version: { increment: 1 } } });
        await tx.subscriptionContractStatusHistory.upsert({ where: { contractId_operationId: { contractId: contract.id, operationId: input.operationId } }, create: { contractId: contract.id, fromStatus: "CANCELLATION_SCHEDULED", toStatus: "CANCELLED", actorType: "SYSTEM", operationId: input.operationId, safeMetadata: { effectiveAt: contract.cancellationEffectiveAt.toISOString() } }, update: {} });
        await tx.subscriptionEventIntent.upsert({ where: { contractId_type_operationId: { contractId: contract.id, type: "SUBSCRIPTION_CANCELLED", operationId: input.operationId } }, create: { publicReference: reference("subevt", input.operationId), contractId: contract.id, type: "SUBSCRIPTION_CANCELLED", operationId: input.operationId, safePayload: { effectiveAt: contract.cancellationEffectiveAt.toISOString() } }, update: {} });
        await receipt(tx, contract.id, input.operationId, "CANCELLATION_EFFECTIVE", "CANCELLED", { effectiveAt: contract.cancellationEffectiveAt.toISOString(), expiredGrantCount: expired.count, cancelledJobCount: jobs.count });
        return { outcome: "CANCELLED" as const, expiredGrantCount: expired.count, cancelledJobCount: jobs.count };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
  });
}

export function createPrismaSubscriptionProviderSynchronizationRepository(database: any = db): SubscriptionProviderSynchronizationRepository {
  return Object.freeze({
    async prepareSynchronization(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionPaymentAuthority" WHERE "publicReference" = ${input.authorityReference} FOR UPDATE`);
        const authority = await tx.subscriptionPaymentAuthority.findUnique({ where: { publicReference: input.authorityReference }, include: { contract: true } });
        if (!authority?.contract) return { outcome: "RECONCILIATION_REQUIRED" as const };
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "id" = ${authority.contract.id} FOR UPDATE`);
        const resolved = providerAuthority(authority, authority.contract);
        return resolved ? { outcome: "READY" as const, providerAuthority: resolved, internalStatus: authority.status } : { outcome: "RECONCILIATION_REQUIRED" as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async persistSynchronization(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionPaymentAuthority" WHERE "publicReference" = ${input.authorityReference} FOR UPDATE`);
        const authority = await tx.subscriptionPaymentAuthority.findUnique({ where: { publicReference: input.authorityReference }, include: { contract: true } });
        if (!authority?.contract) return { outcome: "RECONCILIATION_REQUIRED" as const };
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionContract" WHERE "id" = ${authority.contract.id} FOR UPDATE`);
        const match = (authority.status === input.observedStatus) || (authority.status === "PENDING" && input.observedStatus === "PENDING");
        await tx.subscriptionProviderSynchronizationEvidence.upsert({ where: { operationId: input.operationId }, create: { publicReference: reference("subsync", input.operationId), contractId: authority.contract.id, providerAuthorityId: authority.id, operationId: input.operationId, observedStatus: input.observedStatus, internalStatus: authority.status, safeEvidence: input.safeEvidence }, update: {} });
        await receipt(tx, authority.contract.id, input.operationId, "PROVIDER_SYNCHRONIZATION", match ? "SYNCHRONIZED" : "RECONCILIATION_REQUIRED", input.safeEvidence);
        await tx.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { lastSynchronizedAt: new Date(), version: { increment: 1 } } });
        if (!match) {
          await cancellationCase(tx, authority.contract, authority, input.operationId, "PROVIDER_STATUS_MISMATCH");
          return { outcome: "RECONCILIATION_REQUIRED" as const };
        }
        return { outcome: "SYNCHRONIZED" as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
    async openSynchronizationReconciliation(input) {
      await database.subscriptionReconciliationCase.upsert({ where: { caseKey: `subscription-provider-sync:${input.authorityReference}:${input.reason}` }, create: { publicReference: reference("subrec", `${input.authorityReference}_${input.reason}`), caseKey: `subscription-provider-sync:${input.authorityReference}:${input.reason}`, reason: "PROVIDER_STATUS_MISMATCH", priority: "HIGH", safeSummary: "Provider authority synchronization requires reconciliation.", safeEvidence: { operationId: input.operationId, reason: input.reason } }, update: { lastObservedAt: new Date() } });
    },
  });
}

export function createPrismaSubscriptionEntitlementRefundRepository(database: any = db): SubscriptionEntitlementRefundRepository {
  return Object.freeze({
    async adjustRefundedCycle(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionInvoice" WHERE "id" = ${input.invoiceId} FOR UPDATE`);
        const invoice = await tx.subscriptionInvoice.findUnique({ where: { id: input.invoiceId }, include: { billingCycle: true } });
        if (!invoice) return { outcome: "RECONCILIATION_REQUIRED" as const, revokedGrantCount: 0, releasedReservationCount: 0, consumedGrantCount: 0 };
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionBillingCycle" WHERE "id" = ${invoice.billingCycleId} FOR UPDATE`);
        const refundAdjustment = await tx.subscriptionRefundAdjustment.findFirst({ where: { invoiceId: input.invoiceId, refund: { publicReference: input.refundReference } }, select: { id: true } });
        if (!refundAdjustment) return { outcome: "RECONCILIATION_REQUIRED" as const, revokedGrantCount: 0, releasedReservationCount: 0, consumedGrantCount: 0 };
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionRefundAdjustment" WHERE "id" = ${refundAdjustment.id} FOR UPDATE`);
        const grants = await tx.subscriptionEntitlementGrant.findMany({ where: { billingCycleId: invoice.billingCycleId }, include: { usages: true } });
        let revokedGrantCount = 0; let releasedReservationCount = 0; let consumedGrantCount = 0;
        for (const grant of grants) {
          const consumed = grant.usages.some((usage: any) => usage.action === "CONSUME");
          const activeReservations = grant.usages.filter((usage: any) => usage.action === "RESERVE");
          if (consumed) {
            await tx.subscriptionEntitlementRefundAdjustment.upsert({ where: { refundAdjustmentId_grantId_operationId: { refundAdjustmentId: refundAdjustment.id, grantId: grant.id, operationId: input.operationId } }, create: { publicReference: reference("subentref", `${input.operationId}_${grant.id}`), refundAdjustmentId: refundAdjustment.id, grantId: grant.id, operationId: input.operationId, action: "RECONCILE_CONSUMED", safeEvidence: { refundReference: input.refundReference } }, update: {} });
            consumedGrantCount += 1; continue;
          }
          for (const usage of activeReservations) {
            await tx.subscriptionEntitlementUsage.upsert({ where: { grantId_operationId_action: { grantId: grant.id, operationId: `${input.operationId}:release:${usage.id}`, action: "RELEASE" } }, create: { publicReference: reference("subuse", `${input.operationId}_${usage.id}`), grantId: grant.id, operationId: `${input.operationId}:release:${usage.id}`, requestHash: `refund:${input.refundReference}`, action: "RELEASE", amount: usage.amount, quantity: usage.quantity, sourceType: "REFUND", sourceReference: input.refundReference }, update: {} });
            releasedReservationCount += 1;
          }
          await tx.subscriptionEntitlementUsage.upsert({ where: { grantId_operationId_action: { grantId: grant.id, operationId: `${input.operationId}:revoke`, action: "REVOKE" } }, create: { publicReference: reference("subuse", `${input.operationId}_${grant.id}`), grantId: grant.id, operationId: `${input.operationId}:revoke`, requestHash: `refund:${input.refundReference}`, action: "REVOKE", amount: null, quantity: null, sourceType: "REFUND", sourceReference: input.refundReference }, update: {} });
          await tx.subscriptionEntitlementGrant.update({ where: { id: grant.id }, data: { status: "REVOKED", remainingAmount: "0.00", remainingQuantity: 0, revokedAt: new Date() } });
          await tx.subscriptionEntitlementRefundAdjustment.upsert({ where: { refundAdjustmentId_grantId_operationId: { refundAdjustmentId: refundAdjustment.id, grantId: grant.id, operationId: input.operationId } }, create: { publicReference: reference("subentref", `${input.operationId}_${grant.id}`), refundAdjustmentId: refundAdjustment.id, grantId: grant.id, operationId: input.operationId, action: "REVOKE_UNUSED", safeEvidence: { refundReference: input.refundReference, releasedReservationCount } }, update: {} });
          revokedGrantCount += 1;
        }
        if (consumedGrantCount > 0) {
          await tx.subscriptionReconciliationCase.upsert({ where: { caseKey: `subscription-refund-entitlement:${input.invoiceId}:${input.refundReference}` }, create: { publicReference: reference("subrec", `${input.invoiceId}_${input.refundReference}`), caseKey: `subscription-refund-entitlement:${input.invoiceId}:${input.refundReference}`, invoiceId: input.invoiceId, reason: "REFUND_ENTITLEMENT_MISMATCH", priority: "HIGH", safeSummary: "Consumed subscription benefits prevent automatic refund entitlement reversal.", safeEvidence: { refundReference: input.refundReference } }, update: { lastObservedAt: new Date() } });
          return { outcome: "RECONCILIATION_REQUIRED" as const, revokedGrantCount, releasedReservationCount, consumedGrantCount };
        }
        return { outcome: "ADJUSTED" as const, revokedGrantCount, releasedReservationCount, consumedGrantCount };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
  });
}
