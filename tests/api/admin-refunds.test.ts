import { describe, expect, it } from "vitest";
import { refundRouteSource, expectNoDeleteRoute } from "./refund-api-source";

describe("admin refunds API", () => {
  const source = refundRouteSource("admin", "refunds");
  it("requires the exact refunds.read permission via explicit-DENY-aware policy", () => { expect(source).toMatch(/requireRefundAdminPermission\(PERMISSIONS\.REFUNDS_READ/); });
  it("strictly validates list filters", () => expect(source).toMatch(/AdminRefundListQuerySchema\.safeParse/));
  it("has no DELETE endpoint", () => expect(expectNoDeleteRoute("admin", "refunds")).toBe(true));
});
