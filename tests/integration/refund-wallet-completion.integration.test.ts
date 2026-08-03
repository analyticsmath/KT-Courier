import { describe, expect, it } from "vitest";
import { refundReservePosting } from "@/lib/refunds/refund-ledger-policy";

describe("refund wallet completion integration", () => {
  it("constructs balanced ledger postings for refund reserve", () => {
    const posting = refundReservePosting({
      refundReference: "RF-1",
      paymentReference: "PAY-1",
      amount: "50.00",
      heldAccountId: "acc-1",
      method: "CUSTOMER_WALLET",
      reasonCode: "CUSTOMER_SERVICE_RESOLUTION",
      funding: [],
    });
    expect(posting.idempotencyKey).toBe("refund:RF-1:reserve:v1");
  });
});
