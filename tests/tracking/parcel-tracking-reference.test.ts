import { describe, expect, it } from "vitest";
import { normalizeParcelTrackingReference } from "@/lib/tracking/parcel-tracking-reference";
describe("short public parcel tracking reference", () => {
  it("normalizes the owner-entered ordinary and collision-fallback references", () => {
    expect(normalizeParcelTrackingReference(" kt-2026-001234 ")).toBe("KT-2026-001234");
    expect(normalizeParcelTrackingReference("kt-2026-9a4bcde2")).toBe("KT-2026-9A4BCDE2");
  });
  it("rejects guessed primary keys, long free-text, path traversal and malformed references", () => {
    for (const value of ["", "KT-2026-123", "KT-2026-123456789", "../../../admin", "order_abc", "KT-2026-12/456", "KT-2026-100 100"]) {
      expect(normalizeParcelTrackingReference(value)).toBeNull();
    }
  });
});
