import { describe, expect, it } from "vitest";
import { customerRefundWalletDisplayState } from "@/lib/services/customer-wallet-presentation";
describe("customer refund wallet clarity", () => {
  it("shows a valid empty state when a new customer has no refund wallet yet", () => {
    expect(customerRefundWalletDisplayState({ provisioned: false, readable: false })).toBe("EMPTY");
  });
  it("does not conceal a broken provisioned wallet", () => {
    expect(customerRefundWalletDisplayState({ provisioned: true, readable: false })).toBe("UNAVAILABLE");
  });
  it("shows refund credits when provisioned and readable", () => {
    expect(customerRefundWalletDisplayState({ provisioned: true, readable: true })).toBe("AVAILABLE");
  });
});
