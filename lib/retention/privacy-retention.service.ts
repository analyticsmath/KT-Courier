/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";
import { evaluateRetentionHolds } from "./hold-evaluator";

export const RETENTION_DATA_CLASSES = ["ACCOUNT_PROFILE", "CUSTOMER_ADDRESS", "MARKETING_PREFERENCE_HISTORY", "COOKIE_PREFERENCE_HISTORY", "LEGAL_ACCEPTANCE_EVIDENCE", "LOCATION_DATA", "PRIVATE_MEDIA", "CLAIM_EVIDENCE", "POD_EVIDENCE", "PAYMENT_METADATA", "FINANCIAL_LEDGER", "SECURITY_AUDIT", "DSAR_EXPORT"] as const;
export type RetentionAction = "DELETE" | "ANONYMIZE" | "PSEUDONYMIZE" | "RETAIN" | "ARCHIVE";
export class RetentionError extends Error { constructor(readonly code: string, message = code) { super(message); this.name = "RetentionError"; } }

export async function createRetentionPolicyVersion(input: { dataClass: string; action: RetentionAction; retentionDays?: number; effectiveAt?: Date; actorUserId: string }) {
  const current = await phase5Repository.retentionPolicyVersion.findMany({ where: { dataClass: input.dataClass }, orderBy: { version: "desc" }, take: 1 });
  return phase5Repository.retentionPolicyVersion.create({ data: { publicReference: phase5Reference("RTP"), dataClass: input.dataClass, version: Number(current[0]?.version ?? 0) + 1, action: input.action, retentionDays: input.retentionDays ?? null, effectiveAt: input.effectiveAt ?? null, createdByUserId: input.actorUserId } });
}
export async function activateRetentionPolicy(input: { publicReference: string; actorUserId: string }) {
  const policy = await phase5Repository.retentionPolicyVersion.findUnique({ where: { publicReference: input.publicReference } }); if (!policy) throw new RetentionError("RETENTION_POLICY_NOT_FOUND");
  await phase5Repository.retentionPolicyVersion.updateMany({ where: { dataClass: policy.dataClass, status: "ACTIVE" }, data: { status: "RETIRED" } });
  return phase5Repository.retentionPolicyVersion.update({ where: { id: String(policy.id) }, data: { status: "ACTIVE", effectiveAt: policy.effectiveAt ?? new Date(), activatedByUserId: input.actorUserId } });
}
export async function resolveRetentionPolicy(dataClass: string, at = new Date()) {
  const policies = await phase5Repository.retentionPolicyVersion.findMany({ where: { dataClass, status: "ACTIVE", effectiveAt: { lte: at } }, orderBy: { version: "desc" }, take: 1 });
  if (!policies[0]) throw new RetentionError("RETENTION_POLICY_NOT_FOUND"); return policies[0];
}
export function eligibleAt(policy: Record<string, unknown>, resourceCreatedAt: Date) { const days = Number(policy.retentionDays); return Number.isFinite(days) ? new Date(resourceCreatedAt.getTime() + days * 86400000) : null; }

