import { describe, expect, it, vi } from "vitest";
import { isVercelProxyRuntime } from "@/lib/config/runtime-surface";
import { register } from "@/instrumentation";

const mocks = vi.hoisted(() => ({
  assertConfiguration: vi.fn(),
  log: vi.fn(),
}));
vi.mock("@/lib/config/production-validation", () => ({
  assertProductionConfiguration: mocks.assertConfiguration,
}));
vi.mock("@/lib/observability/logger", () => ({
  logApplicationEvent: mocks.log,
}));

const vercel = { VERCEL: "1", VERCEL_ENV: "production" };

describe("Vercel proxy runtime classification", () => {
  it("recognizes production and preview proxy deployments without a database", () => {
    expect(isVercelProxyRuntime(vercel)).toBe(true);
    expect(isVercelProxyRuntime({ ...vercel, VERCEL_ENV: "preview", DATABASE_URL: "  " })).toBe(true);
  });

  it("retains database validation for stateful deployments", () => {
    expect(isVercelProxyRuntime({ ...vercel, DATABASE_URL: "postgresql://db/service" })).toBe(false);
    expect(isVercelProxyRuntime({ ...vercel, DATABASE_URL: "invalid" })).toBe(false);
  });

  it("cannot classify Railway as a proxy even with Vercel flags", () => {
    expect(isVercelProxyRuntime({ ...vercel, RAILWAY_SERVICE_ID: "web" })).toBe(false);
    expect(isVercelProxyRuntime({ ...vercel, RAILWAY_ENVIRONMENT_ID: "production" })).toBe(false);
  });

  it("rejects absent, noncanonical, local and unknown platform flags", () => {
    for (const env of [
      {},
      { VERCEL: "true", VERCEL_ENV: "production" },
      { VERCEL: "1" },
      { VERCEL: "1", VERCEL_ENV: "development" },
      { VERCEL: "1", VERCEL_ENV: "unknown" },
    ]) expect(isVercelProxyRuntime(env)).toBe(false);
  });
});

function runtime(env: Record<string, string | undefined>) {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", env.VERCEL);
  vi.stubEnv("VERCEL_ENV", env.VERCEL_ENV);
  vi.stubEnv("DATABASE_URL", env.DATABASE_URL);
  vi.stubEnv("RAILWAY_SERVICE_ID", env.RAILWAY_SERVICE_ID);
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", env.RAILWAY_ENVIRONMENT_ID);
}

describe("instrumentation authority by runtime", () => {
  it("allows the Vercel forwarding middleware to start without Railway secrets", async () => {
    runtime(vercel);
    await register();
    expect(mocks.assertConfiguration).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("still validates and registers the Railway application runtime", async () => {
    runtime({ RAILWAY_SERVICE_ID: "web", RAILWAY_ENVIRONMENT_ID: "production" });
    await register();
    expect(mocks.assertConfiguration).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({
      event: "application.instrumentation_registered",
      outcome: "SUCCESS",
    }));
  });

  it("rejects an invalid stateful runtime even if Vercel flags were copied", async () => {
    runtime({ ...vercel, RAILWAY_SERVICE_ID: "web" });
    mocks.assertConfiguration.mockImplementationOnce(() => { throw new Error("Configuration rejected"); });
    await expect(register()).rejects.toThrow("Configuration rejected");
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("does not load Node instrumentation in an Edge runtime", async () => {
    runtime(vercel);
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    expect(mocks.assertConfiguration).not.toHaveBeenCalled();
  });
});
