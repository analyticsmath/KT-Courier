/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 21 delegates remain dynamic until Phase 26.5 Prisma generation. */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { StoreOrderError, assertStoreOrder } from "@/lib/store-orders/errors";
import { operationalPolicyBounds } from "@/lib/store-orders/store-order.service";
import { assertStoreOrderProductionReady } from "@/lib/store-orders/production-lock";

type Delegate = { findUnique: (args: unknown) => Promise<any>; findFirst: (args: unknown) => Promise<any>; update: (args: unknown) => Promise<any>; updateMany: (args: unknown) => Promise<{ count: number }>; create: (args: unknown) => Promise<any> };
type Db = Record<string, Delegate>;
const db = prisma as unknown as Db;
const reference = () => `sopolicy_${randomUUID().replaceAll("-", "")}`;
const delegate = (tx: Db) => { const value = tx.storeOrderOperationalPolicy; if (!value) throw new StoreOrderError("STORE_ORDER_SCHEMA_UNAVAILABLE", "Operational-policy schema is unavailable."); return value; };

export type OperationalPolicyInput = Readonly<{
  name: string;
  versionNumber: number;
  acceptanceWindowSeconds: number;
  customerDecisionWindowSeconds: number;
  maximumPrepMinutes: number;
  maximumPrepExtensionMinutes: number;
  maximumIssueCount: number;
  maximumSubstitutionProposalsPerLine: number;
  substitutionMode: "REFUND_ONLY" | "CUSTOMER_APPROVAL_REQUIRED" | "PREAPPROVED_CHOICES_ONLY";
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
}>;

export async function createStoreOrderOperationalPolicy(input: OperationalPolicyInput) {
  operationalPolicyBounds(input);
  assertStoreOrder(input.name.trim().length >= 3 && input.name.trim().length <= 120 && Number.isInteger(input.versionNumber) && input.versionNumber > 0, "STORE_ORDER_POLICY_INVALID", "Policy name and version are invalid.");
  assertStoreOrder(!input.effectiveUntil || input.effectiveUntil > input.effectiveFrom, "STORE_ORDER_POLICY_INVALID", "Policy effective interval is invalid.");
  return delegate(db).create({ data: { publicReference: reference(), name: input.name.trim(), versionNumber: input.versionNumber, status: "DRAFT", acceptanceWindowSeconds: input.acceptanceWindowSeconds, customerDecisionWindowSeconds: input.customerDecisionWindowSeconds, maximumPrepMinutes: input.maximumPrepMinutes, maximumPrepExtensionMinutes: input.maximumPrepExtensionMinutes, maximumIssueCount: input.maximumIssueCount, maximumSubstitutionProposalsPerLine: input.maximumSubstitutionProposalsPerLine, substitutionMode: input.substitutionMode, timeoutOutcome: "REJECT_AND_REFUND", handoffVerificationMode: "TWO_PARTY_CHALLENGE", effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil ?? null } });
}

export async function submitStoreOrderOperationalPolicy(publicReference: string) {
  const policy = await delegate(db).findUnique({ where: { publicReference } });
  assertStoreOrder(policy?.status === "DRAFT", "STORE_ORDER_POLICY_INVALID_STATE", "Only a draft policy may be submitted.");
  return delegate(db).update({ where: { id: policy.id }, data: { status: "UNDER_REVIEW" } });
}

export async function approveStoreOrderOperationalPolicy(input: Readonly<{ publicReference: string; approvedByUserId: string }>) {
  const policy = await delegate(db).findUnique({ where: { publicReference: input.publicReference } });
  assertStoreOrder(policy?.status === "UNDER_REVIEW", "STORE_ORDER_POLICY_INVALID_STATE", "Only a policy under review may be approved.");
  return delegate(db).update({ where: { id: policy.id }, data: { status: "APPROVED", approvedByUserId: input.approvedByUserId } });
}

/** Rejection is terminal for this immutable policy version; a new draft is required. */
export async function rejectStoreOrderOperationalPolicy(input: Readonly<{ publicReference: string; rejectedByUserId: string; reasonCode: string; operationId: string }>) {
  assertStoreOrder(/^[A-Z][A-Z0-9_]{2,79}$/.test(input.reasonCode) && /^[A-Za-z0-9_-]{12,160}$/.test(input.operationId), "STORE_ORDER_POLICY_INVALID", "A structured rejection reason and operation ID are required.");
  return prisma.$transaction(async (rawTx) => {
    const tx = rawTx as unknown as Db; const policies = delegate(tx);
    const policy = await policies.findUnique({ where: { publicReference: input.publicReference } });
    assertStoreOrder(policy?.status === "UNDER_REVIEW", "STORE_ORDER_POLICY_INVALID_STATE", "Only a policy under review may be rejected.");
    const rejected = await policies.update({ where: { id: policy.id }, data: { status: "REJECTED", rejectedByUserId: input.rejectedByUserId, rejectedAt: new Date(), rejectionReasonCode: input.reasonCode } });
    const history = tx.storeOrderOperationalPolicyHistory;
    if (!history) throw new StoreOrderError("STORE_ORDER_SCHEMA_UNAVAILABLE", "Operational-policy history schema is unavailable.");
    await history.create({ data: { operationalPolicyId: policy.id, operationId: input.operationId, eventType: "POLICY_REJECTED", actorUserId: input.rejectedByUserId, reasonCode: input.reasonCode, safeEvidence: { priorStatus: "UNDER_REVIEW", nextStatus: "REJECTED" } } });
    return rejected;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Activation is source-locked. Active policy versions are never updated. */
export async function activateStoreOrderOperationalPolicy(input: Readonly<{ publicReference: string; testApproval?: { approved: true } }>) {
  assertStoreOrderProductionReady("POLICY_ACTIVATION", input.testApproval);
  return prisma.$transaction(async (rawTx) => {
    const tx = rawTx as unknown as Db; const policies = delegate(tx);
    const candidate = await policies.findUnique({ where: { publicReference: input.publicReference } });
    assertStoreOrder(candidate?.status === "APPROVED", "STORE_ORDER_POLICY_INVALID_STATE", "Only an approved policy may be activated.");
    const active = await policies.findFirst({ where: { status: "ACTIVE" } });
    if (active) await policies.update({ where: { id: active.id }, data: { status: "RETIRED", retiredAt: new Date() } });
    return policies.update({ where: { id: candidate.id }, data: { status: "ACTIVE", activatedAt: new Date() } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
