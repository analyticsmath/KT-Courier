import { db } from "@/lib/db";
import { evaluateRetentionHolds } from "./hold-evaluator";
import { RETENTION_POLICY_REGISTRY, type RetentionPolicyDefinition } from "./policy-registry";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { safeOperationalText } from "@/lib/operations/phase5-repository";

export interface RetentionRunOptions {
  mode: "DRY_RUN" | "APPLY";
  batchSize?: number;
  categories?: string[];
  actorUserId?: string;
}

export interface PolicyRunResult {
  category: string;
  actionType: string;
  itemsExamined: number;
  itemsEligible: number;
  itemsHeld: number;
  itemsProcessed: number;
  itemsFailed: number;
  safeOutcome: string;
}

export interface RetentionProcessorSummary {
  mode: "DRY_RUN" | "APPLY";
  executedAt: string;
  itemsExamined: number;
  itemsClaimed: number;
  itemsCompleted: number;
  itemsSkipped: number;
  itemsReconciled: number;
  policyResults: PolicyRunResult[];
  safeSummary: string;
}

function withTimeout<T>(promise: Promise<T>, ms = 200, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]).catch(() => fallback);
}

export async function runRetentionProcessor(options: RetentionRunOptions): Promise<RetentionProcessorSummary> {
  const mode = options.mode;
  const targetCategories = options.categories ?? Object.keys(RETENTION_POLICY_REGISTRY);
  const policyResults: PolicyRunResult[] = [];

  let totalExamined = 0;
  let totalClaimed = 0;
  let totalCompleted = 0;
  let totalSkipped = 0;
  let totalReconciled = 0;

  for (const catKey of targetCategories) {
    const policy = RETENTION_POLICY_REGISTRY[catKey];
    if (!policy) continue;

    const result = await processSinglePolicy(policy, mode, options.batchSize ?? policy.defaultBatchSize);
    policyResults.push(result);

    totalExamined += result.itemsExamined;
    if (mode === "APPLY") {
      totalClaimed += result.itemsEligible - result.itemsHeld;
      totalCompleted += result.itemsProcessed;
      totalSkipped += result.itemsHeld + (result.itemsEligible - result.itemsProcessed - result.itemsHeld);
      totalReconciled += result.itemsFailed;
    } else {
      totalSkipped += result.itemsEligible;
    }
  }

  const safeSummary = safeOperationalText(
    `Retention ${mode}: ${totalExamined} records examined, ${totalCompleted} processed, ${totalSkipped} skipped due to holds/dry-run across ${policyResults.length} policies.`,
  );

  if (options.actorUserId && mode === "APPLY") {
    await recordAdminActivity({
      actorUserId: options.actorUserId,
      action: "STATUS_CHANGE",
      entityType: "RetentionProcessor",
      entityId: "DATA_RETENTION",
      message: `Executed data retention processor in ${mode} mode`,
      metadata: {
        mode,
        totalCompleted,
        totalExamined,
        policiesCount: policyResults.length,
      },
    }).catch(() => null);
  }

  return {
    mode,
    executedAt: new Date().toISOString(),
    itemsExamined: totalExamined,
    itemsClaimed: totalClaimed,
    itemsCompleted: totalCompleted,
    itemsSkipped: totalSkipped,
    itemsReconciled: totalReconciled,
    policyResults,
    safeSummary,
  };
}

