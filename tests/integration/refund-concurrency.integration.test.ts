import { describe, expect, it } from "vitest";
import { refundCreationHash } from "@/lib/refunds/refund-idempotency";

describe("refund concurrency integration", () => {
  it("generates deterministic idempotency hashes for concurrent requests", () => {
    const hash1 = refundCreationHash({ amount: "50.00", customerNote: null, customerUserId: "u1", method: "CUSTOMER_WALLET", paymentId: "pay_1", policyVersion: 1, reasonCode: "CUSTOMER_SERVICE_RESOLUTION" });
    const hash2 = refundCreationHash({ amount: "50.00", customerNote: null, customerUserId: "u1", method: "CUSTOMER_WALLET", paymentId: "pay_1", policyVersion: 1, reasonCode: "CUSTOMER_SERVICE_RESOLUTION" });
    expect(hash1).toBe(hash2);
  });
});
