import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  decideDispatchAutomation,
  type DispatchAutomationDecision,
} from "@/lib/dispatch/automation-policy";
import { AdminActionType, UserRole, UserStatus } from "@/types/db";

export class DispatchPolicyError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "DispatchPolicyError";
  }
}

export const assertPolicy = (condition: unknown, code: string, message: string): void => {
  if (!condition) throw new DispatchPolicyError(code, message);
};

type Client = Pick<typeof prisma, "systemSetting" | "dispatchAutomationPolicy">;

/**
 * Validates that actorUserId belongs to an active administrator.
 */
export async function assertActiveAdminActor(
  client: { user: { findFirst(args: unknown): Promise<{ id: string; role: UserRole; status: UserStatus } | null> } },
  actorUserId: string
): Promise<string> {
  assertPolicy(
    typeof actorUserId === "string" && actorUserId.trim().length > 0,
    "DISPATCH_POLICY_INVALID_ACTOR",
    "Actor user ID is required."
  );
  const user = await client.user.findFirst({
    where: {
      id: actorUserId,
      role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      status: UserStatus.ACTIVE,
    },
    select: { id: true, role: true, status: true },
  });
  assertPolicy(user, "DISPATCH_POLICY_UNAUTHORIZED_ACTOR", "Actor must be an active administrator.");
  return actorUserId;
}

/**
 * Reads the operator hold and the single ACTIVE policy. Any read problem, missing row,
 * or malformed value yields a blocked decision; this function never throws to a caller
 * that would then treat the failure as permission.
 */
export async function resolveDispatchAutomationAuthority(client: Client = prisma, now: Date = new Date()): Promise<DispatchAutomationDecision> {
  try {
    const [setting, policy] = await Promise.all([
      client.systemSetting.findUnique({ where: { key: "dispatch.auto_dispatch_enabled" }, select: { value: true } }),
      client.dispatchAutomationPolicy.findFirst({ where: { status: "ACTIVE" }, orderBy: { versionNumber: "desc" } }),
    ]);
    return decideDispatchAutomation({ settingValue: setting?.value, policyRow: policy, now });
  } catch {
    return { allowed: false, reason: "NO_APPROVED_POLICY" };
  }
}

export type DispatchAutomationPolicyInput = Readonly<{
  versionNumber: number;
  regionIds: readonly string[];
  maxOfferAttempts: number;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
  createdByUserId: string;
}>;

const reference = () => `dspauto_${randomUUID().replaceAll("-", "")}`;

export async function createDispatchAutomationPolicyDraft(input: DispatchAutomationPolicyInput) {
  assertPolicy(Number.isInteger(input.versionNumber) && input.versionNumber > 0, "DISPATCH_POLICY_INVALID", "Policy version is invalid.");
  assertPolicy(input.regionIds.length > 0 && input.regionIds.every((id) => id.trim().length > 0), "DISPATCH_POLICY_INVALID", "At least one approved delivery region is required.");
  assertPolicy(Number.isInteger(input.maxOfferAttempts) && input.maxOfferAttempts >= 1 && input.maxOfferAttempts <= 10, "DISPATCH_POLICY_INVALID", "Offer attempt limit must be between 1 and 10.");
  assertPolicy(!input.effectiveUntil || input.effectiveUntil > input.effectiveFrom, "DISPATCH_POLICY_INVALID", "Policy effective interval is invalid.");
  const unique = [...new Set(input.regionIds)];

  return prisma.$transaction(async (tx) => {
    await assertActiveAdminActor(tx, input.createdByUserId);
    const regions = await tx.deliveryRegion.count({ where: { id: { in: unique }, active: true } });
    assertPolicy(regions === unique.length, "DISPATCH_POLICY_INVALID", "Every region must be an existing active delivery region.");

    const policy = await tx.dispatchAutomationPolicy.create({
      data: {
        publicReference: reference(),
        versionNumber: input.versionNumber,
        status: "DRAFT",
        regionIds: unique,
        maxOfferAttempts: input.maxOfferAttempts,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil ?? null,
        createdByUserId: input.createdByUserId,
      },
    });

    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.createdByUserId,
        action: AdminActionType.CREATE,
        entityType: "DispatchAutomationPolicy",
        entityId: policy.id,
        message: `Created draft dispatch automation policy version ${policy.versionNumber} (${policy.publicReference}).`,
        metadata: {
          publicReference: policy.publicReference,
          versionNumber: policy.versionNumber,
          regionIds: unique,
          maxOfferAttempts: input.maxOfferAttempts,
        },
      },
    });

    return policy;
  });
}