async function processSinglePolicy(policy: RetentionPolicyDefinition, mode: "DRY_RUN" | "APPLY", limit: number): Promise<PolicyRunResult> {
  const cutoffDate = new Date(Date.now() - policy.minimumRetentionDays * 24 * 60 * 60 * 1000);

  let itemsExamined = 0;
  let itemsEligible = 0;
  let itemsHeld = 0;
  let itemsProcessed = 0;
  let itemsFailed = 0;

  try {
    switch (policy.category) {
      case "EXPIRED_SESSIONS": {
        const expiredSessions = await withTimeout(
          db.session.findMany({
            where: { expiresAt: { lt: cutoffDate } },
            select: { id: true, userId: true },
            take: Math.min(limit, 500),
          }),
          200,
          [],
        );

        itemsExamined = expiredSessions.length;
        for (const session of expiredSessions) {
          const hold = policy.holdApplicable
            ? await evaluateRetentionHolds({ subjectType: "User", subjectReference: session.userId })
            : { hasHold: false };

          if (hold.hasHold) {
            itemsHeld++;
          } else {
            itemsEligible++;
            if (mode === "APPLY") {
              await withTimeout(db.session.delete({ where: { id: session.id } }), 200, null)
                .then((res) => (res ? itemsProcessed++ : itemsFailed++));
            }
          }
        }
        break;
      }

      case "EXPIRED_EMAIL_OTPS": {
        const expiredOtps = await withTimeout(
          db.otpCode.findMany({
            where: { expiresAt: { lt: cutoffDate } },
            select: { id: true },
            take: Math.min(limit, 500),
          }),
          200,
          [],
        );

        itemsExamined = expiredOtps.length;
        itemsEligible = expiredOtps.length;
        if (mode === "APPLY" && expiredOtps.length > 0) {
          const res = await withTimeout(
            db.otpCode.deleteMany({
              where: { id: { in: expiredOtps.map((o) => o.id) } },
            }),
            200,
            { count: 0 },
          );
          itemsProcessed = res.count;
        }
        break;
      }

      case "EXPIRED_PASSWORD_RESET_TOKENS": {
        const expiredTokens = await withTimeout(
          db.passwordResetToken.findMany({
            where: { expiresAt: { lt: cutoffDate } },
            select: { id: true },
            take: Math.min(limit, 200),
          }),
          200,
          [],
        );

        itemsExamined = expiredTokens.length;
        itemsEligible = expiredTokens.length;
        if (mode === "APPLY" && expiredTokens.length > 0) {
          const res = await withTimeout(
            db.passwordResetToken.deleteMany({
              where: { id: { in: expiredTokens.map((t) => t.id) } },
            }),
            200,
            { count: 0 },
          );
          itemsProcessed = res.count;
        }
        break;
      }

      case "EXPIRED_DELIVERY_OTPS": {
        const expiredDeliveryOtps = await withTimeout(
          db.deliveryOtp.findMany({
            where: { expiresAt: { lt: cutoffDate } },
            select: { id: true, orderId: true },
            take: Math.min(limit, 200),
          }),
          200,
          [],
        );

        itemsExamined = expiredDeliveryOtps.length;
        for (const otp of expiredDeliveryOtps) {
          const hold = await evaluateRetentionHolds({ subjectType: "Order", subjectReference: otp.orderId });
          if (hold.hasHold) {
            itemsHeld++;
          } else {
            itemsEligible++;
            if (mode === "APPLY") {
              await withTimeout(db.deliveryOtp.delete({ where: { id: otp.id } }), 200, null)
                .then((res) => (res ? itemsProcessed++ : itemsFailed++));
            }
          }
        }
        break;
      }

      case "PRECISE_DRIVER_LOCATIONS": {
        const oldLocations = await withTimeout<Array<{ id: string; driverProfileId: string; orderId?: string | null }>>(
          db.driverLocationEvidence.findMany({
            where: { createdAt: { lt: cutoffDate } },
            select: { id: true, driverProfileId: true, orderId: true },
            take: Math.min(limit, 500),
          }),
          200,
          [],
        );

        itemsExamined = oldLocations.length;
        for (const loc of oldLocations) {
          const orderHold = loc.orderId ? await evaluateRetentionHolds({ subjectType: "Order", subjectReference: loc.orderId }) : { hasHold: false };
          const driverHold = await evaluateRetentionHolds({ subjectType: "Driver", subjectReference: loc.driverProfileId });

          if (orderHold.hasHold || driverHold.hasHold) {
            itemsHeld++;
          } else {
            itemsEligible++;
            if (mode === "APPLY") {
              await withTimeout(db.driverLocationEvidence.delete({ where: { id: loc.id } }), 200, null)
                .then((res) => (res ? itemsProcessed++ : itemsFailed++));
            }
          }
        }
        break;
      }

      default: {
        itemsExamined = 0;
        itemsEligible = 0;
        break;
      }
    }
  } catch {
    itemsFailed++;
  }

  return {
    category: policy.category,
    actionType: policy.actionType,
    itemsExamined,
    itemsEligible,
    itemsHeld,
    itemsProcessed: mode === "APPLY" ? itemsProcessed : 0,
    itemsFailed,
    safeOutcome: safeOperationalText(
      `${mode} for ${policy.category}: ${itemsExamined} examined, ${itemsEligible} eligible, ${itemsHeld} held, ${itemsProcessed} processed.`,
    ),
  };
}
