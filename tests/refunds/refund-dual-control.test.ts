import { describe, expect, it } from "vitest";
import { assertRefundApprovalControl, assertRefundCompletionControl } from "@/lib/refunds/refund-dual-control";

describe("refund maker-checker", () => {
  it("prevents the customer from approving", () => expect(() => assertRefundApprovalControl({ customerUserId: "same", approverUserId: "same" })).toThrow(/cannot approve/i));
  it("requires a distinct approver and processor", () => expect(() => assertRefundCompletionControl({ customerUserId: "customer", approvedByUserId: "admin", completedByUserId: "admin" })).toThrow(/separate/i));
  it("permits three separate actors", () => expect(() => assertRefundCompletionControl({ customerUserId: "customer", approvedByUserId: "approver", completedByUserId: "processor" })).not.toThrow());
});
