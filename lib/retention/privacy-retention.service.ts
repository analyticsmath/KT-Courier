/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { prisma } from "@/lib/db/prisma";
import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";
import { PrivateMediaPolicyError, PrivateMediaService } from "@/lib/private-media/private-media.service";
import { PrivateMediaStorageError } from "@/lib/private-media/private-media-storage";
import { evaluateRetentionHolds } from "./hold-evaluator";

export const RETENTION_DATA_CLASSES = ["ACCOUNT_PROFILE", "CUSTOMER_ADDRESS", "MARKETING_PREFERENCE_HISTORY", "COOKIE_PREFERENCE_HISTORY", "LEGAL_ACCEPTANCE_EVIDENCE", "LOCATION_DATA", "PRIVATE_MEDIA", "CLAIM_EVIDENCE", "POD_EVIDENCE", "PAYMENT_METADATA", "FINANCIAL_LEDGER", "SECURITY_AUDIT", "DSAR_EXPORT"] as const;
export type RetentionAction = "DELETE" | "ANONYMIZE" | "PSEUDONYMIZE" | "RETAIN" | "ARCHIVE";
export class RetentionError extends Error { constructor(readonly code: string, message = code) { super(message); this.name = "RetentionError"; } }

const SUPPORTED_POLICY_ACTIONS: Readonly<Record<string, readonly RetentionAction[]>> = {
  ACCOUNT_PROFILE: ["ANONYMIZE"],
  PRIVATE_MEDIA: ["DELETE"],
};

function isValidRetentionDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 36500;
}

function assertSupportedRetentionPolicy(dataClass: string, action: RetentionAction): void {
  if (!Object.values(RETENTION_DATA_CLASSES).includes(dataClass as (typeof RETENTION_DATA_CLASSES)[number])) {
    throw new RetentionError("RETENTION_POLICY_DATA_CLASS_INVALID");
  }
  if (!SUPPORTED_POLICY_ACTIONS[dataClass]?.includes(action)) {
    throw new RetentionError("RETENTION_POLICY_EXECUTOR_UNAVAILABLE", "This data class and action do not have a production retention executor.");
  }
}

async function lockRetentionDataClass(tx: Prisma.TransactionClient, dataClass: string): Promise<void> {
  // Serialize version allocation and activate/retire transitions per data class,
  // including the first policy when there is no existing row to lock.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`retention-policy:${dataClass}`}))`;
}

