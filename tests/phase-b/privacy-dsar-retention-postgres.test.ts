/* eslint-disable @typescript-eslint/no-explicit-any */
import { assertPrivacyDisposableDatabase } from "./privacy-disposable-guard";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { registerFaultInjectionHook } from "@/lib/db";
import { UserRole, UserStatus } from "@/types/db";
import { buildPrivacyExport, createPrivacyRequest, getPrivacyRequest, processConsentWithdrawal, transitionPrivacyRequest } from "@/lib/services/privacy-requests.service";
import { createRetentionHold, releaseRetentionHold } from "@/lib/retention/hold-evaluator";
import { activateRetentionPolicy, createRetentionPolicyVersion, executeAccountAnonymisation, executeRetentionTarget, reviewRetentionPolicyVersion } from "@/lib/retention/privacy-retention.service";
import { runConsentWithdrawalBatch } from "@/lib/privacy/consent-withdrawal-batch";

const marker = `DSAR${randomUUID().replaceAll("-", "").toUpperCase()}`; let userA = ""; let userB = ""; let admin = ""; let legalReviewer = "";
beforeAll(async () => { await assertPrivacyDisposableDatabase(); const rows = await Promise.all(["a", "b", "admin", "legal-reviewer"].map((suffix) => prisma.user.create({ data: { email: `${marker.toLowerCase()}-${suffix}@example.test`, name: `DSAR ${suffix}`, passwordHash: "proof-only", role: suffix === "admin" || suffix === "legal-reviewer" ? UserRole.ADMIN : UserRole.CUSTOMER, status: UserStatus.ACTIVE } }))); [userA, userB, admin, legalReviewer] = rows.map((row) => row.id); });

