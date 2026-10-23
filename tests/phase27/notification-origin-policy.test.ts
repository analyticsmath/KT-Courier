import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), permission: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: mocks.permission }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: mocks.rate }));
import { requireNotificationUser } from "@/lib/notifications/api-policy";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  for (const key of ["NEXT_PUBLIC_APP_URL", "APP_URL", "VERCEL_URL", "CORS_ALLOW_ORIGIN", "ALLOWED_ORIGINS", "TRUSTED_PROXY_ORIGINS"]) vi.stubEnv(key, "");
  vi.stubEnv("APP_URL", "https://www.ktcouriers.com");
  mocks.user.mockResolvedValue({ id: "customer", role: "CUSTOMER" });
  mocks.permission.mockResolvedValue(true);
  mocks.rate.mockResolvedValue({ ok: true });
});
afterEach(() => vi.unstubAllEnvs());
const request = (origin?: string) => new Request("http://upstream.internal/api/notifications/item/read", { method: "POST", headers: { host: "upstream.internal", ...(origin ? { origin } : {}) } });

it("accepts the configured public origin behind a different upstream Host", async () => {
  expect(await requireNotificationUser(request("https://www.ktcouriers.com"), true)).toHaveProperty("user.id", "customer");
});
it.each([undefined, "https://attacker.invalid", "null", "http://www.ktcouriers.com", "https://www.ktcouriers.com.attacker.invalid"])("rejects missing or untrusted origin %s", async origin => {
  const result = await requireNotificationUser(request(origin), true);
  expect("response" in result && result.response?.status).toBe(403);
});
it("retains explicit permission denial for a trusted origin", async () => {
  mocks.permission.mockResolvedValue(false);
  const result = await requireNotificationUser(request("https://www.ktcouriers.com"), true);
  expect("response" in result && result.response?.status).toBe(403);
});