export async function executeAccountAnonymisation(input: { userId: string; policyVersionId?: string; operationId: string; actorReference: string }) {
  const executionKey = `ACCOUNT:${input.userId}:${input.operationId}`; const replay = await phase5Repository.retentionExecution.findUnique({ where: { executionKey } }); if (replay) return replay;
  const hold = await evaluateRetentionHolds({ subjectType: "User", subjectReference: input.userId });
  if (hold.hasHold) return phase5Repository.retentionExecution.create({ data: { executionKey, policyVersionId: input.policyVersionId ?? null, dataClass: "ACCOUNT_PROFILE", resourceType: "User", resourceReference: input.userId, action: "ANONYMIZE", status: "HELD", safeReasonCode: hold.activeHoldReason ?? "LEGAL_HOLD", actorReference: input.actorReference } });
  let claimed: Record<string, unknown>;
  try { claimed = await phase5Repository.retentionExecution.create({ data: { executionKey, policyVersionId: input.policyVersionId ?? null, dataClass: "ACCOUNT_PROFILE", resourceType: "User", resourceReference: input.userId, action: "ANONYMIZE", status: "PROCESSING", actorReference: input.actorReference } }); }
  catch { const existing = await phase5Repository.retentionExecution.findUnique({ where: { executionKey } }); if (existing) return existing; throw new RetentionError("RETENTION_EXECUTION_CONFLICT"); }
  const client = db as any; const user = await client.user.findUnique({ where: { id: input.userId } }); if (!user) throw new RetentionError("RETENTION_RESOURCE_NOT_FOUND");
  const token = createHash("sha256").update(`${input.userId}:${input.operationId}`).digest("hex").slice(0, 28);
  await client.$transaction(async (tx: any) => { await tx.user.update({ where: { id: input.userId }, data: { email: `deleted-${token}@anonymized.invalid`, name: "Deleted account", phone: null, passwordHash: null, status: "DISABLED" } }); await tx.session.deleteMany({ where: { userId: input.userId } }); if (tx.address) await tx.address.updateMany({ where: { userId: input.userId }, data: { line1: "Anonymized", line2: null, contactName: null, contactPhone: null, city: "Anonymized", postalCode: null } }); });
  return phase5Repository.retentionExecution.update({ where: { id: String(claimed.id) }, data: { status: "COMPLETED", safeReasonCode: "IDENTITY_REMOVED_FINANCIAL_RELATIONSHIPS_RETAINED" } });
}
export async function executeRetentionTarget(input: { dataClass: string; resourceType: string; resourceReference: string; resourceCreatedAt: Date; subjectType: string; subjectReference: string; operationId: string; actorReference: string }) {
  const policy = await resolveRetentionPolicy(input.dataClass); const eligible = eligibleAt(policy, input.resourceCreatedAt); if (!eligible || eligible > new Date()) throw new RetentionError("RETENTION_NOT_ELIGIBLE");
  const key = `${policy.id}:${input.resourceType}:${input.resourceReference}:${input.operationId}`; const replay = await phase5Repository.retentionExecution.findUnique({ where: { executionKey: key } }); if (replay) return replay;
  const hold = await evaluateRetentionHolds({ subjectType: input.subjectType, subjectReference: input.subjectReference });
  if (hold.hasHold) { try { return await phase5Repository.retentionExecution.create({ data: { executionKey: key, policyVersionId: String(policy.id), dataClass: input.dataClass, resourceType: input.resourceType, resourceReference: input.resourceReference, action: String(policy.action), status: "HELD", safeReasonCode: hold.activeHoldReason, actorReference: input.actorReference } }); } catch { const existing = await phase5Repository.retentionExecution.findUnique({ where: { executionKey: key } }); if (existing) return existing; throw new RetentionError("RETENTION_EXECUTION_CONFLICT"); } }
  if (String(policy.action) === "ANONYMIZE" && input.resourceType === "User") return executeAccountAnonymisation({ userId: input.resourceReference, policyVersionId: String(policy.id), operationId: input.operationId, actorReference: input.actorReference });
  try { return await phase5Repository.retentionExecution.create({ data: { executionKey: key, policyVersionId: String(policy.id), dataClass: input.dataClass, resourceType: input.resourceType, resourceReference: input.resourceReference, action: String(policy.action), status: ["FINANCIAL_LEDGER", "PAYMENT_METADATA", "CLAIM_EVIDENCE"].includes(input.dataClass) ? "RETAINED" : "DEFERRED", safeReasonCode: safeOperationalText("POLICY_EXECUTOR_REQUIRED", 80), actorReference: input.actorReference } }); } catch { const existing = await phase5Repository.retentionExecution.findUnique({ where: { executionKey: key } }); if (existing) return existing; throw new RetentionError("RETENTION_EXECUTION_CONFLICT"); }
}