async function transition(
  publicReference: string,
  actorUserId: string,
  from: readonly string[],
  toStatus: string,
  data: Prisma.DispatchAutomationPolicyUpdateManyMutationInput,
  message: (policy: { id: string; versionNumber: number; publicReference: string }) => string,
  guard?: (policy: { createdByUserId: string; publicReference: string; id: string; versionNumber: number }) => void,
) {
  return prisma.$transaction(async (tx) => {
    await assertActiveAdminActor(tx, actorUserId);
    const policy = await tx.dispatchAutomationPolicy.findUnique({ where: { publicReference } });
    assertPolicy(policy && from.includes(policy.status), "DISPATCH_POLICY_INVALID_STATE", `Policy must be ${from.join(" or ")} for this action.`);
    guard?.(policy!);
    const changed = await tx.dispatchAutomationPolicy.updateMany({ where: { id: policy!.id, status: policy!.status }, data });
    assertPolicy(changed.count === 1, "DISPATCH_POLICY_INVALID_STATE", "Policy changed concurrently.");

    await tx.adminActivityLog.create({
      data: {
        actorUserId,
        action: AdminActionType.STATUS_CHANGE,
        entityType: "DispatchAutomationPolicy",
        entityId: policy!.id,
        message: message(policy!),
        metadata: {
          publicReference,
          previousStatus: policy!.status,
          newStatus: toStatus,
        },
      },
    });

    return tx.dispatchAutomationPolicy.findUniqueOrThrow({ where: { id: policy!.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitDispatchAutomationPolicy(
  target: string | { publicReference: string; submittedByUserId: string },
  actorUserId?: string
) {
  const publicReference = typeof target === "string" ? target : target.publicReference;
  const actor = typeof target === "string" ? actorUserId! : target.submittedByUserId;
  return transition(
    publicReference,
    actor,
    ["DRAFT"],
    "UNDER_REVIEW",
    { status: "UNDER_REVIEW" },
    (p) => `Submitted dispatch automation policy version ${p.versionNumber} (${p.publicReference}) for review.`
  );
}

/** The approver must differ from the author; the database enforces this as well. */
export async function approveDispatchAutomationPolicy(input: Readonly<{ publicReference: string; approvedByUserId: string }>) {
  return transition(
    input.publicReference,
    input.approvedByUserId,
    ["UNDER_REVIEW"],
    "APPROVED",
    { status: "APPROVED", approvedByUserId: input.approvedByUserId, approvedAt: new Date() },
    (p) => `Approved dispatch automation policy version ${p.versionNumber} (${p.publicReference}).`,
    (policy) => assertPolicy(policy.createdByUserId !== input.approvedByUserId, "DISPATCH_POLICY_SELF_APPROVAL", "A policy cannot be approved by its author.")
  );
}

export async function rejectDispatchAutomationPolicy(input: Readonly<{ publicReference: string; rejectedByUserId: string; reasonCode: string }>) {
  assertPolicy(/^[A-Z][A-Z0-9_]{2,79}$/.test(input.reasonCode), "DISPATCH_POLICY_INVALID", "A structured rejection reason is required.");
  return transition(
    input.publicReference,
    input.rejectedByUserId,
    ["UNDER_REVIEW"],
    "REJECTED",
    { status: "REJECTED", rejectionReasonCode: input.reasonCode },
    (p) => `Rejected dispatch automation policy version ${p.versionNumber} (${p.publicReference}): ${input.reasonCode}.`
  );
}

/** Activating retires any other active version so at most one policy is ever in force. */
export async function activateDispatchAutomationPolicy(input: Readonly<{ publicReference: string; activatedByUserId: string }>) {
  return prisma.$transaction(async (tx) => {
    await assertActiveAdminActor(tx, input.activatedByUserId);
    const candidate = await tx.dispatchAutomationPolicy.findUnique({ where: { publicReference: input.publicReference } });
    assertPolicy(candidate?.status === "APPROVED" && candidate.approvedByUserId && candidate.approvedAt, "DISPATCH_POLICY_INVALID_STATE", "Only an approved policy may be activated.");

    const currentlyActive = await tx.dispatchAutomationPolicy.findMany({ where: { status: "ACTIVE" } });
    if (currentlyActive.length > 0) {
      await tx.dispatchAutomationPolicy.updateMany({ where: { status: "ACTIVE" }, data: { status: "RETIRED", retiredAt: new Date() } });
      for (const retired of currentlyActive) {
        await tx.adminActivityLog.create({
          data: {
            actorUserId: input.activatedByUserId,
            action: AdminActionType.STATUS_CHANGE,
            entityType: "DispatchAutomationPolicy",
            entityId: retired.id,
            message: `Retired previous dispatch automation policy version ${retired.versionNumber} (${retired.publicReference}) upon activation of version ${candidate!.versionNumber}.`,
            metadata: {
              publicReference: retired.publicReference,
              previousStatus: "ACTIVE",
              newStatus: "RETIRED",
              supersededBy: candidate!.publicReference,
            },
          },
        });
      }
    }

    const activated = await tx.dispatchAutomationPolicy.update({
      where: { id: candidate!.id },
      data: { status: "ACTIVE", activatedByUserId: input.activatedByUserId, activatedAt: new Date() },
    });

    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.activatedByUserId,
        action: AdminActionType.STATUS_CHANGE,
        entityType: "DispatchAutomationPolicy",
        entityId: activated.id,
        message: `Activated dispatch automation policy version ${activated.versionNumber} (${activated.publicReference}).`,
        metadata: {
          publicReference: activated.publicReference,
          previousStatus: "APPROVED",
          newStatus: "ACTIVE",
        },
      },
    });

    return activated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function retireDispatchAutomationPolicy(
  target: string | { publicReference: string; retiredByUserId: string },
  actorUserId?: string
) {
  const publicReference = typeof target === "string" ? target : target.publicReference;
  const actor = typeof target === "string" ? actorUserId! : target.retiredByUserId;
  return transition(
    publicReference,
    actor,
    ["ACTIVE", "APPROVED"],
    "RETIRED",
    { status: "RETIRED", retiredAt: new Date() },
    (p) => `Retired dispatch automation policy version ${p.versionNumber} (${p.publicReference}).`
  );
}

export function listDispatchAutomationPolicies() {
  return prisma.dispatchAutomationPolicy.findMany({ orderBy: { versionNumber: "desc" }, take: 25 });
}