export async function listRetentionPolicyVersions() {
  return prisma.retentionPolicyVersion.findMany({
    orderBy: [{ dataClass: "asc" }, { version: "desc" }],
    take: 200,
    select: {
      id: true,
      publicReference: true,
      dataClass: true,
      version: true,
      action: true,
      retentionDays: true,
      effectiveAt: true,
      status: true,
      legalReviewStatus: true,
      legalReviewReference: true,
      legalReviewReason: true,
      legalReviewedByUserId: true,
      legalReviewedAt: true,
      createdByUserId: true,
      activatedByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createRetentionPolicyVersion(input: { dataClass: string; action: RetentionAction; retentionDays?: number; effectiveAt?: Date; actorUserId: string }) {
  assertSupportedRetentionPolicy(input.dataClass, input.action);
  if (input.retentionDays !== undefined && (!Number.isInteger(input.retentionDays) || input.retentionDays < 0 || input.retentionDays > 36500)) {
    throw new RetentionError("RETENTION_POLICY_DURATION_INVALID");
  }
  if (input.retentionDays === undefined) throw new RetentionError("RETENTION_POLICY_DURATION_REQUIRED");
  const now = new Date();
  if (input.effectiveAt && (!Number.isFinite(input.effectiveAt.valueOf()) || input.effectiveAt <= now)) {
    throw new RetentionError("RETENTION_POLICY_EFFECTIVE_DATE_INVALID", "Use an empty effective date to apply the policy when it is activated, or choose a future date.");
  }

  return prisma.$transaction(async (tx) => {
    await lockRetentionDataClass(tx, input.dataClass);
    const current = await tx.retentionPolicyVersion.aggregate({ where: { dataClass: input.dataClass }, _max: { version: true } });
    const policy = await tx.retentionPolicyVersion.create({
      data: {
        publicReference: phase5Reference("RTP"),
        dataClass: input.dataClass,
        version: (current._max.version ?? 0) + 1,
        action: input.action,
        retentionDays: input.retentionDays,
        effectiveAt: input.effectiveAt ?? null,
        createdByUserId: input.actorUserId,
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "CREATE",
        entityType: "RetentionPolicyVersion",
        entityId: policy.id,
        message: "Created a versioned retention-policy draft.",
        metadata: { publicReference: policy.publicReference, dataClass: policy.dataClass, version: policy.version, action: policy.action, retentionDays: policy.retentionDays, effectiveAt: policy.effectiveAt?.toISOString() ?? null },
      },
    });
    return policy;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reviewRetentionPolicyVersion(input: { publicReference: string; actorUserId: string; decision: "APPROVE" | "REJECT"; reason: string; sourceReference?: string; attested: boolean }) {
  const reason = safeOperationalText(input.reason, 512);
  const sourceReference = input.sourceReference ? safeOperationalText(input.sourceReference, 160) : null;
  if (reason.length < 20) throw new RetentionError("RETENTION_POLICY_REVIEW_REASON_REQUIRED");
  if (/(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[\d ()-]{7,}\d))/i.test(reason)) throw new RetentionError("RETENTION_POLICY_REVIEW_PERSONAL_DATA_FORBIDDEN");
  if (input.attested !== true) throw new RetentionError("RETENTION_POLICY_REVIEW_ATTESTATION_REQUIRED");
  if (input.decision === "APPROVE" && (!sourceReference || sourceReference.length < 3)) {
    throw new RetentionError("RETENTION_POLICY_LEGAL_SOURCE_REQUIRED");
  }
  if (sourceReference && !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{2,159}$/.test(sourceReference)) throw new RetentionError("RETENTION_POLICY_LEGAL_SOURCE_INVALID");

  return prisma.$transaction(async (tx) => {
    const initial = await tx.retentionPolicyVersion.findUnique({ where: { publicReference: input.publicReference } });
    if (!initial) throw new RetentionError("RETENTION_POLICY_NOT_FOUND");
    await lockRetentionDataClass(tx, initial.dataClass);
    const policy = await tx.retentionPolicyVersion.findUnique({ where: { id: initial.id } });
    if (!policy) throw new RetentionError("RETENTION_POLICY_NOT_FOUND");
    if (!policy.createdByUserId || policy.createdByUserId === input.actorUserId) throw new RetentionError("RETENTION_POLICY_REVIEWER_MUST_BE_INDEPENDENT");
    if (policy.status !== "DRAFT" || policy.legalReviewStatus !== "LEGAL_REVIEW_REQUIRED") {
      throw new RetentionError("RETENTION_POLICY_REVIEW_ALREADY_RECORDED");
    }
    const nextLegalReviewStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const reviewedAt = new Date();
    const updated = await tx.retentionPolicyVersion.update({
      where: { id: policy.id },
      data: {
        legalReviewStatus: nextLegalReviewStatus,
        legalReviewReference: sourceReference,
        legalReviewReason: reason,
        legalReviewedByUserId: input.actorUserId,
        legalReviewedAt: reviewedAt,
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "STATUS_CHANGE",
        entityType: "RetentionPolicyVersion",
        entityId: policy.id,
        message: `Independently recorded a retention-policy legal review: ${nextLegalReviewStatus}.`,
        metadata: { publicReference: policy.publicReference, dataClass: policy.dataClass, version: policy.version, decision: input.decision, sourceReference, reason },
      },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function activateRetentionPolicy(input: { publicReference: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const initial = await tx.retentionPolicyVersion.findUnique({ where: { publicReference: input.publicReference } });
    if (!initial) throw new RetentionError("RETENTION_POLICY_NOT_FOUND");
    await lockRetentionDataClass(tx, initial.dataClass);
    const policy = await tx.retentionPolicyVersion.findUnique({ where: { id: initial.id } });
    if (!policy) throw new RetentionError("RETENTION_POLICY_NOT_FOUND");
    assertSupportedRetentionPolicy(policy.dataClass, policy.action as RetentionAction);
    if (!isValidRetentionDays(policy.retentionDays)) throw new RetentionError("RETENTION_POLICY_DURATION_REQUIRED");
    if (policy.legalReviewStatus !== "APPROVED" || !policy.createdByUserId || !policy.legalReviewedByUserId || policy.legalReviewedByUserId === policy.createdByUserId || !policy.legalReviewReference || !policy.legalReviewReason || !policy.legalReviewedAt) {
      throw new RetentionError("RETENTION_POLICY_INDEPENDENT_LEGAL_REVIEW_REQUIRED");
    }
    if (input.actorUserId === policy.legalReviewedByUserId) throw new RetentionError("RETENTION_POLICY_ACTIVATOR_MUST_BE_INDEPENDENT");
    if (policy.status === "ACTIVE") return policy;
    if (policy.status !== "DRAFT") throw new RetentionError("RETENTION_POLICY_INVALID_STATE");

    const now = new Date();
    if (policy.effectiveAt && policy.effectiveAt <= now) throw new RetentionError("RETENTION_POLICY_EFFECTIVE_DATE_PASSED", "Create a new policy version with a current or future effective date; reviewed versions are immutable.");
    const effectiveAt = policy.effectiveAt ?? now;
    let policyReplacedReferences: string[] = [];
    if (effectiveAt > now) {
      const scheduled = await tx.retentionPolicyVersion.findFirst({ where: { dataClass: policy.dataClass, status: "ACTIVE", effectiveAt: { gt: now } }, select: { id: true, publicReference: true } });
      if (scheduled) throw new RetentionError("RETENTION_POLICY_SCHEDULE_CONFLICT");
    } else {
      const replaced = await tx.retentionPolicyVersion.findMany({ where: { dataClass: policy.dataClass, status: "ACTIVE" }, select: { publicReference: true } });
      await tx.retentionPolicyVersion.updateMany({ where: { dataClass: policy.dataClass, status: "ACTIVE" }, data: { status: "RETIRED" } });
      policyReplacedReferences = replaced.map((row) => row.publicReference);
    }

    const activated = await tx.retentionPolicyVersion.update({
      where: { id: policy.id },
      data: { status: "ACTIVE", effectiveAt, activatedByUserId: input.actorUserId },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "STATUS_CHANGE",
        entityType: "RetentionPolicyVersion",
        entityId: policy.id,
        message: "Activated an independently reviewed retention-policy version.",
        metadata: { publicReference: policy.publicReference, dataClass: policy.dataClass, version: policy.version, effectiveAt: effectiveAt.toISOString(), legalReviewReference: policy.legalReviewReference, legalReviewedByUserId: policy.legalReviewedByUserId, replacedPolicyReferences: policyReplacedReferences },
      },
    });
    return activated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function resolveRetentionPolicy(dataClass: string, at = new Date()) {
  if (!SUPPORTED_POLICY_ACTIONS[dataClass]) throw new RetentionError("RETENTION_POLICY_EXECUTOR_UNAVAILABLE");
  const policies = await phase5Repository.retentionPolicyVersion.findMany({
    where: { dataClass, action: SUPPORTED_POLICY_ACTIONS[dataClass][0], status: "ACTIVE", legalReviewStatus: "APPROVED", retentionDays: { not: null }, effectiveAt: { lte: at }, legalReviewReference: { not: null }, legalReviewReason: { not: null }, legalReviewedByUserId: { not: null }, legalReviewedAt: { not: null }, activatedByUserId: { not: null } },
    orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
    take: 200,
  });
  const policy = policies.find((candidate) =>
    isValidRetentionDays(candidate.retentionDays)
    &&
    typeof candidate.createdByUserId === "string"
    && typeof candidate.legalReviewedByUserId === "string"
    && typeof candidate.activatedByUserId === "string"
    && candidate.createdByUserId !== candidate.legalReviewedByUserId
    && candidate.activatedByUserId !== candidate.legalReviewedByUserId
  );
  if (!policy) throw new RetentionError("RETENTION_POLICY_NOT_FOUND");
  assertSupportedRetentionPolicy(dataClass, String(policy.action) as RetentionAction);
  return policy;
}
export function eligibleAt(policy: Record<string, unknown>, resourceCreatedAt: Date) { const days = policy.retentionDays; return isValidRetentionDays(days) ? new Date(resourceCreatedAt.getTime() + days * 86400000) : null; }

export async function executeAccountAnonymisation(input: { userId: string; policyVersionId?: string; operationId: string; actorReference: string }) {
  if (!input.policyVersionId) throw new RetentionError("RETENTION_POLICY_REQUIRED");
  const policy = await resolveRetentionPolicy("ACCOUNT_PROFILE");
  if (String(policy.id) !== input.policyVersionId || policy.action !== "ANONYMIZE") throw new RetentionError("RETENTION_POLICY_NOT_CURRENT");
  const retentionResource = await prisma.user.findUnique({ where: { id: input.userId }, select: { createdAt: true } });
  if (!retentionResource) throw new RetentionError("RETENTION_RESOURCE_NOT_FOUND");
  const eligible = eligibleAt(policy, retentionResource.createdAt);
  if (!eligible || eligible > new Date()) throw new RetentionError("RETENTION_NOT_ELIGIBLE");
  const executionKey = `ACCOUNT:${input.userId}:${input.operationId}`; const replay = await phase5Repository.retentionExecution.findUnique({ where: { executionKey } }); if (replay) return replay;
  const hold = await evaluateRetentionHolds({ subjectType: "User", subjectReference: input.userId });
  if (hold.hasHold) return phase5Repository.retentionExecution.create({ data: { executionKey, policyVersionId: input.policyVersionId ?? null, dataClass: "ACCOUNT_PROFILE", resourceType: "User", resourceReference: input.userId, action: "ANONYMIZE", status: "HELD", safeReasonCode: hold.activeHoldReason ?? "LEGAL_HOLD", actorReference: input.actorReference } });
  let claimed: Record<string, unknown>;
  try { claimed = await phase5Repository.retentionExecution.create({ data: { executionKey, policyVersionId: input.policyVersionId ?? null, dataClass: "ACCOUNT_PROFILE", resourceType: "User", resourceReference: input.userId, action: "ANONYMIZE", status: "PROCESSING", actorReference: input.actorReference } }); }
  catch { const existing = await phase5Repository.retentionExecution.findUnique({ where: { executionKey } }); if (existing) return existing; throw new RetentionError("RETENTION_EXECUTION_CONFLICT"); }
  const client = db as any; const user = await client.user.findUnique({ where: { id: input.userId } }); if (!user) throw new RetentionError("RETENTION_RESOURCE_NOT_FOUND");
  const token = createHash("sha256").update(`${input.userId}:${input.operationId}`).digest("hex").slice(0, 28);
  await client.$transaction(async (tx: any) => { await tx.user.update({ where: { id: input.userId }, data: { email: `deleted-${token}@anonymized.invalid`, name: "Deleted account", phone: null, passwordHash: null, status: "DISABLED" } }); await tx.session.deleteMany({ where: { userId: input.userId } }); if (tx.address) await tx.address.updateMany({ where: { userId: input.userId }, data: { line1: "Anonymized", line2: null, suburb: null, contactName: null, contactPhone: null, city: "Anonymized", postalCode: null, formattedAddress: null } }); });
  return phase5Repository.retentionExecution.update({ where: { id: String(claimed.id) }, data: { status: "COMPLETED", safeReasonCode: "IDENTITY_REMOVED_FINANCIAL_RELATIONSHIPS_RETAINED" } });
}
export async function executeRetentionTarget(input: { dataClass: string; resourceType: string; resourceReference: string; resourceCreatedAt: Date; subjectType: string; subjectReference: string; operationId: string; actorReference: string }) {
  const policy = await resolveRetentionPolicy(input.dataClass); const eligible = eligibleAt(policy, input.resourceCreatedAt); if (!eligible || eligible > new Date()) throw new RetentionError("RETENTION_NOT_ELIGIBLE");
  const key = `${policy.id}:${input.resourceType}:${input.resourceReference}:${input.operationId}`; const replay = await phase5Repository.retentionExecution.findUnique({ where: { executionKey: key } }); if (replay) return replay;
  const subjectHold = await evaluateRetentionHolds({ subjectType: input.subjectType, subjectReference: input.subjectReference });
  const hold = subjectHold.hasHold || input.resourceType !== "PrivateMediaObject"
    ? subjectHold
    : await evaluateRetentionHolds({ subjectType: "PrivateMediaObject", subjectReference: input.resourceReference });
  if (hold.hasHold) { try { return await phase5Repository.retentionExecution.create({ data: { executionKey: key, policyVersionId: String(policy.id), dataClass: input.dataClass, resourceType: input.resourceType, resourceReference: input.resourceReference, action: String(policy.action), status: "HELD", safeReasonCode: hold.activeHoldReason, actorReference: input.actorReference } }); } catch { const existing = await phase5Repository.retentionExecution.findUnique({ where: { executionKey: key } }); if (existing) return existing; throw new RetentionError("RETENTION_EXECUTION_CONFLICT"); } }
  if (String(policy.action) === "ANONYMIZE" && input.resourceType === "User") return executeAccountAnonymisation({ userId: input.resourceReference, policyVersionId: String(policy.id), operationId: input.operationId, actorReference: input.actorReference });
  if (input.dataClass === "PRIVATE_MEDIA" && input.resourceType === "PrivateMediaObject" && String(policy.action) === "DELETE") {
    let status: "COMPLETED" | "HELD" | "DEFERRED" = "COMPLETED";
    let safeReasonCode = "PRIVATE_MEDIA_DELETED";
    try {
      await new PrivateMediaService().requestDeletion({
        actor: { userId: input.actorReference, role: "SUPER_ADMIN" },
        reference: input.resourceReference,
      });
    } catch (error) {
      if (error instanceof PrivateMediaPolicyError) {
        if (error.code === "DEPOSIT_PROOF_FINANCIAL_HOLD") {
          status = "HELD";
          safeReasonCode = "DEPOSIT_PROOF_FINANCIAL_HOLD";
        } else if (error.code === "PRIVATE_MEDIA_NOT_FOUND") {
          throw new RetentionError("RETENTION_RESOURCE_NOT_FOUND");
        } else if (error.code === "PRIVATE_MEDIA_STORAGE_NOT_CONFIGURED" || error.code === "PRIVATE_MEDIA_STORAGE_FAILURE") {
          status = "DEFERRED";
          safeReasonCode = "PRIVATE_MEDIA_STORAGE_RETRY_REQUIRED";
        } else {
          throw error;
        }
      } else if (error instanceof PrivateMediaStorageError) {
        status = "DEFERRED";
        safeReasonCode = "PRIVATE_MEDIA_STORAGE_RETRY_REQUIRED";
      } else {
        throw error;
      }
    }
    try {
      return await phase5Repository.retentionExecution.create({
        data: {
          executionKey: key,
          policyVersionId: String(policy.id),
          dataClass: input.dataClass,
          resourceType: input.resourceType,
          resourceReference: input.resourceReference,
          action: String(policy.action),
          status,
          safeReasonCode: safeOperationalText(safeReasonCode, 80),
          actorReference: input.actorReference,
        },
      });
    } catch {
      const existing = await phase5Repository.retentionExecution.findUnique({ where: { executionKey: key } });
      if (existing) return existing;
      throw new RetentionError("RETENTION_EXECUTION_CONFLICT");
    }
  }
  try { return await phase5Repository.retentionExecution.create({ data: { executionKey: key, policyVersionId: String(policy.id), dataClass: input.dataClass, resourceType: input.resourceType, resourceReference: input.resourceReference, action: String(policy.action), status: ["FINANCIAL_LEDGER", "PAYMENT_METADATA", "CLAIM_EVIDENCE"].includes(input.dataClass) ? "RETAINED" : "DEFERRED", safeReasonCode: safeOperationalText("POLICY_EXECUTOR_REQUIRED", 80), actorReference: input.actorReference } }); } catch { const existing = await phase5Repository.retentionExecution.findUnique({ where: { executionKey: key } }); if (existing) return existing; throw new RetentionError("RETENTION_EXECUTION_CONFLICT"); }
}
