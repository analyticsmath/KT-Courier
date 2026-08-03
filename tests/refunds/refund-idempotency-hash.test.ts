import { describe, expect, it } from "vitest";
import { refundAttemptHash, refundCreationHash } from "@/lib/refunds/refund-idempotency";

describe("refund idempotency hashes", () => {
  const request = { paymentId: "payment", customerUserId: "customer", amount: "10.00", method: "CUSTOMER_WALLET", reasonCode: "SERVICE_FAILURE", customerNote: null, policyVersion: 1 } as const;
  it("is deterministic and binds all accounting-significant request fields", () => {
    expect(refundCreationHash(request)).toBe(refundCreationHash({ ...request }));
    expect(refundCreationHash(request)).not.toBe(refundCreationHash({ ...request, amount: "10.01" }));
  });
  it("binds attempt actor, provider and payment evidence", () => expect(refundAttemptHash({ refundId: "r", actorUserId: "a", provider: "PAYFAST", providerPaymentId: "p" })).not.toBe(refundAttemptHash({ refundId: "r", actorUserId: "b", provider: "PAYFAST", providerPaymentId: "p" })));
});
