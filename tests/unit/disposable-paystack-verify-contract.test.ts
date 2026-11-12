import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import { assertDisposablePaystackAcceptance } from "@/lib/testing/disposable-paystack-policy";

const identity = Object.freeze({
  KT_E2E_PAYSTACK_ACCEPTANCE: "true", KT_RUNTIME_ENV: "e2e", NODE_ENV: "test",
  KT_NETWORK_DISABLED: "true", KT_E2E_NETWORK_INTERNAL: "true", KT_LOCAL_FULL_FLOW: "false",
  PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "sk_test_disposable_browser_no_provider",
  DATABASE_URL: "postgresql://kt_phase75_e2e:synthetic@localhost:5432/kt_phase75_e2e",
  PAYMENT_APP_ORIGIN: "http://localhost:3200",
});

beforeEach(() => {
  for (const [key, value] of Object.entries(identity)) vi.stubEnv(key, value);
  db.$transaction.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("strict Paystack verify contract on the isolated provider", () => {
  it("classifies a missing synthetic reference as proven absent, not a network outage", async () => {
    assertDisposablePaystackAcceptance();
    const read = vi.fn().mockResolvedValue(null);
    const raw = vi.fn().mockResolvedValue([]);
    db.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ systemSetting: { findUnique: read }, $queryRaw: raw }));
    const client = new PaystackClient({ secretKey: identity.PAYSTACK_SECRET_KEY });
    await expect(client.verifyTransaction("synthetic-merchant-ref-1")).rejects.toMatchObject({
      code: "PAYSTACK_TRANSACTION_NOT_FOUND",
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(raw).toHaveBeenCalledTimes(1);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("never permits this synthetic provider outside its exact disposable runtime", async () => {
    vi.stubEnv("KT_RUNTIME_ENV", "production");
    const client = new PaystackClient({ secretKey: identity.PAYSTACK_SECRET_KEY });
    await expect(client.verifyTransaction("synthetic-merchant-ref-1")).rejects.toThrow(
      "Offline Paystack acceptance requires the named, isolated disposable browser runtime.",
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
