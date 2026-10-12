import { describe, expect, it } from "vitest";
import { edgeRewrites, PRODUCTION_EDGE_ORIGIN, PRODUCTION_EDGE_PROJECT, resolveEdgeOrigin } from "@/lib/deployment/edge-routing";

describe("edge deployment environment isolation", () => {
  const production = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_ID: PRODUCTION_EDGE_PROJECT, KT_EDGE_ROLE: "production" };
  it("only the identified production deployment can select the fixed production origin", () => {
    expect(resolveEdgeOrigin(production)).toBe(PRODUCTION_EDGE_ORIGIN);
    expect(edgeRewrites(resolveEdgeOrigin(production)).beforeFiles[0].destination).toBe(`${PRODUCTION_EDGE_ORIGIN}/:path*`);
  });
  it("refuses preview production inheritance, forged origins and unknown/custom environments", () => {
    for (const extra of [
      { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }, { VERCEL_ENV: "custom" },
      { VERCEL_PROJECT_ID: "prj_unknown" }, { VERCEL_PROJECT_ID: undefined }, { VERCEL: undefined },
      { KT_EDGE_ROLE: undefined }, { KT_EDGE_ROLE: "staging" },
    ]) expect(() => resolveEdgeOrigin({ ...production, ...extra, KT_STAGING_ORIGIN: PRODUCTION_EDGE_ORIGIN, HOST: "www.ktcouriers.com" })).toThrow(/EDGE_ISOLATION/);
  });
  it("unregistered staging builds fail even with a plausible staging origin variable", () => {
    expect(() => resolveEdgeOrigin({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_PROJECT_ID: "prj_staging", KT_EDGE_ROLE: "staging", KT_STAGING_ORIGIN: "https://example-staging.up.railway.app" })).toThrow(/approval/);
  });
  it("an independently approved staging project resolves only its source-registered origin", () => {
    const env = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_ID: "prj_staging", KT_EDGE_ROLE: "staging" };
    const entry = { projectId: "prj_staging", origin: "https://synthetic-staging.up.railway.app", approvalRef: "synthetic-test-only" };
    expect(resolveEdgeOrigin(env, [entry])).toBe(entry.origin);
    for (const origin of [PRODUCTION_EDGE_ORIGIN, "https://www.ktcouriers.com", "https://ktcouriers.com", "https://evil.example", "http://synthetic-staging.up.railway.app", `${entry.origin}/path`, `${entry.origin}?x=1`, "https://user:password@synthetic-staging.up.railway.app"]) {
      expect(() => resolveEdgeOrigin(env, [{ ...entry, origin }])).toThrow(/EDGE_ISOLATION/);
    }
  });
  it("self-hosted and offline applications use no external rewrite or fallback", () => {
    expect(resolveEdgeOrigin({ NODE_ENV: "production", KT_RUNTIME_ENV: "e2e" })).toBeNull();
    expect(edgeRewrites(null)).toEqual({ beforeFiles: [], afterFiles: [], fallback: [] });
  });
});
