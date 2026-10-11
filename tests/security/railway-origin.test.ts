import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { railwayProductionOrigin } from "@/lib/config/railway-origin";
import { proxy } from "@/proxy";

describe("configured production edge origin", () => {
  beforeEach(() => {
    // Model the stateless edge explicitly; CI also hosts database-backed jobs.
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("RAILWAY_SERVICE_ID", "");
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KT_RUNTIME_ENV", "");
    vi.stubEnv("KT_NETWORK_DISABLED", "");
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each([undefined, "", "http://web.example", "https://user:pass@web.example", "https://web.example/path", "https://web.example?query=1", "https://web.example#fragment", "https://localhost", "https://web..example"])("fails closed for invalid origin %s", (value) => {
    expect(railwayProductionOrigin(value ?? "")).toBeNull();
  });
  it("rewrites production path/query using only server deployment configuration", () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", "https://runtime.example");
    const response = proxy(new NextRequest("https://www.ktcouriers.com/quote?reference=abc"));
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://runtime.example/quote?reference=abc");
  });
  it("returns safe 503 when the edge backend is missing", () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", "");
    expect(proxy(new NextRequest("https://www.ktcouriers.com/quote")).status).toBe(503);
  });
  it("preserves preview homepage while protected routes still fail closed", () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", "");
    expect(proxy(new NextRequest("https://preview.example/")).headers.get("x-middleware-rewrite")).toBeNull();
    expect(proxy(new NextRequest("https://preview.example/admin")).status).toBe(503);
  });
  it.each(["/api/checkout", "/api/payments/paystack/webhook", "/admin", "/quote"])("refuses preview production routing for %s even with a valid inherited origin", (path) => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", "https://runtime.example");
    const response = proxy(new NextRequest(`https://preview.example${path}`));
    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([["NODE_ENV", "test"], ["KT_RUNTIME_ENV", "e2e"], ["KT_NETWORK_DISABLED", "true"]])("refuses production forwarding with test isolation flag %s", (key, value) => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", "https://runtime.example"); vi.stubEnv(key, value);
    const response = proxy(new NextRequest("https://test.example/api/checkout"));
    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it.each(["DATABASE_URL", "RAILWAY_SERVICE_ID", "RAILWAY_ENVIRONMENT_ID"])("refuses preview stateful execution with inherited %s", key => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", "https://runtime.example"); vi.stubEnv(key, "inherited_disposable_test_value");
    const response = proxy(new NextRequest("https://preview.example/api/checkout"));
    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
