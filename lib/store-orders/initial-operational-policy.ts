import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { operationalPolicyBounds } from "@/lib/store-orders/store-order.service";

export const INITIAL_STORE_ORDER_POLICY_PROPOSAL = Object.freeze({
  name: "KT Couriers initial marketplace fulfilment",
  versionNumber: 1,
  acceptanceWindowSeconds: 900,
  customerDecisionWindowSeconds: 1800,
  maximumPrepMinutes: 180,
  maximumPrepExtensionMinutes: 60,
  maximumIssueCount: 3,
  maximumSubstitutionProposalsPerLine: 2,
  substitutionMode: "CUSTOMER_APPROVAL_REQUIRED",
} as const);

/**
 * Creates a DRAFT only; a non-binding operating proposal.
 * Never sets APPROVED/ACTIVE or assigns an imaginary reviewer identity.
 * Existing operational policies of every state are operator-owned and remain
 * unchanged. The admin page provides explicit versioned human approval.
 */
export async function prepareInitialStoreOrderOperationalPolicy(actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"kt-launch-store-order-policy-draft-v1"}))`;
    const prior = await tx.storeOrderOperationalPolicy.findFirst({ select: { id: true } });
    if (prior) return { draftPrepared: false, existingPolicyPreserved: true, activated: false };
    operationalPolicyBounds(INITIAL_STORE_ORDER_POLICY_PROPOSAL);
    const row = await tx.storeOrderOperationalPolicy.create({
      data: {
        ...INITIAL_STORE_ORDER_POLICY_PROPOSAL,
        publicReference: `sopolicy_${randomUUID().replaceAll("-", "")}`,
        status: "DRAFT",
        timeoutOutcome: "REJECT_AND_REFUND",
        handoffVerificationMode: "TWO_PARTY_CHALLENGE",
        effectiveFrom: new Date(),
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId, action: "CREATE",
        entityType: "StoreOrderOperationalPolicy", entityId: row.id,
        message: "Prepared non-binding initial marketplace fulfilment operating proposal; explicit admin review and activation required.",
        metadata: {
          source: "KT_COURIERS_OWNER_FULL_PRODUCTION_LAUNCH_2026_10_14",
          status: "DRAFT", approved: false, activated: false,
          proposal: INITIAL_STORE_ORDER_POLICY_PROPOSAL,
        } as Prisma.InputJsonObject,
      },
    });
    return { draftPrepared: true, existingPolicyPreserved: false, activated: false };
  }, { timeout: 20_000 });
}
