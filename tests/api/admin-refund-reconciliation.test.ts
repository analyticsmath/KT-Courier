import { describe, expect, it } from "vitest";
import { refundRouteSource, expectNoDeleteRoute } from "./refund-api-source";

describe("admin refund reconciliation API", () => {
  const list = refundRouteSource("admin", "refund-reconciliation");
  const detail = refundRouteSource("admin", "refund-reconciliation", "[id]");
  it("requires refunds.reconcile with explicit-DENY-aware helper", () => { expect(list).toMatch(/PERMISSIONS\.REFUNDS_RECONCILE/); expect(detail).toMatch(/PERMISSIONS\.REFUNDS_RECONCILE/); });
  it("provides read-only validated filters and detail params", () => { expect(list).toMatch(/RefundReconciliationListQuerySchema\.safeParse/); expect(detail).toMatch(/RefundReconciliationParamsSchema\.safeParse\(await params\)/); expect(`${list}\n${detail}`).not.toMatch(/export async function POST|mark.?success/i); });
  it("has no DELETE endpoint", () => { expect(expectNoDeleteRoute("admin", "refund-reconciliation")).toBe(true); expect(expectNoDeleteRoute("admin", "refund-reconciliation", "[id]")).toBe(true); });
});
