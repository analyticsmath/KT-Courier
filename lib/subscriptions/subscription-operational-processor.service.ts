/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is deferred to Phase 26.5. */
import { prisma } from "@/lib/db/prisma";
import type { SubscriptionDunningRepository } from "@/lib/subscriptions/subscription-dunning.service";

const db = prisma as any;

export type SubscriptionExpiryRepository = Readonly<{ expire(input: Readonly<{ grantReference: string; operationId: string; at: Date }>): Promise<Readonly<{ outcome: "EXPIRED" | "REPLAY" | "NOT_DUE" }>> }>;
export async function expireSubscriptionEntitlements(repository: SubscriptionExpiryRepository, input: Readonly<{ grantReference: string; operationId: string; at?: Date }>) { return repository.expire({ ...input, at: input.at ?? new Date() }); }

export function createPrismaSubscriptionExpiryRepository(database: any = db): SubscriptionExpiryRepository {
  return Object.freeze({ async expire(input) {
    return database.$transaction(async (tx: any) => {
      const grant = await tx.subscriptionEntitlementGrant.findUnique({ where: { publicReference: input.grantReference } });
      if (!grant) return { outcome: "NOT_DUE" as const };
      if (["EXPIRED", "REVOKED"].includes(grant.status)) return { outcome: "REPLAY" as const };
      if (grant.effectiveUntil > input.at) return { outcome: "NOT_DUE" as const };
      await tx.subscriptionEntitlementUsage.upsert({ where: { grantId_operationId_action: { grantId: grant.id, operationId: input.operationId, action: "EXPIRE" } }, create: { publicReference: `subuse_${input.operationId.replace(/[^A-Za-z0-9_-]/g, "").slice(-36)}`, grantId: grant.id, operationId: input.operationId, requestHash: `expiry:${input.operationId}`, action: "EXPIRE", amount: null, quantity: null, sourceType: "SYSTEM", sourceReference: input.grantReference }, update: {} });
      await tx.subscriptionEntitlementGrant.update({ where: { id: grant.id }, data: { status: "EXPIRED" } });
      return { outcome: "EXPIRED" as const };
    });
  } });
}

export function createPrismaSubscriptionDunningRepository(database: any = db): SubscriptionDunningRepository {
  return Object.freeze({ async applyDunning(input) {
    const marker = "subscription-processor:process-subscription-dunning:";
    const encoded = input.operationId.startsWith(marker) ? input.operationId.slice(marker.length) : "";
    const publicReference = encoded.slice(0, encoded.lastIndexOf(":"));
    const job = publicReference ? await database.subscriptionRenewalJob.findUnique({ where: { publicReference } }) : null;
    if (!job) return { outcome: "RECONCILIATION_REQUIRED" as const, attempts: 0 };
    await database.subscriptionRenewalJob.update({ where: { id: job.id }, data: { status: "RECONCILIATION_REQUIRED", lastSafeError: "DUNNING_REQUIRES_RECONCILIATION" } });
    return { outcome: "RECONCILIATION_REQUIRED" as const, attempts: job.attemptCount };
  } });
}

export type SubscriptionReconciliationScanRepository = Readonly<{ scan(input: Readonly<{ caseReference: string; operationId: string; at: Date }>): Promise<Readonly<{ outcome: "OBSERVED" | "REPLAY" }>> }>;
export async function scanSubscriptionReconciliation(repository: SubscriptionReconciliationScanRepository, input: Readonly<{ caseReference: string; operationId: string; at?: Date }>) { return repository.scan({ ...input, at: input.at ?? new Date() }); }
export function createPrismaSubscriptionReconciliationScanRepository(database: any = db): SubscriptionReconciliationScanRepository {
  return Object.freeze({ async scan(input) {
    const current = await database.subscriptionReconciliationCase.findUnique({ where: { publicReference: input.caseReference } });
    if (!current) return { outcome: "REPLAY" as const };
    await database.subscriptionReconciliationCase.update({ where: { id: current.id }, data: { lastObservedAt: input.at } });
    return { outcome: "OBSERVED" as const };
  } });
}
