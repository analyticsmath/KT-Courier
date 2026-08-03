import { describe, expect, it } from "vitest";
import { refundRouteSource } from "./refund-api-source";

describe("customer wallet transactions API", () => {
  const source = refundRouteSource("customer-wallet", "transactions");
  it("authenticates and scopes transactions to the current customer", () => { expect(source).toMatch(/getCurrentUser/); expect(source).toMatch(/listCustomerWalletTransactions\(user\.id/); });
  it("strictly validates bounded filters", () => { expect(source).toMatch(/WalletTransactionListQuerySchema\.safeParse/); expect(source).toMatch(/422/); });
  it("does not accept any account identifier", () => expect(source).not.toMatch(/accountId|walletId/));
});
