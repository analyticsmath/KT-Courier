/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/types/db";
import { buildPrivacyExport, createPrivacyRequest, getPrivacyRequest, processConsentWithdrawal, transitionPrivacyRequest } from "@/lib/services/privacy-requests.service";
import { createRetentionHold, releaseRetentionHold } from "@/lib/retention/hold-evaluator";
import { activateRetentionPolicy, createRetentionPolicyVersion, executeAccountAnonymisation, executeRetentionTarget } from "@/lib/retention/privacy-retention.service";

const marker = `DSAR${randomUUID().replaceAll("-", "").toUpperCase()}`; let userA = ""; let userB = ""; let admin = "";
beforeAll(async () => { await prisma.$queryRaw`SELECT 1`; const rows = await Promise.all(["a", "b", "admin"].map((suffix) => prisma.user.create({ data: { email: `${marker.toLowerCase()}-${suffix}@example.test`, name: `DSAR ${suffix}`, passwordHash: "proof-only", role: suffix === "admin" ? UserRole.ADMIN : UserRole.CUSTOMER, status: UserStatus.ACTIVE } }))); [userA, userB, admin] = rows.map((row) => row.id); });

describe("Phase B DSAR/retention PostgreSQL production-service proof", () => {
  it("enforces self ownership, duplicate control, transitions, controlled deletion plan and export scope", async () => {
    const access = await createPrivacyRequest({ requesterUserId: userA, requestType: "ACCESS", operationId: `${marker}-ACCESS-001` });
    await expect(createPrivacyRequest({ requesterUserId: userA, requestType: "ACCESS", operationId: `${marker}-ACCESS-002` })).rejects.toMatchObject({ code: "PRIVACY_REQUEST_DUPLICATE" });
    await expect(getPrivacyRequest(String(access.publicReference), userB)).rejects.toMatchObject({ code: "PRIVACY_REQUEST_NOT_OWNER" });
    await expect(transitionPrivacyRequest({ actorUserId: admin, publicReference: String(access.publicReference), nextStatus: "COMPLETED", reasonCode: "BAD", operationId: `${marker}-BAD` })).rejects.toMatchObject({ code: "PRIVACY_REQUEST_INVALID_TRANSITION" });
    const deletion = await createPrivacyRequest({ requesterUserId: userA, requestType: "DELETION_OR_ANONYMISATION", operationId: `${marker}-DELETE-001` }); const detail = await getPrivacyRequest(String(deletion.publicReference));
    expect((detail as any).executionPlan.policySnapshot.domains.some((x: any) => x.dataClass === "FINANCIAL_LEDGER" && x.action === "RETAIN")).toBe(true);
    const exportData = await buildPrivacyExport(userA); expect(exportData).toHaveProperty("profile"); expect(JSON.stringify(exportData)).not.toContain("passwordHash");
  });
  it("delegates consent withdrawal and holds/retries retention without removing economic relationships", async () => {
    const withdrawal = await createPrivacyRequest({ requesterUserId: userB, requestType: "CONSENT_WITHDRAWAL", operationId: `${marker}-WITHDRAW-001` });
    await processConsentWithdrawal({ actorUserId: userB, publicReference: String(withdrawal.publicReference), operationId: `${marker}-WITHDRAW-DONE` });
    const withdrawalEvents = await (prisma as any).privacyRequestEvent.findMany({ where: { privacyRequestId: withdrawal.id } });
    expect(withdrawalEvents.map((event: any) => event.eventType)).toEqual(expect.arrayContaining(["UNDER_REVIEW", "APPROVED", "PROCESSING", "COMPLETED"]));

    const policy = await createRetentionPolicyVersion({ dataClass: "ACCOUNT_PROFILE", action: "ANONYMIZE", retentionDays: 0, actorUserId: admin });
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
