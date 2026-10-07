import { afterEach, describe, expect, it, vi } from "vitest";
import { requireDisposableDriverSettlementDatabase } from "@/scripts/disposable-driver-settlement-guard";

afterEach(() => vi.unstubAllEnvs());
function isolated(url: string) {
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("KT_RUNTIME_ENV", "e2e");
  vi.stubEnv("KT_NETWORK_DISABLED", "true");
  vi.stubEnv("KT_ALLOW_ISOLATED_POSTGRES_TESTS", "1");
  vi.stubEnv("KT_DRIVER_EARNING_INTEGRATION_APPROVED", "true");
  vi.stubEnv("POSTGRES_DB", "kt_driver_earning_123_456");
  vi.stubEnv("KT_SMOKE_PROJECT_NAME", "kt-couriers-driver-earning-456-123");
}
describe("synthetic driver settlement database boundary", () => {
  it.each([
    "postgresql://disposable:local@127.0.0.1:5432/kt_launch_test",
    "postgresql://disposable:local@db:5432/kt_phase75_e2e",
    "postgresql://kt_driver_earning_123_456:local@localhost:5432/kt_driver_earning_123_456",
  ])("accepts an explicitly isolated runner: %s", (url) => {
    isolated(url); expect(requireDisposableDriverSettlementDatabase).not.toThrow();
  });
  it.each([
    ["DATABASE_URL", "postgresql://disposable:local@production.example/kt_launch_test"],
    ["DATABASE_URL", "postgresql://disposable:local@localhost/production"],
    ["DATABASE_URL", "postgresql://wrong:local@localhost/kt_driver_earning_123_456"],
    ["NODE_ENV", "production"], ["KT_RUNTIME_ENV", "production"],
    ["KT_NETWORK_DISABLED", "false"], ["KT_ALLOW_ISOLATED_POSTGRES_TESTS", "0"],
    ["KT_DRIVER_EARNING_INTEGRATION_APPROVED", "false"],
    ["POSTGRES_DB", "another_database"], ["KT_SMOKE_PROJECT_NAME", "kt-couriers"],
  ])("rejects an unsafe or mismatched runner: %s", (name, value) => {
    isolated("postgresql://kt_driver_earning_123_456:local@localhost/kt_driver_earning_123_456");
    vi.stubEnv(name, value);
    expect(requireDisposableDriverSettlementDatabase).toThrow("Named network-isolated disposable driver settlement database required.");
  });
});
