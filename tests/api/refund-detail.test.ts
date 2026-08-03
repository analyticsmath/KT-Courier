import { describe, expect, it } from "vitest";
import { refundRouteSource, expectNoDeleteRoute } from "./refund-api-source";

describe("customer refund detail API", () => {
  const source = refundRouteSource("refunds", "[publicReference]");
  it("uses awaited Next 16 params and owner-scoped lookup", () => { expect(source).toMatch(/await params/); expect(source).toMatch(/getCustomerRefund\(user\.id/); });
  it("returns owner-safe not-found behavior", () => { expect(source).toMatch(/Refund not found/); expect(source).not.toMatch(/fundingAllocations|providerPaymentId|ledger/); });
  it("has no DELETE endpoint", () => expect(expectNoDeleteRoute("refunds", "[publicReference]")).toBe(true));
});
