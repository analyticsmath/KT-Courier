import { describe, expect, it } from "vitest";
import { normalizeLedgerPosting } from "@/lib/ledger/posting-normalization";
import { buildPayfastReceiptPosting } from "@/lib/payments/providers/payfast/payfast-ledger-posting-policy";
describe("Payfast receipt ledger policy", () => {
  const posting = buildPayfastReceiptPosting({ paymentPublicReference: "pay_ref", attemptPublicReference: "pat_ref", eventPublicReference: "pwe_ref", providerPaymentId: "123", amount: "123.45", cashClearingAccountId: "cash", customerFundsHeldAccountId: "held" });
  it("debits cash clearing and credits held liability for exact gross ZAR", () => expect(posting).toMatchObject({ type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", idempotencyKey: "payfast:payment:pay_ref:complete:v1", sourceReference: "payfast:payment:pay_ref:complete", entries: [{ accountId: "cash", direction: "DEBIT", amount: "123.45" }, { accountId: "held", direction: "CREDIT", amount: "123.45" }] }));
  it("posts no fee or revenue entry and keeps metadata safe", () => { expect(posting.entries).toHaveLength(2); expect(JSON.stringify(posting)).not.toMatch(/email|signature|merchantId|passphrase|revenue/i); });
  it("is accepted by the shared ledger normalization and balancing policy", () => expect(normalizeLedgerPosting(posting)).toMatchObject({ type: "EXTERNAL_PAYMENT_RECEIPT", totalDebits: expect.anything(), totalCredits: expect.anything() }));
});
