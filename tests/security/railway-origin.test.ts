import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { railwayProductionOrigin } from "@/lib/config/railway-origin";
import { proxy } from "@/proxy";

describe("configured production edge origin", () => {
  const fakeUpstream = "https://preview-upstream.fixture.invalid";
  beforeEach(() => {
    // Model the stateless edge explicitly; CI also hosts database-backed jobs.
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("RAILWAY_SERVICE_ID", "");
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KT_RUNTIME_ENV", "");
    vi.stubEnv("KT_NETWORK_DISABLED", "");
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it.each([undefined, "", "http://web.example", "https://user:pass@web.example", "https://web.example/path", "https://web.example?query=1", "https://web.example#fragment", "https://localhost", "https://web..example"])("fails closed for invalid origin %s", (value) => {
    expect(railwayProductionOrigin(value ?? "")).toBeNull();
  });
  it("rewrites production path/query using only server deployment configuration", () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", "https://runtime.example");
    const response = proxy(new NextRequest("https://www.ktcouriers.com/quote?reference=abc"));
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://runtime.example/quote?reference=abc");
  });
  it.each([["GET", "/"], ["GET", "/api/orders?cursor=next"], ["POST", "/api/orders"], ["POST", "/api/payments/paystack/webhook"]])("classifies production %s %s as a rewrite without making a provider request", (method, path) => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", fakeUpstream);
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      requests.push(String(input));
      return new Response("fake origin received a request");
    });
    const response = proxy(new NextRequest(`https://www.ktcouriers.com${path}`, { method }));
    expect(response.headers.get("x-middleware-rewrite")).toBe(`${fakeUpstream}${path}`);
    expect(requests).toEqual([]);
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
  it.each([
    ["GET", "/", true],
    ["GET", "/_next/static/chunk.js", true],
    ["GET", "/images/brand.svg", true],
    ["GET", "/media/van.webp", true],
    ["GET", "/admin/orders", false],
    ["GET", "/driver/assignments", false],
    ["POST", "/api/orders", false],
    ["POST", "/api/payments/paystack/webhook", false],
    ["POST", "/store/orders/checkout", false],
  ])("keeps preview %s %s out of the fake upstream", (method, path, publicPreviewAsset) => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", fakeUpstream);
    vi.stubEnv("DATABASE_URL", "postgresql://fixture:fixture@db.invalid/disposable");
    vi.stubEnv("RAILWAY_SERVICE_ID", "inherited-service");
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "inherited-environment");
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      requests.push(String(input));
      return new Response("fake origin received a request");
    });
    const request = new NextRequest(`https://preview.example${path}`, {
      method,
      headers: { cookie: "kt_session=synthetic-preview-session" },
    });
    const response = proxy(request);

    if (publicPreviewAsset) {
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
      if (path === "/") {
        expect(response.headers.get("x-frame-options")).toBe("DENY");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      }
    } else {
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(requests).toEqual([]);
  });
  it("retains the local protected-page login redirect and return target", () => {
    vi.stubEnv("VERCEL", "0"); vi.stubEnv("VERCEL_ENV", "development"); vi.stubEnv("NODE_ENV", "test");
    const response = proxy(new NextRequest("http://localhost:3000/admin/orders?tab=pending"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?returnUrl=%2Fadmin%2Forders%3Ftab%3Dpending");
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
