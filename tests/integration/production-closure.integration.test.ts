import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { saveDeliveryMatrix, actOnDeliveryMatrix, listDeliveryMatrices } from "@/lib/marketplace-checkout/delivery-policy-configuration";
import { selectMarketplaceDeliveryPolicy } from "@/lib/marketplace-checkout/delivery-policy";
import { recordAcceptanceEvidence, reviewAcceptanceEvidence, evidenceIsCurrent } from "@/lib/production-readiness/evidence";
import { savePaymentConfiguration, approvePaymentConfiguration } from "@/lib/client-platform/payment-configuration.service";
import { resolvePaymentPolicy } from "@/lib/payments/payment-policy.service";
import { saveBankInstructions } from "@/lib/client-platform/driver-cash.service";
import { createDeliveryRegion, updateDeliveryRegion } from "@/lib/services/admin-regions.service";
import { createUser, uniqueTag } from "./phase7-5-fixtures";
import type { AuthenticatedUser } from "@/types/domain";
import { reviewedProtectedRowAudit } from "@/scripts/audit-reviewed-production";

describe("production closure configuration transactions on isolated PostgreSQL", () => {
  let author: AuthenticatedUser; let reviewer: AuthenticatedUser; const tag = uniqueTag("closure");
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/kt_launch_test" || url.username !== "kt_closure_test") throw new Error("Disposable closure database required; refusal is a failure, never a skip.");
    const [identity] = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
    expect(identity).toEqual({ database: "kt_launch_test", role: "kt_closure_test" });
    author = await createUser(`${tag}-author`, "SUPER_ADMIN"); reviewer = await createUser(`${tag}-reviewer`, "SUPER_ADMIN");
  });
  it("executes the operator audit read-only and detects a synthetic protected-row change without exporting row contents", async () => {
    const auditOwner = await createUser(`${tag}-audit`, "CUSTOMER");
    const first = await reviewedProtectedRowAudit();
    expect(first.database).toEqual({ database: "kt_launch_test", role: "kt_closure_test", transactionReadOnly: "on" });
    const before = first.protected as Record<string, { count: number; hash: string }>;
    expect(Object.keys(before)).toHaveLength(17);
    expect(Object.values(before).every(value => Number.isSafeInteger(value.count) && /^[a-f0-9]{64}$/.test(value.hash))).toBe(true);
    const unchanged = await reviewedProtectedRowAudit(); expect(unchanged.protected).toEqual(before);
    const rawOwner = await prisma.user.findUniqueOrThrow({ where: { id: auditOwner.id } });
    expect(JSON.stringify(first)).not.toContain(rawOwner.email);
    await prisma.user.update({ where: { id: auditOwner.id }, data: { name: "Changed synthetic protected row" } });
    const changed = (await reviewedProtectedRowAudit()).protected as typeof before;
    expect(changed.User.count).toBe(before.User.count); expect(changed.User.hash).not.toBe(before.User.hash);
    for (const key of Object.keys(before).filter(key => key !== "User")) expect(changed[key]).toEqual(before[key]);
  });
  it("rejects activation without boundaries, persists valid points, rejects stale writes and permits explicit draft point clearing", async () => {
    await expect(createDeliveryRegion({ name: tag, slug: tag, active: true, pricingEnabled: true }, author.id)).rejects.toMatchObject({ status: 422 });
    const region = await createDeliveryRegion({ name: tag, slug: tag, province: "Gauteng", centerLat: -26, centerLng: 28, coverageRadiusKm: 15, maxDistanceKm: 40, active: true, pricingEnabled: true }, author.id);
    const updated = await updateDeliveryRegion(region.id, { active: false, centerLat: null, centerLng: null, expectedUpdatedAt: region.updatedAt.toISOString() }, author.id);
    expect(updated?.centerLat).toBeNull(); expect(updated?.centerLng).toBeNull();
    await expect(updateDeliveryRegion(region.id, { active: true, expectedUpdatedAt: region.updatedAt.toISOString() }, author.id)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.adminActivityLog.count({ where: { entityType: "DeliveryRegion", entityId: region.id } })).toBe(2);
  });
  it("persists immutable tariff versions and genuine independent approval; stale edits and self-approval fail", async () => {
    const draft = await saveDeliveryMatrix(author.id, { effectiveFrom: new Date(Date.now() - 1000).toISOString(), effectiveTo: null, expectedVersion: 0, reason: "Disposable matrix authority test", rules: [{ key: "DISPOSABLE", sizeClass: "ANY", minDistanceKm: 0, maxDistanceKm: 40, province: "Gauteng", regionId: null, storeId: null, fee: "10.00", highRiskSurcharge: "2.00", minimumFee: "5.00", maximumFee: "20.00" }] });
    let version = (await listDeliveryMatrices()).find((v) => v.version === draft.version)!;
    await expect(actOnDeliveryMatrix(author.id, { version: draft.version, expectedUpdatedAt: version.updatedAt, action: "APPROVE", reason: "Invalid self review test" })).rejects.toMatchObject({ status: 403 });
    await actOnDeliveryMatrix(reviewer.id, { version: draft.version, expectedUpdatedAt: version.updatedAt, action: "APPROVE", reason: "Disposable independent review" });
    await expect(actOnDeliveryMatrix(reviewer.id, { version: draft.version, expectedUpdatedAt: version.updatedAt, action: "ACTIVATE", reason: "Stale activation test" })).rejects.toMatchObject({ status: 409 });
    version = (await listDeliveryMatrices()).find((v) => v.version === draft.version)!;
    await actOnDeliveryMatrix(reviewer.id, { version: draft.version, expectedUpdatedAt: version.updatedAt, action: "ACTIVATE", reason: "Disposable tariff activation" });
    expect(selectMarketplaceDeliveryPolicy(await listDeliveryMatrices(), { distanceKm: 10, sizeClass: null, province: "Gauteng", regionId: "disposable", storeId: "disposable", highRisk: true }).fee).toBe("12.00");
  });
  it("keeps author-submitted acceptance blocked until independent review and binds it to the exact release", async () => {
    const evidence = { kind: "CI" as const, key: "current_ci_certification" as const, releaseSha: "a".repeat(40), observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), evidenceReference: "disposable:ci-evidence", reason: "Disposable evidence governance test", runUrl: "https://github.com/analyticsmath/KT-Courier/actions/runs/1", conclusion: "SUCCESS" as const, skippedCriticalTests: 0 as const, testsPassed: 1 };
    const draft = await recordAcceptanceEvidence(author.id, { evidence, expectedVersion: 0 }); expect(evidenceIsCurrent(draft, evidence.releaseSha)).toBe(false);
    await expect(reviewAcceptanceEvidence(author.id, { key: evidence.key, expectedVersion: draft.version, action: "APPROVE", reason: "Invalid self approval test" })).rejects.toMatchObject({ status: 403 });
    const approved = await reviewAcceptanceEvidence(reviewer.id, { key: evidence.key, expectedVersion: draft.version, action: "APPROVE", reason: "Independent disposable evidence review" });
    expect(evidenceIsCurrent(approved, evidence.releaseSha)).toBe(true); expect(evidenceIsCurrent(approved, "b".repeat(40))).toBe(false);
  });
  it("keeps COD as a draft, denies its author, and activates only reviewed 50/50 scope against the current secure remittance version", async () => {
    const owner = await createUser(`${tag}-store`, "STORE"); await prisma.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: new Date() } });
    const store = await prisma.store.create({ data: { name: tag, slug: `${tag}-store`, ownerUserId: owner.id, status: "ACTIVE" } });
    await prisma.deliveryServiceDefinition.create({ data: { stableKey: "CLIENT_CLOSURE", versionNumber: 1, displayName: "Disposable closure service", status: "ACTIVE", effectiveFrom: new Date(Date.now() - 1000), createdByUserId: author.id } });
    const effectiveFrom = new Date(Date.now() + 60000).toISOString(); const effectiveTo = new Date(Date.now() + 120000).toISOString();
    const saved = await savePaymentConfiguration(author, { storeId: store.id, deliveryServiceId: "CLIENT_CLOSURE", provinces: ["Gauteng"], regionId: null, orderId: null, mode: "DEPOSIT_PLUS_COD", depositPercent: "0.5", maximumCodAmount: "10.00", active: true, expectedVersion: 0, effectiveFrom, effectiveTo, reason: "Disposable COD operating draft" });
    expect((await prisma.paymentMethodPolicy.findUniqueOrThrow({ where: { id: saved.id } })).status).toBe("INACTIVE");
    const review = { policyId: saved.id, expectedVersion: saved.version, remittanceVerified: true as const, settlementTiming: "Disposable same-day settlement", reason: "Disposable independent COD approval" };
    await expect(approvePaymentConfiguration(author, review)).rejects.toMatchObject({ status: 403 });
    await expect(approvePaymentConfiguration(reviewer, review)).rejects.toMatchObject({ code: "COD_REMITTANCE_REVIEW_REQUIRED" });
    await saveBankInstructions(author, { bankName: "Disposable test institution", accountName: "Disposable fixture", accountNumber: "0".repeat(8), branchCode: "0".repeat(6), referenceHint: "Disposable order reference", expectedVersion: 0 });
    const approved = await approvePaymentConfiguration(reviewer, review); const row = await prisma.paymentMethodPolicy.findUniqueOrThrow({ where: { id: approved.id } });
    expect(row.status).toBe("ACTIVE"); expect(row.createdByUserId).toBe(author.id); expect(row.policyEvidence).toMatchObject({ approvedByUserId: reviewer.id, remittanceApproved: true });
    expect(row.effectiveFrom.toISOString()).toBe(effectiveFrom); expect(row.effectiveTo?.toISOString()).toBe(effectiveTo);
    const context = { storeId: store.id, deliveryServiceKey: "CLIENT_CLOSURE", provinces: ["Gauteng"] };
    await expect(resolvePaymentPolicy(context, new Date(new Date(effectiveFrom).getTime() - 1))).rejects.toMatchObject({ code: "PAYMENT_POLICY_NOT_CONFIGURED" });
    expect((await resolvePaymentPolicy(context, new Date(effectiveFrom))).id).toBe(row.id);
    await expect(resolvePaymentPolicy(context, new Date(effectiveTo))).rejects.toMatchObject({ code: "PAYMENT_POLICY_NOT_CONFIGURED" });
  });
  it("retains current authority until a scheduled successor starts and stops at its explicit end", async () => {
    const scope = { storeId: null, deliveryServiceId: null, provinces: null, regionId: null, orderId: null, mode: "DIGITAL" as const, depositPercent: null, maximumCodAmount: null, active: true, reason: "Disposable effective-window authority" };
    const first = await savePaymentConfiguration(author, { ...scope, expectedVersion: 0 });
    const start = new Date("2030-01-01T00:00:00Z"); const end = new Date("2030-02-01T00:00:00Z");
    const second = await savePaymentConfiguration(author, { ...scope, expectedVersion: first.version, effectiveFrom: start.toISOString(), effectiveTo: end.toISOString() });
    expect((await prisma.paymentMethodPolicy.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("ACTIVE");
    expect((await resolvePaymentPolicy({}, new Date(start.getTime() - 1))).id).toBe(first.id);
    expect((await resolvePaymentPolicy({}, start)).id).toBe(second.id);
    await expect(resolvePaymentPolicy({}, end)).rejects.toMatchObject({ code: "PAYMENT_POLICY_NOT_CONFIGURED" });
  });
});
