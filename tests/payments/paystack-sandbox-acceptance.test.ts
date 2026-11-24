import { describe, expect, it } from "vitest";
import {
  PAYSTACK_SANDBOX_ACCEPTANCE_CENTS,
  SANDBOX_PLATFORM_ACCOUNTS,
  buildSandboxAcceptanceReceiptPosting,
  resolveSandboxAcceptanceConfiguration,
} from "@/lib/payments/sandbox-acceptance.service";

describe("isolated Paystack sandbox acceptance lane configuration and ledger policy", () => {
  const validProdEnv = {
    NODE_ENV: "production",
    KT_DATABASE_CLASSIFICATION: "production",
    PAYSTACK_MODE: "live",
    PAYSTACK_SECRET_KEY: "sk_live_prod_secret_key_for_test_only",
    PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "false",
    KT_E2E_PAYSTACK_ACCEPTANCE: "false",
    PAYSTACK_ACCEPTANCE_SANDBOX_ENABLED: "true",
    PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: "sk_test_sandbox_acceptance_only_1234",
    PAYMENT_APP_ORIGIN: "https://ktcouriers.com",
    RAILWAY_GIT_COMMIT_SHA: "691ebded959858e86b4cb28674f52394c1f5676c",
  };

  it("permits isolated Paystack test verification in production without flipping live checkout mode", () => {
    const config = resolveSandboxAcceptanceConfiguration(validProdEnv);
    expect(config.eligible).toBe(true);
    expect(config.releaseSha).toBe("691ebded959858e86b4cb28674f52394c1f5676c");
    expect(config.secretKey).toBe(validProdEnv.PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY);
    expect(PAYSTACK_SANDBOX_ACCEPTANCE_CENTS).toBe(1000);
  });

  it.each([
    { KT_E2E_PAYSTACK_ACCEPTANCE: "true" },
    { PAYSTACK_ACCEPTANCE_SANDBOX_ENABLED: "false" },
    { PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: "sk_live_must_never_be_accepted" },
    { PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: "sk_live_prod_secret_key_for_test_only" },
    { PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "true" },
    { PAYMENT_APP_ORIGIN: "http://ktcouriers.com" },
    { PAYMENT_APP_ORIGIN: "https://evil.example" },
    { RAILWAY_GIT_COMMIT_SHA: undefined, VERCEL_GIT_COMMIT_SHA: undefined },
  ])("refuses unsafe or fixture-tainted sandbox acceptance config: %o", (override) => {
    const config = resolveSandboxAcceptanceConfiguration({ ...validProdEnv, ...override });
    expect(config.eligible).toBe(false);
  });

  it("posts balanced canonical entries solely in isolated platform sandbox namespace", () => {
    const posting = buildSandboxAcceptanceReceiptPosting({
      paymentReference: "pay_sbox_abcdef123456",
      attemptReference: "patsbox_001",
      providerReference: "998877",
      releaseSha: validProdEnv.RAILWAY_GIT_COMMIT_SHA,
      amount: "10.00",
      cashClearingAccountId: "acc_sbox_cash",
      fundsHeldAccountId: "acc_sbox_held",
    });

    expect(SANDBOX_PLATFORM_ACCOUNTS.walletOwnerId).toBe("platform-sandbox-acceptance");
    expect(posting.type).toBe("EXTERNAL_PAYMENT_RECEIPT");
    expect(posting.entries).toHaveLength(2);
    expect(posting.entries[0]).toMatchObject({ accountId: "acc_sbox_cash", direction: "DEBIT", amount: "10.00" });
    expect(posting.entries[1]).toMatchObject({ accountId: "acc_sbox_held", direction: "CREDIT", amount: "10.00" });
    expect(posting.metadata).toMatchObject({ sandboxAcceptance: true, releaseSha: validProdEnv.RAILWAY_GIT_COMMIT_SHA });
  });
});
