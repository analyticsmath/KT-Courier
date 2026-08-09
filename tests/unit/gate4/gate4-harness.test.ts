import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { validateGate4DatabaseSafety, sanitizeDatabaseUrl } from "../../integration/gate4/harness-safety";
import { ConcurrencyBarrier } from "../../integration/gate4/barrier";
import { isRetryableTransactionError, calculateBackoff } from "@/lib/db/transaction-runner";
import { registerFaultInjectionHook, triggerFaultInjectionCheckpoint, clearAllFaultInjectionHooks } from "@/lib/db/fault-injection";
import { assertDisposableGate4Identity } from "../../../scripts/docker-common.mjs";
import { constructGate4DatabaseUrl } from "../../../scripts/docker-gate4-integration.mjs";
import { gate4Suites, buildGate4VitestArgs, classifyGate4Failure, runStaticDiscoveryPreflight } from "../../../scripts/run-gate4-integration.mjs";

describe("Gate 4 — Fast Harness Unit Tests (Non-Database)", () => {
  it("sanitizes passwords from database URLs for safe logging", () => {
    const raw = "postgresql://user:secretpass123@localhost:5432/kt_courier_test";
    const sanitized = sanitizeDatabaseUrl(raw);
    expect(sanitized).not.toContain("secretpass123");
    expect(sanitized).toContain("****");
  });

  it("blocks execution when opt-in flag is missing", () => {
    const res = validateGate4DatabaseSafety({});
    expect(res.ok).toBe(false);
    expect(res.status).toContain("BLOCKED");
  });

  it("blocks execution when NODE_ENV=production", () => {
    const res = validateGate4DatabaseSafety({
      KT_ALLOW_DATABASE_INTEGRATION_TESTS: "true",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/kt_courier_disposable_test",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("strictly forbidden when NODE_ENV=production");
  });

  it("blocks non-loopback remote database hosts", () => {
    const res = validateGate4DatabaseSafety({
      KT_ALLOW_DATABASE_INTEGRATION_TESTS: "true",
      DATABASE_URL: "postgresql://user:pass@remote-postgres.example.com:5432/kt_courier_test",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("Remote host rejected");
  });

  it("blocks persistent default database names without test markers", () => {
    const res = validateGate4DatabaseSafety({
      KT_ALLOW_DATABASE_INTEGRATION_TESTS: "true",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/kt_courier",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("Default or persistent database name rejected");
  });

  it("approves valid disposable local PostgreSQL database URL", () => {
    const res = validateGate4DatabaseSafety({
      KT_ALLOW_DATABASE_INTEGRATION_TESTS: "true",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kt_courier_disposable_test",
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("GATE4_INTEGRATION_STATUS=ALLOWED");
  });

  it("asserts Gate 4 disposable identity rejects normal compose project name", () => {
    expect(() => assertDisposableGate4Identity("kt-couriers")).toThrow("Refusing execution for non-disposable Gate 4 Compose project 'kt-couriers'");
  });

  it("asserts Gate 4 disposable identity rejects non-gate4 database name", () => {
    expect(() =>
      assertDisposableGate4Identity("kt-couriers-gate4", { POSTGRES_DB: "kt_courier_dev" })
    ).toThrow("Refusing execution for non-disposable Gate 4 database 'kt_courier_dev'");
  });

  it("asserts Gate 4 disposable identity rejects production/staging database host or URL", () => {
    expect(() =>
      assertDisposableGate4Identity("kt-couriers-gate4", {
        POSTGRES_DB: "kt_courier_gate4_disposable",
        DATABASE_URL: "postgresql://user:pass@production-db.internal:5432/kt_courier_gate4_disposable",
      })
    ).toThrow("Refusing execution for non-local database host 'production-db.internal'");
  });

  it("asserts Gate 4 disposable identity accepts valid Gate 4 disposable settings", () => {
    expect(() =>
      assertDisposableGate4Identity("kt-couriers-gate4", {
        POSTGRES_DB: "kt_courier_gate4_disposable",
        DATABASE_URL: "postgresql://kt_courier_gate4_disposable:pass@localhost:55834/kt_courier_gate4_disposable",
      })
    ).not.toThrow();
  });

  it("constructs disposable Gate 4 database URL on target safe port", () => {
    const url = constructGate4DatabaseUrl("localhost", "55834");
    expect(url).toBe(
      "postgresql://kt_courier_gate4_disposable:gate4_local_only_password@localhost:55834/kt_courier_gate4_disposable?schema=public"
    );
    expect(sanitizeDatabaseUrl(url)).not.toContain("gate4_local_only_password");
  });

  it("synchronizes barrier release when target count is reached", async () => {
    const barrier = new ConcurrencyBarrier(3);
    let count = 0;

    const worker = async () => {
      await barrier.wait();
      count += 1;
    };

    const p1 = worker();
    const p2 = worker();
    expect(count).toBe(0);

    const p3 = worker();
    await Promise.all([p1, p2, p3]);
    expect(count).toBe(3);
  });

  it("cancels barrier gracefully on worker failure prior to checkpoint", async () => {
    const barrier = new ConcurrencyBarrier(3, 2000);
    const workerSuccess = async () => {
      await barrier.wait();
    };

    const p1 = workerSuccess();
    barrier.cancel(new Error("Worker 2 setup failed"));

    await expect(p1).rejects.toThrow("Worker 2 setup failed");
  });

  it("classifies P2034, 40001, 40P01 as retryable errors", () => {
    expect(isRetryableTransactionError({ code: "P2034" })).toBe(true);
    expect(isRetryableTransactionError({ meta: { code: "40001" } })).toBe(true);
    expect(isRetryableTransactionError({ message: "could not serialize access due to concurrent update" })).toBe(true);
    expect(isRetryableTransactionError(new Error("Business validation failure"))).toBe(false);
  });

  it("calculates deterministic backoff when jitter is disabled", () => {
    expect(calculateBackoff(0, 20, 500, false)).toBe(20);
    expect(calculateBackoff(1, 20, 500, false)).toBe(40);
    expect(calculateBackoff(2, 20, 500, false)).toBe(80);
    expect(calculateBackoff(10, 20, 500, false)).toBe(500);
  });

  it("triggers registered fault-injection checkpoint callbacks and unregisters cleanly", async () => {
    let triggered = false;
    const unhook = registerFaultInjectionHook("BEFORE_OUTBOX_WRITE", () => {
      triggered = true;
    });

    await triggerFaultInjectionCheckpoint("BEFORE_OUTBOX_WRITE");
    expect(triggered).toBe(true);

    triggered = false;
    unhook();
    await triggerFaultInjectionCheckpoint("BEFORE_OUTBOX_WRITE");
    expect(triggered).toBe(false);

    clearAllFaultInjectionHooks();
  });

  it("verifies default vitest config excludes tests/integration/**", () => {
    const mainConfigPath = path.resolve(process.cwd(), "vitest.config.ts");
    expect(fs.existsSync(mainConfigPath)).toBe(true);
    const content = fs.readFileSync(mainConfigPath, "utf8");
    expect(content).toContain("tests/integration/**");
  });

  it("verifies dedicated Gate 4 config includes Gate 4 tests and does not exclude them", () => {
    const gate4ConfigPath = path.resolve(process.cwd(), "vitest.gate4.config.ts");
    expect(fs.existsSync(gate4ConfigPath)).toBe(true);
    const content = fs.readFileSync(gate4ConfigPath, "utf8");
    expect(content).toContain("tests/integration/gate4/**/*.test.ts");
    expect(content).not.toContain("tests/integration/**");
  });

  it("verifies Gate 4 suite inventory is exactly 11 files with zero missing, skipped, or empty", () => {
    expect(gate4Suites.length).toBe(11);
    const discovery = runStaticDiscoveryPreflight();
    expect(discovery.requiredCount).toBe(11);
    expect(discovery.discoveredCount).toBe(11);
    expect(discovery.missingCount).toBe(0);
    expect(discovery.excludedCount).toBe(0);
    expect(discovery.skippedCount).toBe(0);
    expect(discovery.emptyCount).toBe(0);
    expect(discovery.ok).toBe(true);
  });

  it("verifies Gate 4 orchestrator builds vitest execution args with vitest.gate4.config.ts", () => {
    const suite = "tests/integration/gate4/identity-and-tenant.integration.test.ts";
    const args = buildGate4VitestArgs(suite);
    expect(args).toContain("--config");
    expect(args).toContain("vitest.gate4.config.ts");
    expect(args).toContain(suite);
  });

  it("classifies no-test-files exit output as GATE4_TEST_DISCOVERY_FAILURE", () => {
    const output = "No test files found, exiting with code 1\nfilter:\ntests/integration/gate4/identity-and-tenant.integration.test.ts";
    expect(classifyGate4Failure(1, output)).toBe("GATE4_TEST_DISCOVERY_FAILURE");
    expect(classifyGate4Failure(0, output)).toBe("PASSED");
    expect(classifyGate4Failure(1, "SAFETY_VIOLATION")).toBe("DATABASE_SAFETY_REJECTION");
    expect(classifyGate4Failure(1, "Test timed out in 30000ms")).toBe("TEST_TIMEOUT");
    expect(classifyGate4Failure(1, "AssertionError: expected false to be true")).toBe("TEST_ASSERTION_FAILURE");
  });
});

