import { describe, expect, it } from "vitest";
import { refundRouteSource } from "./refund-api-source";

describe("admin wallet refund completion API", () => {
  const source = refundRouteSource("admin", "refunds", "[id]", "complete-wallet");
  it("requires refunds.process and operation ID mutation controls", () => { expect(source).toMatch(/PERMISSIONS\.REFUNDS_PROCESS/); expect(source).toMatch(/prepareAdminRefundMutation/); expect(source).toMatch(/RefundActionSchema\.safeParse/); });
  it("accepts no wallet, account, amount or provider-status authority", () => expect(source).not.toMatch(/walletId|accountId|providerStatus|RefundFinanceActionSchema/));
});
