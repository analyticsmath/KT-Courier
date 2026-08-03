import { describe, expect, it } from "vitest";
import { refundRouteSource } from "./refund-api-source";

describe("admin refund review API", () => {
  const source = refundRouteSource("admin", "refunds", "[id]", "review");
  it("requires refunds.review and the shared mutation controls", () => { expect(source).toMatch(/PERMISSIONS\.REFUNDS_REVIEW/); expect(source).toMatch(/prepareAdminRefundMutation/); expect(source).toMatch(/RefundFinanceActionSchema\.safeParse/); });
  it("passes only actor, route reference, operation ID and bounded note into the service", () => { expect(source).toMatch(/beginRefundReview\(\{ actorUserId: auth\.user\.id, publicReference: prepared\.publicReference, operationId:/); expect(source).not.toMatch(/accountId|providerStatus/); });
});
