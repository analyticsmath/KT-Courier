import { describe, expect, it } from "vitest";
import { assertRefundApprovalControl } from "@/lib/refunds/refund-dual-control";

describe("refund database invariants", () => {
  it("enforces dual-control maker-checker rules on admin approval", () => {
    expect(() => assertRefundApprovalControl({ customerUserId: "user1", approverUserId: "user1" })).toThrow();
    expect(() => assertRefundApprovalControl({ customerUserId: "user1", approverUserId: "admin1" })).not.toThrow();
  });
});
