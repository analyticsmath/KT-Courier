import { describe, expect, it } from "vitest";
import { refundRouteSource } from "./refund-api-source";

describe("admin provider refund execution API", () => {
  const start = refundRouteSource("admin", "refunds", "[id]", "start-provider-refund");
  const query = refundRouteSource("admin", "refunds", "[id]", "query-provider-status");
  it("requires process for creation and provider-status permission for queries", () => { expect(start).toMatch(/PERMISSIONS\.REFUNDS_PROCESS/); expect(query).toMatch(/PERMISSIONS\.REFUND_PROVIDER_STATUS_READ/); });
  it("uses shared origin, rate, strict JSON and operation ID controls", () => { for (const source of [start, query]) { expect(source).toMatch(/prepareAdminRefundMutation/); expect(source).toMatch(/RefundActionSchema\.safeParse/); } });
  it("accepts no provider status, provider ID, amount, bank, or success authority", () => expect(`${start}\n${query}`).not.toMatch(/body.*providerStatus|body.*providerRefundId|body.*amount|bank|branch|mark.?success/i));
});
