import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateRoute } from "@/lib/maps/routes.service";

const isolated = { NODE_ENV: "production", KT_RUNTIME_ENV: "e2e", KT_NETWORK_DISABLED: "true", KT_LOCAL_CHECKOUT_VALIDATION: "true", DATABASE_URL: "postgresql://fixture:disposable@db:5432/kt_phase75_e2e", E2E_ROUTE_PROVIDER: "deterministic", KT_LOCAL_FULL_FLOW: "false" };
function configure(changes: Record<string, string> = {}) {
  for (const [key, value] of Object.entries({ ...isolated, ...changes })) vi.stubEnv(key, value);
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("compiled disposable browser route isolation", () => {
  it("allows the explicit named browser database without contacting a provider", async () => {
    configure(); const fetch = vi.spyOn(globalThis, "fetch");
    expect(await calculateRoute(-26.2041, 28.0473, -26.2041, 28.0473)).toMatchObject({ ok: true, route: { provider: "e2e_deterministic", distanceMeters: 5000 } });
    expect(fetch).not.toHaveBeenCalled();
  });
  const rejectedIdentities: Record<string, string>[] = [
    { KT_RUNTIME_ENV: "production" }, { KT_RUNTIME_ENV: "" },
    { KT_NETWORK_DISABLED: "false" }, { KT_LOCAL_CHECKOUT_VALIDATION: "false" },
    { DATABASE_URL: "postgresql://fixture:disposable@remote.example/kt_phase75_e2e" },
    { DATABASE_URL: "postgresql://fixture:disposable@db/production" },
    { DATABASE_URL: "postgresql://fixture:disposable@db/other_test" },
    { DATABASE_URL: "invalid" }, { DATABASE_URL: "" },
  ];
  it.each(rejectedIdentities)("rejects an incomplete or production identity: %j", async (changes) => {
    configure(changes); const fetch = vi.spyOn(globalThis, "fetch");
    expect(await calculateRoute(-26.2041, 28.0473, -26.2, 28.04)).toMatchObject({ ok: false, error: { code: "MAPS_MOCK_REJECTED_IN_PRODUCTION" } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects nonfinite coordinates even in the isolated runtime", async () => {
    configure(); expect(await calculateRoute(NaN, 28.0473, -26.2, 28.04)).toMatchObject({ ok: false, error: { code: "PARSE_ERROR" } });
  });
});
