import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertDemoDatabaseIdentity,
  assertDestructiveResetAllowed,
  assertSeedExecutionAllowed,
  sanitizeConnectionDetails,
  SeedSafetyError,
  DEDICATED_DEMO_DB_NAME,
} from "@/lib/security/seed-safety";

describe("Demo Seed Safety & Database Reset Guardrails", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("assertSeedExecutionAllowed", () => {
    it("rejects execution when NODE_ENV is production", () => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "production",
          classification: "development",
          allowDemoSeed: true,
        })
      ).toThrow(SeedSafetyError);
    });

    it("rejects execution when database classification is production", () => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "development",
          classification: "production",
          allowDemoSeed: true,
        })
      ).toThrow(SeedSafetyError);
    });

    it("rejects execution when database classification is staging", () => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "development",
          classification: "staging",
          allowDemoSeed: true,
        })
      ).toThrow(SeedSafetyError);
    });

    it("fails closed when classification is missing in non-test env", () => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "development",
          classification: "",
          allowDemoSeed: true,
        })
      ).toThrow(SeedSafetyError);
    });

    it("rejects unrecognized classification values", () => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "development",
          classification: "custom_cluster",
          allowDemoSeed: true,
        })
      ).toThrow(SeedSafetyError);
    });

    it("rejects execution without explicit KT_ALLOW_DEMO_SEED in development", () => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "development",
          classification: "development",
          allowDemoSeed: false,
        })
      ).toThrow(SeedSafetyError);
    });

    it("permits execution when development classification and KT_ALLOW_DEMO_SEED=true", () => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "development",
          classification: "development",
          allowDemoSeed: true,
        })
      ).not.toThrow();
    });

    it("permits execution in test environment", () => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "test",
          classification: "test",
          allowDemoSeed: false,
        })
      ).not.toThrow();
    });
  });

  describe("assertDemoDatabaseIdentity", () => {
    it("rejects missing or empty database URL", () => {
      expect(() => assertDemoDatabaseIdentity("")).toThrow(SeedSafetyError);
    });

    it("rejects non-postgres protocols", () => {
      expect(() => assertDemoDatabaseIdentity("mysql://localhost:3306/kt_courier_demo_full")).toThrow(SeedSafetyError);
    });

    it("rejects non-local database hosts", () => {
      expect(() =>
        assertDemoDatabaseIdentity("postgres://user:pass@db.production.ktcouriers.co.za:5432/kt_courier_demo_full")
      ).toThrow(SeedSafetyError);
    });

    it("rejects reserved primary database names (kt_courier, postgres)", () => {
      expect(() =>
        assertDemoDatabaseIdentity("postgres://postgres:postgres@localhost:5432/kt_courier")
      ).toThrow(SeedSafetyError);

      expect(() =>
        assertDemoDatabaseIdentity("postgres://postgres:postgres@127.0.0.1:5432/postgres")
      ).toThrow(SeedSafetyError);

      expect(() =>
        assertDemoDatabaseIdentity("postgres://postgres:postgres@localhost:5432/kt_courier_production")
      ).toThrow(SeedSafetyError);
    });

    it("rejects arbitrary database names that do not match dedicated demo pattern", () => {
      expect(() =>
        assertDemoDatabaseIdentity("postgres://postgres:postgres@localhost:5432/my_random_database")
      ).toThrow(SeedSafetyError);
    });

    it("accepts dedicated demo database on localhost", () => {
      const result = assertDemoDatabaseIdentity(
        `postgres://postgres:secret@localhost:5432/${DEDICATED_DEMO_DB_NAME}`
      );
      expect(result.dbName).toBe(DEDICATED_DEMO_DB_NAME);
      expect(result.host).toBe("localhost");
      expect(result.port).toBe("5432");
    });

    it("accepts dedicated test disposable database on 127.0.0.1", () => {
      const result = assertDemoDatabaseIdentity(
        "postgresql://postgres:secret@127.0.0.1:5433/kt_courier_test_ci"
      );
      expect(result.dbName).toBe("kt_courier_test_ci");
      expect(result.host).toBe("127.0.0.1");
      expect(result.port).toBe("5433");
    });
  });

  describe("assertDestructiveResetAllowed", () => {
    it("enforces target database name match", () => {
      expect(() =>
        assertDestructiveResetAllowed({
          nodeEnv: "test",
          classification: "test",
          dbUrl: "postgres://postgres:secret@localhost:5432/kt_courier_demo_full",
          targetDbName: "kt_courier_demo_wrong",
        })
      ).toThrow(SeedSafetyError);
    });

    it("succeeds when target identity and environment are valid", () => {
      const result = assertDestructiveResetAllowed({
        nodeEnv: "test",
        classification: "test",
        dbUrl: "postgres://postgres:secret@localhost:5432/kt_courier_demo_full",
        targetDbName: "kt_courier_demo_full",
      });
      expect(result.dbName).toBe("kt_courier_demo_full");
    });
  });

  describe("sanitizeConnectionDetails", () => {
    it("redacts credentials from postgres URL", () => {
      const sanitized = sanitizeConnectionDetails("postgres://admin:super_secret_password@localhost:5432/kt_courier_demo_full");
      expect(sanitized).not.toContain("super_secret_password");
      expect(sanitized).toContain("admin@localhost:5432/kt_courier_demo_full");
    });
  });
});
