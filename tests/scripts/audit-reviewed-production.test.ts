import { describe, expect, it } from "vitest";
import {
  REQUIRED_PROTECTED_AUDIT_TABLES,
  buildAuditReceiptDigest,
  compareProtectedRowAudits,
  evaluatePostgreSqlLeastPrivilege,
  resolveDiscoverableProtectedTables,
  sanitizeAuditOutputForConsole,
} from "@/scripts/audit-reviewed-production";

describe("protected-row production audit hardening", () => {
  it("covers all core, finance, ledger, payment, settlement, custody, and policy tables beyond the legacy 17", () => {
    const discovered = [
      ...REQUIRED_PROTECTED_AUDIT_TABLES,
      "PaymentMethodPolicy",
      "CommissionPolicyRule",
      "DeliveryServiceDefinition",
      "DeliveryRegion",
      "_prisma_migrations",
    ];

    const resolved = resolveDiscoverableProtectedTables(discovered);
    expect(resolved).toContain("LedgerJournal");
    expect(resolved).toContain("LedgerEntry");
    expect(resolved).toContain("PaymentAttempt");
    expect(resolved).toContain("PaymentRefund");
    expect(resolved).toContain("WithdrawalRequest");
    expect(resolved).toContain("DriverEarning");
    expect(resolved).toContain("DriverCashDeposit");
    expect(resolved).toContain("PaymentReleaseProvenance");
    expect(resolved).toContain("PaystackSandboxVerification");
    expect(resolved).toContain("PaymentMethodPolicy");
    expect(resolved).toContain("CommissionPlan");
    expect(resolved).toContain("StoreOrderOperationalPolicy");
    expect(resolved).toContain("RetentionPolicyVersion");
    expect(resolved.length).toBeGreaterThan(25);
    for (const required of REQUIRED_PROTECTED_AUDIT_TABLES) {
      expect(resolved).toContain(required);
    }
  });

  it("flags superuser or DML-capable roles as NOT least-privilege even under SET TRANSACTION READ ONLY", () => {
    const superuserEval = evaluatePostgreSqlLeastPrivilege({
      role: "postgres",
      transactionReadOnly: "on",
      rolsuper: true,
      rolbypassrls: true,
      writableTables: ["Payment", "LedgerJournal"],
    });
    expect(superuserEval.leastPrivilegeVerified).toBe(false);
    expect(superuserEval.findings.some((f) => /superuser|bypassrls|write/i.test(f))).toBe(true);

    const readonlyEval = evaluatePostgreSqlLeastPrivilege({
      role: "kt_audit_ro",
      transactionReadOnly: "on",
      rolsuper: false,
      rolbypassrls: false,
      writableTables: [],
    });
    expect(readonlyEval.leastPrivilegeVerified).toBe(true);
    expect(readonlyEval.findings).toEqual([]);
  });

  it("redacts store names/slugs and sensitive identifiers from standard console audit output", () => {
    const rawReport = {
      event: "kt_reviewed_production_evidence",
      at: "2026-11-24T12:00:00.000Z",
      readOnly: true,
      releaseSha: "691ebded959858e86b4cb28674f52394c1f5676c",
      database: { database: "railway", role: "postgres", transactionReadOnly: "on", leastPrivilegeVerified: false, privilegeFindings: ["SUPERUSER"] },
      storeCollectionSummary: { activeStoreCount: 39, readyStoreCount: 0 },
      storesRestricted: [{ id: "store_1", name: "Secret Vendor", slug: "secret-vendor" }],
      protected: { User: { count: 100, hash: "a".repeat(64) } },
      receiptDigest: "b".repeat(64),
    };

    const redacted = sanitizeAuditOutputForConsole(rawReport);
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("Secret Vendor");
    expect(serialized).not.toContain("secret-vendor");
    expect(redacted.storeCollectionSummary).toEqual({ activeStoreCount: 39, readyStoreCount: 0 });
  });

  it("detects identical snapshots, mutated rows, commerce drift, and missing pre-deployment baseline explicitly", () => {
    const base = {
      releaseSha: "a".repeat(40),
      migrationCount: 132,
      latestMigration: "20261124160000_acceptance_provenance_and_sandbox_lane",
      protected: {
        User: { count: 10, hash: "1".repeat(64) },
        Order: { count: 5, hash: "2".repeat(64) },
        LedgerJournal: { count: 8, hash: "3".repeat(64) },
      },
    };
    const same = { ...base, releaseSha: "b".repeat(40) };
    expect(compareProtectedRowAudits(base, same)).toMatchObject({
      unchanged: true,
      changedTables: [],
      addedTables: [],
      removedTables: [],
      commerceActivityDetected: false,
      limitations: [],
    });

    const mutated = {
      ...base,
      protected: {
        User: { count: 10, hash: "f".repeat(64) },
        Order: { count: 6, hash: "e".repeat(64) },
        LedgerJournal: { count: 9, hash: "d".repeat(64) },
      },
    };
    expect(compareProtectedRowAudits(base, mutated)).toMatchObject({
      unchanged: false,
      changedTables: ["LedgerJournal", "Order", "User"],
      commerceActivityDetected: true,
    });

    const missingBaseline = compareProtectedRowAudits(null, same);
    expect(missingBaseline.unchanged).toBe(false);
    expect(missingBaseline.limitations).toContain("PRE_DEPLOYMENT_BASELINE_ABSENT");
  });

  it("produces deterministic SHA-256 receipt digests bound to release SHA and schema version", () => {
    const input = {
      at: "2026-11-24T12:00:00.000Z",
      releaseSha: "691ebded959858e86b4cb28674f52394c1f5676c",
      migrationCount: 132,
      latestMigration: "20261124160000_acceptance_provenance_and_sandbox_lane",
      protected: { User: { count: 5, hash: "a".repeat(64) } },
    };
    expect(buildAuditReceiptDigest(input)).toBe(buildAuditReceiptDigest({ ...input }));
    expect(buildAuditReceiptDigest(input)).not.toBe(buildAuditReceiptDigest({ ...input, releaseSha: "c".repeat(40) }));
  });
});
