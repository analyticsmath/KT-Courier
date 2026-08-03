import { describe, expect, it } from "vitest";
import { refundRouteSource } from "./refund-api-source";

describe("customer wallet API", () => {
  const source = refundRouteSource("customer-wallet");
  it("requires an active authenticated customer", () => { expect(source).toMatch(/getCurrentUser/); expect(source).toMatch(/role !== "CUSTOMER"/); expect(source).toMatch(/status !== "ACTIVE"/); });
  it("returns only the safe wallet summary with no-store policy", () => { expect(source).toMatch(/refundNoStoreJson/); expect(source).toMatch(/getCustomerWalletSummary\(user\.id\)/); expect(source).not.toMatch(/ledgerAccountId|walletId|currentBalance/); });
});
