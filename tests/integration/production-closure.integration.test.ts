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
import { reviewedProtectedRowAudit, REQUIRED_PROTECTED_AUDIT_TABLES } from "@/scripts/audit-reviewed-production";
import { getProductionReadiness } from "@/lib/production-readiness/service";
import { getFinanceDashboard } from "@/lib/services/finance-dashboard.service";
import { listLedgerAccounts, listLedgerJournals } from "@/lib/services/ledger-query.service";
import { listPayments } from "@/lib/services/payment-query.service";
import { generateReportData } from "@/lib/reporting/report-generator";
import { createSandboxGatewayVerification, settleSandboxGatewayVerification } from "@/lib/payments/sandbox-acceptance.service";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";

describe("production closure configuration transactions on isolated PostgreSQL", () => {
  let author: AuthenticatedUser; let reviewer: AuthenticatedUser; const tag = uniqueTag("closure");
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/kt_launch_test" || url.username !== "kt_closure_test") throw new Error("Disposable closure database required; refusal is a failure, never a skip.");
    const [identity] = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
    expect(identity).toEqual({ database: "kt_launch_test", role: "kt_closure_test" });
    author = await createUser(`${tag}-author`, "SUPER_ADMIN"); reviewer = await createUser(`${tag}-reviewer`, "SUPER_ADMIN");
  });
  it("executes the operator audit read-only across all schema-discovered tables and detects synthetic changes without exporting row contents", async () => {
    const auditOwner = await createUser(`${tag}-audit`, "CUSTOMER");
    const latestCompany = await prisma.companyProfileVersion.aggregate({ _max: { versionNumber: true } });
    await prisma.companyProfileVersion.create({ data: {
      publicReference: `COMPANY-AUDIT-${tag}`, versionNumber: (latestCompany._max.versionNumber ?? 0) + 1,
      status: "DRAFT", legalName: "Disposable audit fixture", registrationNumber: "AUDIT-REG-DO-NOT-LOG", vatNumber: "AUDIT-VAT-DO-NOT-LOG",
      createdByUserId: auditOwner.id,
    } });
    const first = await reviewedProtectedRowAudit();
    expect(first.database).toMatchObject({ database: "kt_launch_test", role: "kt_closure_test", transactionReadOnly: "on" });
    expect(typeof (first.database as { leastPrivilegeVerified?: unknown }).leastPrivilegeVerified).toBe("boolean");
    const before = first.protected as Record<string, { count: number; hash: string }>;
    for (const requiredTable of REQUIRED_PROTECTED_AUDIT_TABLES) {
      expect(before[requiredTable]).toBeDefined();
    }
    expect(Object.keys(before).length).toBeGreaterThanOrEqual(REQUIRED_PROTECTED_AUDIT_TABLES.length);
    expect(Object.values(before).every(value => Number.isSafeInteger(value.count) && /^[a-f0-9]{64}$/.test(value.hash))).toBe(true);
    expect(JSON.stringify(first)).not.toContain("AUDIT-REG-DO-NOT-LOG");
    expect(JSON.stringify(first)).not.toContain("AUDIT-VAT-DO-NOT-LOG");
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
    await expect(savePaymentConfiguration(author, { storeId: store.id, deliveryServiceId: "CLIENT_CLOSURE", provinces: ["Western Cape"], regionId: null, orderId: null, mode: "DEPOSIT_PLUS_COD", depositPercent: "0.5", maximumCodAmount: "10.00", active: true, expectedVersion: 0, reason: "Missing usable region for Western Cape" })).rejects.toMatchObject({ code: "PAYMENT_REGION_UNAVAILABLE" });
    await createDeliveryRegion({ name: `${tag}-cod-gp`, slug: `${tag}-cod-gp`, province: "Gauteng", centerLat: -26.2, centerLng: 28.04, coverageRadiusKm: 40, maxDistanceKm: 80, active: true, pricingEnabled: true }, author.id);
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
  it("enforces immutable sandbox payment provenance, rejects old-release reuse, rejects pre-confirmation timestamps, and isolates live ledgers", async () => {
    const releaseSha = "691ebded959858e86b4cb28674f52394c1f5676c";
    const priorReleaseSha = "8031c874".padEnd(40, "0");
    const laneEnv = {
      NODE_ENV: "test",
      PAYSTACK_ACCEPTANCE_SANDBOX_ENABLED: "true",
      PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: "sk_test_closure_disposable_secret_1234",
      PAYMENT_APP_ORIGIN: "https://ktcouriers.test",
      RAILWAY_GIT_COMMIT_SHA: releaseSha,
    };
    const fakePaystack = {
      initializeTransaction: async ({ reference }: { reference: string }) => ({
        reference,
        authorization_url: `https://checkout.paystack.com/${reference}`,
      }),
      verifyTransaction: async (reference: string) => ({
        id: 987654321,
        reference,
        amount: 1000,
        currency: "ZAR",
        domain: "test",
        status: "success",
        paid_at: new Date().toISOString(),
        customer: { email: author.email },
      }),
    } as unknown as PaystackClient;

    const liveCountsBefore = {
      orders: await prisma.order.count(),
      payments: await prisma.payment.count(),
      livePlatformAccounts: await prisma.ledgerAccount.findMany({
        where: { wallet: { ownerType: "PLATFORM", ownerId: "platform" } },
        select: { id: true, currentBalance: true, debitTotal: true, creditTotal: true },
        orderBy: { id: "asc" },
      }),
      dashboard: await getFinanceDashboard(),
      accounts: await listLedgerAccounts({ page: 1, pageSize: 50 }),
      journals: await listLedgerJournals({ page: 1, pageSize: 50 }),
      adminPayments: await listPayments({ page: 1, pageSize: 50 }),
      reconciliationReport: await generateReportData({
        definitionKey: "admin-financial-reconciliation",
        requesterUserId: author.id,
        requesterRole: "SUPER_ADMIN",
        ownerScope: {},
        filters: {},
        limit: 100,
      }),
    };

    const created = await createSandboxGatewayVerification(
      { id: author.id, email: author.email },
      "11111111-2222-4333-8444-555555555555",
      { clientOverride: fakePaystack, env: laneEnv },
    );
    expect(created.status).toBe("CHECKOUT_READY");
    expect(created.releaseSha).toBe(releaseSha);

    const settled = await settleSandboxGatewayVerification(created.reference, {
      actorId: author.id,
      refresh: true,
      clientOverride: fakePaystack,
      env: laneEnv,
    });
    expect(settled?.status).toBe("SUCCEEDED");
    expect(settled?.ledgerJournalId).toBeTruthy();
    expect(settled?.resultDigest).toMatch(/^[a-f0-9]{64}$/);

    // Live order/payment/platform accounts & all live read aggregates remain completely untouched
    expect(await prisma.order.count()).toBe(liveCountsBefore.orders);
    expect(await prisma.payment.count()).toBe(liveCountsBefore.payments);
    const livePlatformAccountsAfter = await prisma.ledgerAccount.findMany({
      where: { wallet: { ownerType: "PLATFORM", ownerId: "platform" } },
      select: { id: true, currentBalance: true, debitTotal: true, creditTotal: true },
      orderBy: { id: "asc" },
    });
    expect(livePlatformAccountsAfter).toEqual(liveCountsBefore.livePlatformAccounts);
    expect(await getFinanceDashboard()).toEqual(liveCountsBefore.dashboard);
    expect(await listLedgerAccounts({ page: 1, pageSize: 50 })).toEqual(liveCountsBefore.accounts);
    expect(await listLedgerJournals({ page: 1, pageSize: 50 })).toEqual(liveCountsBefore.journals);
    expect(await listPayments({ page: 1, pageSize: 50 })).toEqual(liveCountsBefore.adminPayments);
    expect(
      await generateReportData({
        definitionKey: "admin-financial-reconciliation",
        requesterUserId: author.id,
        requesterRole: "SUPER_ADMIN",
        ownerScope: {},
        filters: {},
        limit: 100,
      }),
    ).toEqual(liveCountsBefore.reconciliationReport);

    // SQL trigger blocks mutating or deleting PaymentReleaseProvenance rows
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "PaymentReleaseProvenance" SET "releaseSha" = '${priorReleaseSha}' WHERE "paymentReference" = '${created.reference}'`),
    ).rejects.toThrow(/immutable/i);

    const baseEvidence = {
      kind: "SANDBOX" as const,
      key: "payment_integration_acceptance" as const,
      releaseSha,
      observedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      evidenceReference: `sandbox:${created.reference}`,
      reason: "PostgreSQL isolated sandbox acceptance verification test",
      genuineOperatorAcceptance: true as const,
      provider: "PAYSTACK" as const,
      paymentReference: created.reference,
      amount: "10.00",
      currency: "ZAR" as const,
    };

    // observedAt before providerConfirmedAt is denied
    await expect(
      recordAcceptanceEvidence(author.id, {
        expectedVersion: 0,
        evidence: {
          ...baseEvidence,
          observedAt: new Date(Date.parse(settled!.verifiedAt!) - 10_000).toISOString(),
        },
      }, { env: laneEnv }),
    ).rejects.toMatchObject({ status: 409 });

    // Reusing payment for a different release SHA is denied
    await expect(
      recordAcceptanceEvidence(author.id, {
        expectedVersion: 0,
        evidence: { ...baseEvidence, releaseSha: priorReleaseSha },
      }, { env: laneEnv }),
    ).rejects.toMatchObject({ status: 409 });

    // Saving & independent review succeeds with real observedAt <= now
    const nowObserved = new Date().toISOString();
    const draft = await recordAcceptanceEvidence(author.id, {
      expectedVersion: 0,
      evidence: { ...baseEvidence, observedAt: nowObserved },
    }, { env: laneEnv });
    await expect(
      reviewAcceptanceEvidence(author.id, { key: "payment_integration_acceptance", expectedVersion: draft.version, action: "APPROVE", reason: "Self approval denied" }, { env: laneEnv }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      reviewAcceptanceEvidence(reviewer.id, { key: "payment_integration_acceptance", expectedVersion: 99, action: "APPROVE", reason: "Stale conflict test" }, { env: laneEnv }),
    ).rejects.toMatchObject({ status: 409 });
    const approved = await reviewAcceptanceEvidence(reviewer.id, {
      key: "payment_integration_acceptance",
      expectedVersion: draft.version,
      action: "APPROVE",
      reason: "Independent admin approval on verified sandbox provenance",
    }, { env: laneEnv });
    expect(evidenceIsCurrent(approved, releaseSha, new Date(), { env: laneEnv })).toBe(true);

    // Revoking blocks reuse of that exact paymentReference even on same SHA
    const revoked = await reviewAcceptanceEvidence(reviewer.id, {
      key: "payment_integration_acceptance",
      expectedVersion: approved.version,
      action: "REVOKE",
      reason: "Testing revocation blocks replay of revoked reference",
    }, { env: laneEnv });
    expect(revoked.status).toBe("REVOKED");
    await expect(
      recordAcceptanceEvidence(author.id, {
        expectedVersion: revoked.version,
        evidence: { ...baseEvidence, observedAt: new Date().toISOString() },
      }, { env: laneEnv }),
    ).rejects.toMatchObject({ code: "SANDBOX_PAYMENT_REVOKED" });
  });
  it("reconciles capabilityMatrix with register readiness in getProductionReadiness on PostgreSQL", async () => {
    const board = await getProductionReadiness();
    expect(board.matrixReconciliation).toBeDefined();
    expect(board.matrixReconciliation.excludedCapabilities).toEqual(["ADVERTISING", "PROMOTERS", "SUBSCRIPTIONS"]);
    if (board.matrixReconciliation.inScopeMatrixBlockers.length > 0) {
      expect(board.status).toBe("BLOCKED");
    }
  });

  it("executes captureProtectedRowAuditReceipt under a dedicated PostgreSQL read-only role while blocking writes on that role and preserving app writes", async () => {
    const { captureProtectedRowAuditReceipt } = await import("@/scripts/audit-reviewed-production");
    const dbUrlRaw = process.env.DATABASE_URL;
    if (!dbUrlRaw) throw new Error("DATABASE_URL required for PostgreSQL closure integration test.");

    const roRole = "kt_audit_ro_closure";
    const roPass = "kt_readonly_disposable_pw_2026";
    const roParsed = new URL(dbUrlRaw);
    roParsed.username = roRole;
    roParsed.password = roPass;
    const roUrl = roParsed.toString();

    await prisma.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${roRole}') THEN CREATE ROLE "${roRole}" WITH LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD '${roPass}'; END IF; END $$;`);
    await prisma.$executeRawUnsafe(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;`);
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${roRole}";`);
    await prisma.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${roRole}";`);

    const deployments = {
      vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
      webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
      operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
      queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
    };

    try {
      const roClient = new (await import("@prisma/client")).PrismaClient({ datasourceUrl: roUrl });
      try {
        await expect(
          roClient.$executeRawUnsafe(
            `INSERT INTO "SystemSetting" ("id", "key", "label", "type", "value", "updatedAt") VALUES ('ro-fail', 'ro-fail', 'ro-fail', 'JSON'::"SystemSettingType", '{}'::jsonb, NOW())`,
          ),
        ).rejects.toThrow(/permission denied/i);
      } finally {
        await roClient.$disconnect();
      }

      // Normal application writes remain completely functional via primary DATABASE_URL
      await prisma.systemSetting.upsert({
        where: { key: "pg-closure-ro-verify-setting" },
        update: { label: "PG Closure Read-Only Verify", type: "JSON", value: { phase: "pre-baseline" } },
        create: { key: "pg-closure-ro-verify-setting", label: "PG Closure Read-Only Verify", type: "JSON", value: { phase: "pre-baseline" } },
      });

      const baseline = await captureProtectedRowAuditReceipt({
        releaseSha: "a".repeat(40),
        receiptReference: "pg-closure-base-01",
        readOnlyDatabaseUrl: roUrl,
        env: { ...process.env, KT_DATABASE_CLASSIFICATION: "isolated_test" },
        classification: "isolated_test",
        deployments,
        auditorPrincipal: "ci-postgres-auditor",
      });
      expect(baseline.databaseIdentity.leastPrivilegeVerified).toBe(true);
      expect(baseline.databaseIdentity.rolsuper).toBe(false);
      expect(baseline.databaseIdentity.rolbypassrls).toBe(false);
      expect(baseline.databaseIdentity.writableTables).toEqual([]);
      expect(baseline.inventory.inventoryComplete).toBe(true);

      const candidate = await captureProtectedRowAuditReceipt({
        releaseSha: "a".repeat(40),
        receiptReference: "pg-closure-cand-01",
        readOnlyDatabaseUrl: roUrl,
        env: { ...process.env, KT_DATABASE_CLASSIFICATION: "isolated_test" },
        classification: "isolated_test",
        baselineReceipt: baseline,
        deployments,
        auditorPrincipal: "ci-postgres-auditor",
      });
      expect(candidate.comparison.baselinePresent).toBe(true);
      expect(candidate.comparison.unchanged).toBe(true);
      expect(candidate.comparison.eligibleForParity).toBe(true);

      // Mutating via primary writable client is detected honestly against baseline
      await prisma.systemSetting.update({
        where: { key: "pg-closure-ro-verify-setting" },
        data: { value: { phase: "post-baseline" } },
      });
      const changedUndocumented = await captureProtectedRowAuditReceipt({
        releaseSha: "a".repeat(40),
        receiptReference: "pg-closure-chg-undoc",
        readOnlyDatabaseUrl: roUrl,
        env: { ...process.env, KT_DATABASE_CLASSIFICATION: "isolated_test" },
        classification: "isolated_test",
        baselineReceipt: baseline,
        deployments,
        auditorPrincipal: "ci-postgres-auditor",
      });
      expect(changedUndocumented.comparison.unchanged).toBe(false);
      expect(changedUndocumented.comparison.changedTables).toContain("SystemSetting");
      expect(changedUndocumented.comparison.eligibleForParity).toBe(false);
    } finally {
      await prisma.$executeRawUnsafe(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${roRole}";`).catch(() => {});
      await prisma.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM "${roRole}";`).catch(() => {});
      await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS "${roRole}";`).catch(() => {});
    }
  });
});
