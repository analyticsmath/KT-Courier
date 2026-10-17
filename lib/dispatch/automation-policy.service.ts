import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  decideDispatchAutomation,
  type DispatchAutomationDecision,
} from "@/lib/dispatch/automation-policy";

export class DispatchPolicyError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "DispatchPolicyError";
  }
}

const assertPolicy = (condition: unknown, code: string, message: string): void => {
  if (!condition) throw new DispatchPolicyError(code, message);
};

type Client = Pick<typeof prisma, "systemSetting" | "dispatchAutomationPolicy">;

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
  const regions = await prisma.deliveryRegion.count({ where: { id: { in: unique }, active: true } });
  assertPolicy(regions === unique.length, "DISPATCH_POLICY_INVALID", "Every region must be an existing active delivery region.");
  return prisma.dispatchAutomationPolicy.create({
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
}

async function transition(
  publicReference: string,
  from: readonly string[],
  data: Prisma.DispatchAutomationPolicyUpdateManyMutationInput,
  guard?: (policy: { createdByUserId: string }) => void,
) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.dispatchAutomationPolicy.findUnique({ where: { publicReference } });
    assertPolicy(policy && from.includes(policy.status), "DISPATCH_POLICY_INVALID_STATE", `Policy must be ${from.join(" or ")} for this action.`);
    guard?.(policy!);
    const changed = await tx.dispatchAutomationPolicy.updateMany({ where: { id: policy!.id, status: policy!.status }, data });
    assertPolicy(changed.count === 1, "DISPATCH_POLICY_INVALID_STATE", "Policy changed concurrently.");
    return tx.dispatchAutomationPolicy.findUniqueOrThrow({ where: { id: policy!.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export const submitDispatchAutomationPolicy = (publicReference: string) =>
  transition(publicReference, ["DRAFT"], { status: "UNDER_REVIEW" });

/** The approver must differ from the author; the database enforces this as well. */
export const approveDispatchAutomationPolicy = (input: Readonly<{ publicReference: string; approvedByUserId: string }>) =>
  transition(
    input.publicReference,
    ["UNDER_REVIEW"],
    { status: "APPROVED", approvedByUserId: input.approvedByUserId, approvedAt: new Date() },
    (policy) => assertPolicy(policy.createdByUserId !== input.approvedByUserId, "DISPATCH_POLICY_SELF_APPROVAL", "A policy cannot be approved by its author."),
  );

export const rejectDispatchAutomationPolicy = (input: Readonly<{ publicReference: string; reasonCode: string }>) => {
  assertPolicy(/^[A-Z][A-Z0-9_]{2,79}$/.test(input.reasonCode), "DISPATCH_POLICY_INVALID", "A structured rejection reason is required.");
  return transition(input.publicReference, ["UNDER_REVIEW"], { status: "REJECTED", rejectionReasonCode: input.reasonCode });
};

/** Activating retires any other active version so at most one policy is ever in force. */
export async function activateDispatchAutomationPolicy(input: Readonly<{ publicReference: string; activatedByUserId: string }>) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.dispatchAutomationPolicy.findUnique({ where: { publicReference: input.publicReference } });
    assertPolicy(candidate?.status === "APPROVED" && candidate.approvedByUserId && candidate.approvedAt, "DISPATCH_POLICY_INVALID_STATE", "Only an approved policy may be activated.");
    await tx.dispatchAutomationPolicy.updateMany({ where: { status: "ACTIVE" }, data: { status: "RETIRED", retiredAt: new Date() } });
    return tx.dispatchAutomationPolicy.update({
      where: { id: candidate!.id },
      data: { status: "ACTIVE", activatedByUserId: input.activatedByUserId, activatedAt: new Date() },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export const retireDispatchAutomationPolicy = (publicReference: string) =>
  transition(publicReference, ["ACTIVE", "APPROVED"], { status: "RETIRED", retiredAt: new Date() });

export function listDispatchAutomationPolicies() {
  return prisma.dispatchAutomationPolicy.findMany({ orderBy: { versionNumber: "desc" }, take: 25 });
}
