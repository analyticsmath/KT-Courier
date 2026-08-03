import { describe, expect, it } from "vitest";
import { refundRouteSource } from "./refund-api-source";

describe("customer refund cancellation API", () => {
  const source = refundRouteSource("refunds", "[publicReference]", "cancel");
  it("requires origin, customer auth, rate limit, strict JSON and operation ID", () => { for (const token of ["enforceSameOriginRequest", "getCurrentUser", "checkIpRateLimit", "validateRefundJsonRequest", "RefundActionSchema.safeParse", "operationId"]) expect(source).toContain(token); });
  it("binds cancellation to the authenticated actor and route reference", () => { expect(source).toMatch(/actorUserId:\s*user\.id/); expect(source).toMatch(/parameter\.data\.publicReference/); });
});
