import { describe, expect, it } from "vitest";
import { refundRouteSource } from "./refund-api-source";

describe("admin refund approval API", () => {
  const source = refundRouteSource("admin", "refunds", "[id]", "approve");
  it("requires refunds.approve and shared origin/rate/strict-body controls", () => { expect(source).toMatch(/PERMISSIONS\.REFUNDS_APPROVE/); expect(source).toMatch(/prepareAdminRefundMutation/); expect(source).toMatch(/RefundFinanceActionSchema\.safeParse/); });
  it("does not expose a completion or mark-success shortcut", () => expect(source).not.toMatch(/completeRefund|finalizeProvider|mark.?success/i));
});
