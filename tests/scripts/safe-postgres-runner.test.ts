import { describe, expect, it } from "vitest";
import { sanitizeDbUrl, validateSafePostgresEnv } from "../../scripts/safe-postgres-runner.mjs";

describe("safe-postgres-runner safety validation", () => {
  it("blocks missing opt-in environment variable", () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/kt_phase2_test",
      NODE_ENV: "test",
    };
    const result = validateSafePostgresEnv(env, "CATALOG");
    expect(result.ok).toBe(false);
    expect(result.status).toBe("CATALOG_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED");
    expect(result.reason).toContain("Explicit test opt-in is required");
  });

  it("blocks NODE_ENV=production even with opt-in", () => {
    const env: NodeJS.ProcessEnv = {
      KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/kt_phase2_test",
      NODE_ENV: "production",
    };
    const result = validateSafePostgresEnv(env, "CATALOG");
    expect(result.ok).toBe(false);
    expect(result.status).toBe("CATALOG_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED");
    expect(result.reason).toContain("strictly blocked when NODE_ENV=production");
  });

  it("blocks remote host database URLs", () => {
    const env: NodeJS.ProcessEnv = {
      KT_CATALOG_INTEGRATION_APPROVED: "1",
      DATABASE_URL: "postgresql://user:pass@db.example.com:5432/kt_phase2_test",
      NODE_ENV: "test",
    };
    const result = validateSafePostgresEnv(env, "CATALOG");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Remote or non-loopback host rejected");
  });

  it("blocks cloud database host URLs (e.g. AWS RDS / GCP CloudSQL / Supabase / Neon)", () => {
    const env: NodeJS.ProcessEnv = {
      KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1",
      DATABASE_URL: "postgresql://user:secret@my-db.rds.amazonaws.com:5432/kt_phase2_test",
      NODE_ENV: "test",
    };
    const result = validateSafePostgresEnv(env, "CATALOG");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("prohibited production or cloud host identifier");
  });

  it("blocks default or non-test database names", () => {
    const env: NodeJS.ProcessEnv = {
      KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/kt_courier_dev",
      NODE_ENV: "test",
    };
    const result = validateSafePostgresEnv(env, "CATALOG");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Default or non-test database name rejected");
  });

  it("blocks database names lacking an explicit test marker", () => {
    const env: NodeJS.ProcessEnv = {
      KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/my_app_db",
      NODE_ENV: "test",
    };
    const result = validateSafePostgresEnv(env, "CATALOG");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("lacks an explicit test marker");
  });

  it("redacts passwords from output and sanitized URLs", () => {
    const raw = "postgresql://myuser:super_secret_password_123@localhost:5432/kt_phase2_disposable_test";
    const sanitized = sanitizeDbUrl(raw);
    expect(sanitized).not.toContain("super_secret_password_123");
    expect(sanitized).toContain("****");
  });

  it("validates safe local test database URL successfully", () => {
    const env: NodeJS.ProcessEnv = {
      KT_CATALOG_INTEGRATION_APPROVED: "1",
      DATABASE_URL: "postgresql://user:secret_pass@localhost:5432/kt_phase2_disposable_test",
      NODE_ENV: "test",
    };
    const result = validateSafePostgresEnv(env, "CATALOG");
    expect(result.ok).toBe(true);
    expect(result.sanitizedUrl).not.toContain("secret_pass");
    expect(result.sanitizedUrl).toContain("****");
  });

  it("never spawns migration, seed, reset or docker CLI commands", async () => {
    const fs = await import("node:fs");
    const runnerSource = fs.readFileSync("scripts/safe-postgres-runner.mjs", "utf-8");
    expect(runnerSource).not.toContain("prisma migrate");
    expect(runnerSource).not.toContain("prisma db seed");
    expect(runnerSource).not.toContain("docker compose");
    expect(runnerSource).not.toContain("runCompose");
  });
});
