import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import {
  assertValidCatalogProductFixtureInput,
  assertValidOrderAssignmentFixtureInput,
  assertValidPaymentFixtureInput,
  assertValidWalletFixtureInput,
  assertValidPaymentAttemptFixtureInput,
  assertValidPaymentWebhookEventFixtureInput,
  makeGate4PaymentAttemptPublicReference,
  makeGate4PaymentWebhookPublicReference,
  makeGate4PaymentWebhookFingerprint,
} from "../integration/gate4/fixtures";
import { parseGate4PostgresError } from "../../scripts/gate4-fixture-bootstrap.mjs";

describe("Gate 4 Fixture Contracts & Constraint Preflight Unit Tests", () => {
  describe("CatalogProduct Contract", () => {
    it("accepts valid CatalogProduct payload with array qualityIssues", () => {
      expect(() =>
        assertValidCatalogProductFixtureInput({
          title: "Test",
          slug: "test",
          status: "DRAFT",
          scope: "STORE_PRIVATE",
          qualityIssues: [],
        } as unknown as Prisma.CatalogProductCreateInput)
      ).not.toThrow();
    });

    it("rejects CatalogProduct payload with object qualityIssues", () => {
      expect(() =>
        assertValidCatalogProductFixtureInput({
          title: "Test",
          slug: "test",
          status: "DRAFT",
          scope: "STORE_PRIVATE",
          qualityIssues: {} as unknown as Prisma.JsonValue,
        } as unknown as Prisma.CatalogProductCreateInput)
      ).toThrow("CatalogProduct_quality_check constraint violation");
    });
  });

  describe("OrderAssignment Contract", () => {
    it("accepts ACCEPTED OrderAssignment when activeOrderGuard is provided", () => {
      expect(() =>
        assertValidOrderAssignmentFixtureInput({
          status: "ACCEPTED",
          activeOrderGuard: "order_123",
        } as unknown as Prisma.OrderAssignmentCreateInput)
      ).not.toThrow();
    });

    it("rejects ACCEPTED OrderAssignment when activeOrderGuard is missing", () => {
      expect(() =>
        assertValidOrderAssignmentFixtureInput({
          status: "ACCEPTED",
          activeOrderGuard: null,
        } as unknown as Prisma.OrderAssignmentCreateInput)
      ).toThrow("OrderAssignment_current_guard_consistency constraint violation");
    });
  });

  describe("Payment Contract", () => {
    it("accepts PROCESSING Payment without evidence", () => {
      expect(() =>
        assertValidPaymentFixtureInput({
          status: "PROCESSING",
          amount: "100.00",
        } as unknown as Prisma.PaymentCreateInput)
      ).not.toThrow();
    });

    it("rejects SUCCEEDED Payment without required provider evidence", () => {
      expect(() =>
        assertValidPaymentFixtureInput({
          status: "SUCCEEDED",
          amount: "100.00",
        } as unknown as Prisma.PaymentCreateInput)
      ).toThrow("Payment_succeeded_requires_provider_evidence_check constraint violation");
    });
  });

  describe("Wallet Contract", () => {
    it("accepts Wallet with zero legacy balances", () => {
      expect(() =>
        assertValidWalletFixtureInput({
          availableBalance: 0,
          pendingBalance: 0,
          lockedBalance: 0,
        } as unknown as Prisma.WalletCreateInput)
      ).not.toThrow();
    });

    it("rejects Wallet with non-zero availableBalance", () => {
      expect(() =>
        assertValidWalletFixtureInput({
          availableBalance: 100,
        } as unknown as Prisma.WalletCreateInput)
      ).toThrow("Wallet_legacy_balances_zero_check constraint violation");
    });
  });

  describe("PaymentAttempt Contract & Reference Generator", () => {
    it("generates compliant publicReference matching ^pat_[A-Za-z0-9_-]+$ with length 20..100", () => {
      const ref = makeGate4PaymentAttemptPublicReference("bootstrap-payment");
      expect(ref).toMatch(/^pat_[A-Za-z0-9_-]+$/);
      expect(ref.length).toBeGreaterThanOrEqual(20);
      expect(ref.length).toBeLessThanOrEqual(100);
    });

    it("accepts valid PaymentAttempt payload", () => {
      const ref = makeGate4PaymentAttemptPublicReference("test-attempt");
      expect(() =>
        assertValidPaymentAttemptFixtureInput({
          publicReference: ref,
          requestHash: "0".repeat(64),
          idempotencyKey: "idem_attempt_12345678",
        } as unknown as Prisma.PaymentAttemptCreateInput)
      ).not.toThrow();
    });

    it("rejects PaymentAttempt payload with invalid publicReference prefix", () => {
      expect(() =>
        assertValidPaymentAttemptFixtureInput({
          publicReference: "att_g4_bootstrap_payment_12345678",
          requestHash: "0".repeat(64),
          idempotencyKey: "idem_attempt_12345678",
        } as unknown as Prisma.PaymentAttemptCreateInput)
      ).toThrow("PaymentAttempt_public_reference_check constraint violation");
    });
  });

  describe("PaymentWebhookEvent Contract & Reference Generators", () => {
    it("generates compliant publicReference matching ^pwe_[A-Za-z0-9_-]+$ with length 20..100", () => {
      const ref = makeGate4PaymentWebhookPublicReference("bootstrap-webhook");
      expect(ref).toMatch(/^pwe_[A-Za-z0-9_-]+$/);
      expect(ref.length).toBeGreaterThanOrEqual(20);
      expect(ref.length).toBeLessThanOrEqual(100);
    });

    it("generates compliant 64-char hex eventFingerprint", () => {
      const fp = makeGate4PaymentWebhookFingerprint("test-event");
      expect(fp).toMatch(/^[a-f0-9]{64}$/);
    });

    it("accepts valid APPLIED PaymentWebhookEvent payload", () => {
      const ref = makeGate4PaymentWebhookPublicReference("test-applied");
      const fp = makeGate4PaymentWebhookFingerprint("test-applied");
      expect(() =>
        assertValidPaymentWebhookEventFixtureInput({
          publicReference: ref,
          eventFingerprint: fp,
          processingStatus: "APPLIED",
          normalizedStatus: "COMPLETE",
          sourceAddressVerified: true,
          signatureVerified: true,
          merchantVerified: true,
          amountVerified: true,
          providerDataVerified: true,
          verifiedAt: new Date(),
          appliedAt: new Date(),
          paymentId: "pay_123",
          attemptId: "att_123",
          ledgerJournalId: "jnl_123",
        })
      ).not.toThrow();
    });

    it("rejects APPLIED PaymentWebhookEvent payload missing ledgerJournalId when status is COMPLETE", () => {
      const ref = makeGate4PaymentWebhookPublicReference("test-bad-applied");
      const fp = makeGate4PaymentWebhookFingerprint("test-bad-applied");
      expect(() =>
        assertValidPaymentWebhookEventFixtureInput({
          publicReference: ref,
          eventFingerprint: fp,
          processingStatus: "APPLIED",
          normalizedStatus: "COMPLETE",
          sourceAddressVerified: true,
          signatureVerified: true,
          merchantVerified: true,
          amountVerified: true,
          providerDataVerified: true,
          verifiedAt: new Date(),
          appliedAt: new Date(),
          paymentId: "pay_123",
          attemptId: "att_123",
          ledgerJournalId: null,
        })
      ).toThrow("PaymentWebhookEvent_applied_coherence_check constraint violation");
    });
  });

  describe("Diagnostic PostgreSQL & Prisma Error Parser", () => {
    it("classifies Prisma P2002 as GATE4_FIXTURE_UNIQUE_COMPOSITION_VIOLATION", () => {
      const err = {
        code: "P2002",
        message: "Unique constraint failed on fields: (storeId, variantId)",
        meta: { target: ["storeId", "variantId"] },
        gate4OperationContext: {
          scenario: "Evidence-Backed Inventory Level Fixture",
          builder: "createGate4InventoryLevel",
          model: "StoreCatalogOffer",
          operation: "create",
        },
      };

      const parsed = parseGate4PostgresError(err, { id: "test", name: "Test Scenario" });

      expect(parsed.prismaErrorCode).toBe("P2002");
      expect(parsed.codeClassification).toBe("GATE4_FIXTURE_UNIQUE_COMPOSITION_VIOLATION");
      expect(parsed.table).toBe("StoreCatalogOffer");
      expect(parsed.builder).toBe("createGate4InventoryLevel");
      expect(parsed.scenario).toBe("Evidence-Backed Inventory Level Fixture");
      expect(parsed.uniqueTarget).toBe("storeId, variantId");
    });

    it("prioritizes inner P0001 code over outer 23514 classification", () => {
      const err = {
        message: "Raw query failed: P0001: Order order-123 currentDriverProfileId must match its accepted assignment",
        code: "P2010",
        meta: {
          code: "23514",
          originalError: { code: "P0001" },
        },
      };

      const parsed = parseGate4PostgresError(err, {
        id: "accepted-assignment",
        name: "Fulfilment Accepted Assignment Fixture",
        builder: "createGate4AcceptedAssignmentScenario",
        rootModels: ["OrderAssignment", "Order"],
        expectedOperations: ["OrderAssignment.create", "Order.update"],
      });

      expect(parsed.postgresSqlState).toBe("P0001");
      expect(parsed.codeClassification).toBe("GATE4_FIXTURE_TRIGGER_VIOLATION");
      expect(parsed.scenario).toBe("Fulfilment Accepted Assignment Fixture");
      expect(parsed.builder).toBe("createGate4AcceptedAssignmentScenario");
      expect(parsed.table).toBe("OrderAssignment");
    });

    it("correctly classifies 23514 CHECK violation", () => {
      const err = {
        message: 'db error: CONSTRAINT "PaymentAttempt_public_reference_check" (23514)',
        code: "23514",
      };

      const parsed = parseGate4PostgresError(err, {
        id: "captured-payment",
        name: "Captured Payment ITN Fixture",
        builder: "createGate4CapturedPaymentScenario",
        rootModels: ["PaymentAttempt"],
        expectedOperations: ["PaymentAttempt.create"],
      });

      expect(parsed.postgresSqlState).toBe("23514");
      expect(parsed.codeClassification).toBe("GATE4_FIXTURE_CHECK_VIOLATION");
    });

    it("correctly parses inventory evidence trigger failure with exact inner operation", () => {
      const err = {
        message: "Raw query failed: P0001: INVENTORY_PROJECTION_WITHOUT_MOVEMENT_EVIDENCE",
        code: "P2010",
        gate4OperationContext: {
          rootScenario: "Evidence-Backed Inventory Level Fixture",
          currentBuilder: "createGate4InventoryLevel",
          model: "CatalogInventoryMovement",
          operation: "create",
        },
      };

      const parsed = parseGate4PostgresError(err, {
        id: "inventory-level",
        name: "Evidence-Backed Inventory Level Fixture",
        builder: "createGate4InventoryLevel",
      });

      expect(parsed.scenario).toBe("Evidence-Backed Inventory Level Fixture");
      expect(parsed.builder).toBe("createGate4InventoryLevel");
      expect(parsed.table).toBe("CatalogInventoryMovement");
      expect(parsed.operation).toBe("CatalogInventoryMovement.create");
      expect(parsed.postgresSqlState).toBe("P0001");
      expect(parsed.codeClassification).toBe("GATE4_FIXTURE_TRIGGER_VIOLATION");
    });

    it("correctly parses payment version failure with exact model and operation", () => {
      const err = {
        message: "Payment version must increase with every state change.",
        code: "P2010",
        gate4OperationContext: {
          rootScenario: "Captured Payment ITN Fixture",
          currentBuilder: "createGate4CapturedPaymentScenario",
          model: "Payment",
          operation: "update",
        },
      };

      const parsed = parseGate4PostgresError(err, {
        id: "captured-payment",
        name: "Captured Payment ITN Fixture",
        builder: "createGate4CapturedPaymentScenario",
      });

      expect(parsed.scenario).toBe("Captured Payment ITN Fixture");
      expect(parsed.builder).toBe("createGate4CapturedPaymentScenario");
      expect(parsed.table).toBe("Payment");
      expect(parsed.operation).toBe("Payment.update");
      expect(parsed.postgresSqlState).toBe("23514");
      expect(parsed.codeClassification).toBe("GATE4_FIXTURE_CHECK_VIOLATION");
    });

    it("retains outer rootScenario when nested helper builder fails", () => {
      const err = {
        message: "Payment version must increase with every state change.",
        code: "P2010",
        gate4OperationContext: {
          rootScenario: "Marketplace Store Order Hierarchy Fixture",
          builderStack: ["createGate4MarketplaceStoreOrderScenario", "createGate4CapturedPaymentScenario"],
          currentBuilder: "createGate4CapturedPaymentScenario",
          model: "Payment",
          operation: "update",
        },
      };

      const parsed = parseGate4PostgresError(err, {
        id: "marketplace-store-order",
        name: "Marketplace Store Order Hierarchy Fixture",
        builder: "createGate4MarketplaceStoreOrderScenario",
      });

      expect(parsed.rootScenario).toBe("Marketplace Store Order Hierarchy Fixture");
      expect(parsed.scenario).toBe("Marketplace Store Order Hierarchy Fixture");
      expect(parsed.builder).toBe("createGate4CapturedPaymentScenario");
      expect(parsed.table).toBe("Payment");
      expect(parsed.operation).toBe("Payment.update");
      expect(parsed.postgresSqlState).toBe("23514");
      expect(parsed.codeClassification).toBe("GATE4_FIXTURE_CHECK_VIOLATION");
    });

    it("correctly classifies 23503 foreign key violation", () => {
      const parsed = parseGate4PostgresError({ code: "23503", message: "fk violation" }, { id: "test", name: "Test" });
      expect(parsed.postgresSqlState).toBe("23503");
      expect(parsed.codeClassification).toBe("GATE4_FIXTURE_FOREIGN_KEY_VIOLATION");
    });

    it("correctly classifies 23505 unique database violation", () => {
      const parsed = parseGate4PostgresError({ code: "23505", message: "unique violation" }, { id: "test", name: "Test" });
      expect(parsed.postgresSqlState).toBe("23505");
      expect(parsed.codeClassification).toBe("GATE4_FIXTURE_UNIQUE_DATABASE_VIOLATION");
    });
  });

  describe("Static Duplicate Unique-Claim Detector (Regression Test)", () => {
    it("detects duplicate CREATE unique claims in an operation graph", () => {
      const mockGraph = [
        { model: "StoreCatalogOffer", operation: "create", uniqueKeysClaimed: ["StoreCatalogOffer.storeId+variantId"] },
        { model: "StoreCatalogOffer", operation: "create", uniqueKeysClaimed: ["StoreCatalogOffer.storeId+variantId"] },
      ];

      const claims = new Set<string>();
      let duplicateFound = false;

      for (const op of mockGraph) {
        for (const key of op.uniqueKeysClaimed) {
          if (claims.has(key)) {
            duplicateFound = true;
          }
          claims.add(key);
        }
      }

      expect(duplicateFound).toBe(true);
    });

    it("verifies repaired Stage 0 operation graph artifact has zero duplicate unique claims in any scenario", () => {
      const graph = JSON.parse(
        readFileSync(join(process.cwd(), "artifacts", "gate4-fixture-operation-graph.json"), "utf-8")
      );

      for (const scenario of graph.scenarios) {
        const claims = new Set<string>();
        for (const op of scenario.operations) {
          for (const key of op.uniqueKeysClaimed || []) {
            expect(claims.has(key)).toBe(false);
            claims.add(key);
          }
        }
      }
    });
  });

  describe("Migration SQL to Contract Inventory Consistency", () => {
    it("verifies all referenced CHECK constraint names exist in active migrations", () => {
      const migrationsDir = join(process.cwd(), "prisma", "migrations");
      const migrationDirs = readdirSync(migrationsDir);
      let combinedSql = "";

      for (const dir of migrationDirs) {
        const sqlPath = join(migrationsDir, dir, "migration.sql");
        try {
          combinedSql += readFileSync(sqlPath, "utf-8") + "\n";
        } catch {
          // Skip if no migration.sql
        }
      }

      const checkContracts = JSON.parse(
        readFileSync(join(process.cwd(), "artifacts", "gate4-check-constraint-contracts.json"), "utf-8")
      );

      for (const contract of checkContracts.constraints) {
        expect(combinedSql).toContain(contract.constraintName);
      }
    });
  });

  describe("Frontier Completeness", () => {
    it("verifies gate4-constraint-frontier-audit.json has zero unaudited entries", () => {
      const audit = JSON.parse(
        readFileSync(join(process.cwd(), "artifacts", "gate4-constraint-frontier-audit.json"), "utf-8")
      );

      expect(audit.unauditedFrontierModels).toBe(0);
      for (const entry of audit.audits) {
        expect(entry.status).toBe("CHECKS_AUDITED");
      }
    });
  });

  describe("Stage 0 Root Cause Groups", () => {
    it("verifies 4 root failure groups are defined in gate4-stage0-root-cause-groups.json", () => {
      const rootGroups = JSON.parse(
        readFileSync(join(process.cwd(), "artifacts", "gate4-stage0-root-cause-groups.json"), "utf-8")
      );

      expect(rootGroups.groups.length).toBe(4);
      const rootModels = rootGroups.groups.map((g: { rootModel: string }) => g.rootModel);
      expect(rootModels).toContain("CatalogProduct");
      expect(rootModels).toContain("OrderAssignment");
      expect(rootModels).toContain("Payment");
      expect(rootModels).toContain("Wallet");
    });
  });
});