describe("Phase B DSAR/retention PostgreSQL production-service proof", () => {
  it("recovers authenticated consent withdrawals without advancing an administrator's review", async () => {
    const [owner, reviewedOwner] = await Promise.all(["batch", "manual"].map(suffix => prisma.user.create({ data: { email: `${marker.toLowerCase()}-${suffix}@example.test`, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE } })));
    const recovering = await createPrivacyRequest({ requesterUserId: owner.id, requestType: "CONSENT_WITHDRAWAL", operationId: `${marker}-RECOVERY` });
    const manual = await createPrivacyRequest({ requesterUserId: reviewedOwner.id, requestType: "CONSENT_WITHDRAWAL", operationId: `${marker}-MANUAL` });
    await transitionPrivacyRequest({ actorUserId: owner.id, publicReference: String(recovering.publicReference), nextStatus: "UNDER_REVIEW", reasonCode: "CANONICAL_CONSENT_WITHDRAWAL_REVIEW", operationId: `privacy-consent:${recovering.id}:REVIEW` });
    await transitionPrivacyRequest({ actorUserId: admin, publicReference: String(manual.publicReference), nextStatus: "UNDER_REVIEW", reasonCode: "MANUAL_REVIEW", operationId: `${marker}-MANUAL-REVIEW` });
    const preview = await runConsentWithdrawalBatch({ mode: "DRY_RUN", batchSize: 50 });
    expect(preview.itemsExamined).toBeGreaterThanOrEqual(1);
    expect((await prisma.privacyRequest.findUniqueOrThrow({ where: { id: String(recovering.id) } })).status).toBe("UNDER_REVIEW");
    await runConsentWithdrawalBatch({ mode: "APPLY", batchSize: 50 });
    expect((await prisma.privacyRequest.findUniqueOrThrow({ where: { id: String(recovering.id) } })).status).toBe("COMPLETED");
    expect((await prisma.privacyRequest.findUniqueOrThrow({ where: { id: String(manual.id) } })).status).toBe("UNDER_REVIEW");
    expect(await prisma.notificationConsentRecord.count({ where: { userId: owner.id, purpose: "MARKETING", status: "REVOKED" } })).toBe(4);
  });
  it("rolls back privacy request creation if its first audit event cannot be written", async () => {
    const existing = await createPrivacyRequest({ requesterUserId: userA, requestType: "OBJECTION", operationId: `${marker}-ATOMIC-SEED` });
    const targetOperation = `${marker}-ATOMIC-FAIL`;
    await (prisma as any).privacyRequestEvent.create({ data: { privacyRequestId: existing.id, operationId: `${targetOperation}:SUBMITTED`, eventType: "SUBMITTED", safeReasonCode: "DISPOSABLE_TEST", actorUserId: userA } });
    await expect(createPrivacyRequest({ requesterUserId: userB, requestType: "OBJECTION", operationId: targetOperation })).rejects.toThrow();
    expect(await (prisma as any).privacyRequest.findUnique({ where: { operationId: targetOperation } })).toBeNull();
  });
  it("rolls back a privacy status change and its event together on transaction failure", async () => {
    const request = await createPrivacyRequest({ requesterUserId: userB, requestType: "CORRECTION", operationId: `${marker}-TRANSITION-SEED` });
    const operationId = `${marker}-TRANSITION-FAIL`;
    const unregister = registerFaultInjectionHook("BEFORE_TRANSACTION_RETURN", (_checkpoint, context) => { if (context?.operationName === "privacy_request_transition") throw new Error("DISPOSABLE_PRIVACY_ROLLBACK"); });
    try {
      await expect(transitionPrivacyRequest({ actorUserId: admin, publicReference: String(request.publicReference), nextStatus: "UNDER_REVIEW", reasonCode: "REVIEW", operationId })).rejects.toThrow("DISPOSABLE_PRIVACY_ROLLBACK");
    } finally { unregister(); }
    expect((await (prisma as any).privacyRequest.findUnique({ where: { id: request.id } })).status).toBe("SUBMITTED");
    expect(await (prisma as any).privacyRequestEvent.findUnique({ where: { operationId } })).toBeNull();
  });
  it("serializes concurrent equivalent privacy submissions", async () => {
    const results = await Promise.allSettled(["A", "B"].map(suffix => createPrivacyRequest({ requesterUserId: userB, requestType: "PORTABILITY", operationId: `${marker}-CONCURRENT-${suffix}` })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { code: "PRIVACY_REQUEST_DUPLICATE" } });
    expect(await (prisma as any).privacyRequest.count({ where: { requesterUserId: userB, requestType: "PORTABILITY" } })).toBe(1);
  });
  it("replays concurrent submissions of the same privacy operation", async () => {
    const input = { requesterUserId: userA, requestType: "CORRECTION" as const, scope: ["user_profile"], operationId: `${marker}-CONCURRENT-SAME` };
    const [first, second] = await Promise.all([createPrivacyRequest(input), createPrivacyRequest(input)]);
    expect(first.id).toBe(second.id);
    expect(await (prisma as any).privacyRequest.count({ where: { operationId: input.operationId } })).toBe(1);
    expect(await (prisma as any).privacyRequestEvent.count({ where: { operationId: `${input.operationId}:SUBMITTED` } })).toBe(1);
  });
  it("enforces self ownership, duplicate control, transitions, controlled deletion plan and export scope", async () => {
    const access = await createPrivacyRequest({ requesterUserId: userA, requestType: "ACCESS", operationId: `${marker}-ACCESS-001` });
    expect((await createPrivacyRequest({ requesterUserId: userA, requestType: "ACCESS", operationId: `${marker}-ACCESS-001` })).id).toBe(access.id);
    await expect(createPrivacyRequest({ requesterUserId: userB, requestType: "ACCESS", operationId: `${marker}-ACCESS-001` })).rejects.toMatchObject({ code: "PRIVACY_REQUEST_OPERATION_CONFLICT" });
    await expect(createPrivacyRequest({ requesterUserId: userA, requestType: "ACCESS", scope: ["order_history"], operationId: `${marker}-ACCESS-001` })).rejects.toMatchObject({ code: "PRIVACY_REQUEST_OPERATION_CONFLICT" });
    await expect(createPrivacyRequest({ requesterUserId: userA, requestType: "ACCESS", operationId: `${marker}-ACCESS-002` })).rejects.toMatchObject({ code: "PRIVACY_REQUEST_DUPLICATE" });
    await expect(getPrivacyRequest(String(access.publicReference), userB)).rejects.toMatchObject({ code: "PRIVACY_REQUEST_NOT_OWNER" });
    await expect(transitionPrivacyRequest({ actorUserId: admin, publicReference: String(access.publicReference), nextStatus: "COMPLETED", reasonCode: "BAD", operationId: `${marker}-BAD` })).rejects.toMatchObject({ code: "PRIVACY_REQUEST_INVALID_TRANSITION" });
    await expect(transitionPrivacyRequest({ actorUserId: admin, publicReference: String(access.publicReference), nextStatus: "UNDER_REVIEW", reasonCode: "UNVERIFIED", operationId: `${marker}-UNVERIFIED` })).rejects.toMatchObject({ code: "PRIVACY_IDENTITY_VERIFICATION_REQUIRED" });
    expect((await getPrivacyRequest(String(access.publicReference), userA))?.status).toBe("IDENTITY_VERIFICATION_REQUIRED");
    const deletion = await createPrivacyRequest({ requesterUserId: userA, requestType: "DELETION_OR_ANONYMISATION", operationId: `${marker}-DELETE-001` }); const detail = await getPrivacyRequest(String(deletion.publicReference));
    expect((detail as any).executionPlan.policySnapshot.domains.some((x: any) => x.dataClass === "FINANCIAL_LEDGER" && x.action === "RETAIN")).toBe(true);
    const exportData = await buildPrivacyExport(userA); expect(exportData).toHaveProperty("profile"); expect(JSON.stringify(exportData)).not.toContain("passwordHash");
    expect(exportData.profile?.id).toBe(userA); expect(JSON.stringify(exportData)).not.toContain(`${marker.toLowerCase()}-b@example.test`);
  });
  it("delegates consent withdrawal and holds/retries retention without removing economic relationships", async () => {
    const withdrawal = await createPrivacyRequest({ requesterUserId: userB, requestType: "CONSENT_WITHDRAWAL", operationId: `${marker}-WITHDRAW-001` });
    await processConsentWithdrawal({ actorUserId: userB, publicReference: String(withdrawal.publicReference), operationId: `${marker}-WITHDRAW-DONE` });
    expect((await processConsentWithdrawal({ actorUserId: userB, publicReference: String(withdrawal.publicReference), operationId: `${marker}-WITHDRAW-DONE` })).status).toBe("COMPLETED");
    const withdrawalEvents = await (prisma as any).privacyRequestEvent.findMany({ where: { privacyRequestId: withdrawal.id } });
    expect(withdrawalEvents.map((event: any) => event.eventType)).toEqual(expect.arrayContaining(["UNDER_REVIEW", "APPROVED", "PROCESSING", "COMPLETED"]));

    await expect(executeAccountAnonymisation({ userId: userB, operationId: `${marker}-ANON-NO-POLICY`, actorReference: "POSTGRES_PROOF" })).rejects.toMatchObject({ code: "RETENTION_POLICY_REQUIRED" });
    const delayedPolicy = await createRetentionPolicyVersion({ dataClass: "ACCOUNT_PROFILE", action: "ANONYMIZE", retentionDays: 36500, actorUserId: admin });
    await reviewRetentionPolicyVersion({ publicReference: String(delayedPolicy.publicReference), actorUserId: legalReviewer, decision: "APPROVE", reason: "Verified the disposable delayed policy and its non-production source reference.", sourceReference: "TEST-POLICY-DELAYED", attested: true });
    const delayedActive = await activateRetentionPolicy({ publicReference: String(delayedPolicy.publicReference), actorUserId: admin });
    await expect(executeAccountAnonymisation({ userId: userB, policyVersionId: String(delayedActive.id), operationId: `${marker}-ANON-EARLY`, actorReference: "POSTGRES_PROOF" })).rejects.toMatchObject({ code: "RETENTION_NOT_ELIGIBLE" });

    const policy = await createRetentionPolicyVersion({ dataClass: "ACCOUNT_PROFILE", action: "ANONYMIZE", retentionDays: 0, actorUserId: admin });
    await expect(activateRetentionPolicy({ publicReference: String(policy.publicReference), actorUserId: admin })).rejects.toMatchObject({ code: "RETENTION_POLICY_INDEPENDENT_LEGAL_REVIEW_REQUIRED" });
    await expect(reviewRetentionPolicyVersion({ publicReference: String(policy.publicReference), actorUserId: admin, decision: "APPROVE", reason: "Test policy cannot be approved by its creator.", sourceReference: "TEST-POLICY", attested: true })).rejects.toMatchObject({ code: "RETENTION_POLICY_REVIEWER_MUST_BE_INDEPENDENT" });
    await expect(reviewRetentionPolicyVersion({ publicReference: String(policy.publicReference), actorUserId: legalReviewer, decision: "APPROVE", reason: "Test policy approval requires an explicit reviewer attestation.", sourceReference: "TEST-POLICY", attested: false })).rejects.toMatchObject({ code: "RETENTION_POLICY_REVIEW_ATTESTATION_REQUIRED" });
    await reviewRetentionPolicyVersion({ publicReference: String(policy.publicReference), actorUserId: legalReviewer, decision: "APPROVE", reason: "Verified the disposable test policy and its non-production source reference.", sourceReference: "TEST-POLICY", attested: true });
    await expect(activateRetentionPolicy({ publicReference: String(policy.publicReference), actorUserId: legalReviewer })).rejects.toMatchObject({ code: "RETENTION_POLICY_ACTIVATOR_MUST_BE_INDEPENDENT" });
    const active = await activateRetentionPolicy({ publicReference: String(policy.publicReference), actorUserId: admin });
    await createRetentionHold({ subjectType: "User", subjectReference: userB, reasonCode: "OPEN_CLAIM", actorUserId: admin });
    const held = await executeRetentionTarget({ dataClass: "ACCOUNT_PROFILE", resourceType: "User", resourceReference: userB, resourceCreatedAt: new Date(0), subjectType: "User", subjectReference: userB, operationId: `${marker}-HELD`, actorReference: "POSTGRES_PROOF" });
    expect(held.status).toBe("HELD");

    await releaseRetentionHold({ subjectType: "User", subjectReference: userB, actorUserId: admin });
    const [first, second] = await Promise.all([executeAccountAnonymisation({ userId: userB, policyVersionId: String(active.id), operationId: `${marker}-ANON`, actorReference: "POSTGRES_PROOF" }), executeAccountAnonymisation({ userId: userB, policyVersionId: String(active.id), operationId: `${marker}-ANON`, actorReference: "POSTGRES_PROOF" })]);
    expect(first.executionKey).toBe(second.executionKey);
    const anonymized = await prisma.user.findUnique({ where: { id: userB } });
    const executionCount = await (prisma as any).retentionExecution.count({ where: { executionKey: first.executionKey } });
    expect(anonymized?.status).toBe(UserStatus.DISABLED);
    expect(anonymized?.email).toMatch(/@anonymized\.invalid$/);
    expect(executionCount).toBe(1);
  });
});
