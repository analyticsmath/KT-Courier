import { describe, expect, it } from "vitest";
import { assertCustomerWalletAccount } from "@/lib/refunds/customer-wallet-policy";

const canonical = { ownerType: "CUSTOMER", ownerId: "c1", expectedCustomerUserId: "c1", walletStatus: "ACTIVE", accountPurpose: "CUSTOMER_WALLET_AVAILABLE", accountCategory: "LIABILITY", accountCurrency: "ZAR", accountStatus: "ACTIVE", allowNegative: false };
describe("customer wallet policy", () => {
  it("accepts only the canonical non-negative ZAR liability account", () => expect(() => assertCustomerWalletAccount(canonical)).not.toThrow());
  it.each([{ allowNegative: true }, { accountCategory: "ASSET" }, { accountPurpose: "CUSTOMER_FUNDS_HELD" }, { ownerId: "other" }])("rejects noncanonical account %#", (change) => expect(() => assertCustomerWalletAccount({ ...canonical, ...change })).toThrow(/not canonical/i));
});
