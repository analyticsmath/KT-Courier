import { describe, expect, it } from "vitest";
import { refundRouteSource, expectNoDeleteRoute } from "./refund-api-source";

describe("admin refund detail API", () => {
  const source = refundRouteSource("admin", "refunds", "[id]");
  it("requires refunds.read and validates awaited params", () => { expect(source).toMatch(/PERMISSIONS\.REFUNDS_READ/); expect(source).toMatch(/safeParse\(await params\)/); });
  it("has no arbitrary state or DELETE handler", () => { expect(source).not.toMatch(/newStatus|targetStatus|markSuccess/); expect(expectNoDeleteRoute("admin", "refunds", "[id]")).toBe(true); });
});
