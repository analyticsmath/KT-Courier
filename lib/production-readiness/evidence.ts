import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "@/lib/client-platform/contracts";

export const acceptanceKeys = ["vendor_onboarding_acceptance", "driver_onboarding_acceptance", "driver_gps_acceptance", "pod_otp_acceptance", "live_paid_order_acceptance", "settlement_acceptance", "refund_acceptance", "payout_acceptance", "current_ci_certification", "production_deployment_sha_parity"] as const;
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const common = { releaseSha: sha, observedAt: z.iso.datetime(), expiresAt: z.iso.datetime(), evidenceReference: z.string().regex(/^[A-Za-z0-9:/._-]{8,250}$/), reason: z.string().trim().min(10).max(500) };
export const AcceptanceEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("LIVE"), key: z.enum(["vendor_onboarding_acceptance", "driver_onboarding_acceptance", "driver_gps_acceptance", "pod_otp_acceptance", "live_paid_order_acceptance", "settlement_acceptance", "refund_acceptance", "payout_acceptance"]), genuineOperatorAcceptance: z.literal(true), financialAuthorizationReference: z.string().regex(/^[A-Za-z0-9:/._-]{8,150}$/).nullable() }).strict(),
  z.object({ ...common, kind: z.literal("CI"), key: z.literal("current_ci_certification"), runUrl: z.string().regex(/^https:\/\/github\.com\/analyticsmath\/KT-Courier\/actions\/runs\/\d+$/), conclusion: z.literal("SUCCESS"), skippedCriticalTests: z.literal(0), testsPassed: z.number().int().positive() }).strict(),
  z.object({ ...common, kind: z.literal("PARITY"), key: z.literal("production_deployment_sha_parity"), vercelSha: sha, webSha: sha, operationsSha: sha, vercelDeploymentId: z.string().regex(/^dpl_[A-Za-z0-9]+$/), webDeploymentId: z.uuid(), operationsDeploymentId: z.uuid(), protectedDataAuditReference: z.string().regex(/^[A-Za-z0-9:/._-]{8,250}$/), protectedDataUnchanged: z.literal(true) }).strict(),
]).superRefine((v, context) => {
  if (new Date(v.observedAt) > new Date() || new Date(v.expiresAt) <= new Date(v.observedAt)) context.addIssue({ code: "custom", message: "Evidence requires an observed time and a later expiry." });
  if (v.kind === "PARITY" && [v.vercelSha, v.webSha, v.operationsSha].some((s) => s !== v.releaseSha)) context.addIssue({ code: "custom", message: "All production services must match the release SHA." });
  if (v.kind === "LIVE" && ["live_paid_order_acceptance", "settlement_acceptance", "refund_acceptance", "payout_acceptance"].includes(v.key) && !v.financialAuthorizationReference) context.addIssue({ code: "custom", message: "Financial acceptance requires a separately authorized operator evidence reference." });
});
export const AcceptanceDraftSchema = z.object({ evidence: AcceptanceEvidenceSchema, expectedVersion: z.number().int().nonnegative() }).strict();
export const AcceptanceReviewSchema = z.object({ key: z.enum(acceptanceKeys), expectedVersion: z.number().int().positive(), action: z.enum(["APPROVE", "REVOKE"]), reason: z.string().trim().min(10).max(500) }).strict();
const StoredSchema = z.object({ evidence: AcceptanceEvidenceSchema, version: z.number().int().positive(), status: z.enum(["DRAFT", "APPROVED", "REVOKED"]), authorId: z.string().min(1), approverId: z.string().nullable(), approvedAt: z.iso.datetime().nullable() }).strict();
const prefix = "production_acceptance_";
export type AcceptanceRecord = z.infer<typeof StoredSchema>;
export function evidenceIsCurrent(record: AcceptanceRecord | undefined, releaseSha: string | undefined, now = new Date()) {
  return !!record && record.status === "APPROVED" && !!record.approverId && record.approverId !== record.authorId && !!record.approvedAt && !!releaseSha && record.evidence.releaseSha === releaseSha && new Date(record.evidence.observedAt) <= now && new Date(record.evidence.expiresAt) > now;
}
export async function listAcceptanceEvidence() {
  const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: prefix } } });
  return rows.map((row) => StoredSchema.parse(row.value));
}
export async function recordAcceptanceEvidence(actorId: string, input: z.infer<typeof AcceptanceDraftSchema>) {
  const data = AcceptanceDraftSchema.parse(input); const key = prefix + data.evidence.key;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const prior = await tx.systemSetting.findUnique({ where: { key } });
    const version = prior ? StoredSchema.parse(prior.value).version : 0;
    if (version !== data.expectedVersion) throw new PlatformError("EVIDENCE_CONFLICT", "Refresh the acceptance evidence before saving.", 409);
    const value: AcceptanceRecord = { evidence: data.evidence, version: version + 1, status: "DRAFT", authorId: actorId, approverId: null, approvedAt: null };
    await tx.systemSetting.upsert({ where: { key }, create: { key, type: "JSON", label: "Production acceptance evidence", value: value as unknown as Prisma.InputJsonValue }, update: { value: value as unknown as Prisma.InputJsonValue } });
    await tx.adminActivityLog.create({ data: { actorUserId: actorId, action: "CREATE", entityType: "ProductionAcceptance", entityId: key, message: data.evidence.reason, metadata: { before: prior?.value ?? null, after: value as unknown as Prisma.InputJsonValue } } });
    return value;
  });
}
export async function reviewAcceptanceEvidence(actorId: string, input: z.infer<typeof AcceptanceReviewSchema>) {
  const data = AcceptanceReviewSchema.parse(input); const key = prefix + data.key;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const row = await tx.systemSetting.findUnique({ where: { key } }); const prior = row ? StoredSchema.parse(row.value) : null;
    if (!row || !prior || prior.version !== data.expectedVersion) throw new PlatformError("EVIDENCE_CONFLICT", "Refresh before reviewing.", 409);
    if (data.action === "APPROVE" && (prior.authorId === actorId || prior.status !== "DRAFT")) throw new PlatformError("INDEPENDENT_REVIEW_REQUIRED", "A different authorized administrator must review the draft and its linked evidence.", 403);
    const next: AcceptanceRecord = { ...prior, version: prior.version + 1, status: data.action === "APPROVE" ? "APPROVED" : "REVOKED", approverId: actorId, approvedAt: new Date().toISOString() };
    await tx.systemSetting.update({ where: { id: row.id, updatedAt: row.updatedAt }, data: { value: next as unknown as Prisma.InputJsonValue } });
    await tx.adminActivityLog.create({ data: { actorUserId: actorId, action: "UPDATE", entityType: "ProductionAcceptance", entityId: key, message: data.reason, metadata: { before: row.value, after: next as unknown as Prisma.InputJsonValue } } });
    return next;
  });
}
