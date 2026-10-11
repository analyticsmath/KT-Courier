import { afterEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ create: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { create: calls.create }, store: { findUnique: calls.findUnique } } }));
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { createDisposableStoreSettlement } from "@/scripts/e2e-store-settlement-fixture";
import { createDisposableOwnerWithdrawalSource, createDisposableDriverWithdrawalSource } from "@/scripts/e2e-owner-withdrawal-fixture";
const isolated = { NODE_ENV: "test", KT_RUNTIME_ENV: "e2e", KT_NETWORK_DISABLED: "true", KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1", KT_STORE_EARNING_INTEGRATION_APPROVED: "true", KT_SMOKE_PROJECT_NAME: "kt-couriers-store-earning-1791390000000-100", POSTGRES_DB: "kt_store_earning_100_1791390000000", DATABASE_URL: "postgresql://kt_store_earning_100_1791390000000:disposable@localhost/kt_store_earning_100_1791390000000" };
function env(values: Record<string, string>) { for (const [key, value] of Object.entries({ ...isolated, ...values })) vi.stubEnv(key, value); }
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("store financial fixture isolation", () => {
  it.each([
    isolated.DATABASE_URL,
    "postgresql://kt_launch_test:disposable@127.0.0.1/kt_launch_test",
    "postgresql://kt_phase75_e2e:disposable@db/kt_phase75_e2e",
  ])("admits an explicitly isolated supported runner", url => { env({ DATABASE_URL: url }); expect(() => requireDisposableStoreSettlementDatabase()).not.toThrow(); });
  it.each([
    ["NODE_ENV", "production"], ["KT_RUNTIME_ENV", "production"], ["KT_NETWORK_DISABLED", "false"],
    ["KT_ALLOW_ISOLATED_POSTGRES_TESTS", "0"], ["KT_STORE_EARNING_INTEGRATION_APPROVED", "false"],
    ["KT_SMOKE_PROJECT_NAME", "kt-couriers"], ["POSTGRES_DB", "production"],
    ["DATABASE_URL", "PRIVATE_DATABASE_DETAIL"],
    ["DATABASE_URL", "postgresql://kt_store_earning_100_1791390000000:disposable@production.example/kt_store_earning_100_1791390000000"],
    ["DATABASE_URL", "postgresql://wrong:disposable@localhost/kt_store_earning_100_1791390000000"],
    ["DATABASE_URL", "https://kt_store_earning_100_1791390000000:disposable@localhost/kt_store_earning_100_1791390000000"],
  ])("refuses unsafe %s with static diagnostics", (key, value) => {
    env({ [key]: value }); expect(() => requireDisposableStoreSettlementDatabase()).toThrow("Named network-isolated disposable store settlement database required.");
  });
  it("refuses fixture creation before any owner lookup or write", async () => {
    env({ NODE_ENV: "production" }); await expect(createDisposableStoreSettlement({ storeId: "existing-owner" })).rejects.toThrow("Named network-isolated");
    await expect(createDisposableOwnerWithdrawalSource({ storeId: "existing-owner" })).rejects.toThrow("Named network-isolated");
    await expect(createDisposableDriverWithdrawalSource({ email: "synthetic@example.test", passwordHash: "unused" })).rejects.toThrow("Named network-isolated");
    expect(calls.findUnique).not.toHaveBeenCalled(); expect(calls.create).not.toHaveBeenCalled();
  });
});
