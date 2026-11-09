import { describe, expect, it } from "vitest";
import { normalizeAdminReviewFilters } from "@/lib/client-platform/driver-reviews.service";

describe("driver review investigation filters", () => {
  it("accepts only bounded, valid search constraints", () => {
    expect(normalizeAdminReviewFilters({
      rating: 3, page: 8, orderNumber: "  KT-1234  ",
      driverId: "cm12abcd3456", customerId: "cm12abcd3456",
      from: "2026-10-29", to: "2026-11-08",
    })).toEqual({
      rating: 3, page: 8, orderNumber: "KT-1234",
      driverId: "cm12abcd3456", customerId: "cm12abcd3456",
      from: "2026-10-29", to: "2026-11-08",
    });
  });
  it("discards tampered identifiers, impossible days and unbounded pagination", () => {
    expect(normalizeAdminReviewFilters({
      rating: 6, page: 2_147_483_647, orderNumber: "x".repeat(900),
      driverId: "anything' OR 1=1 --", customerId: "not-a-user",
      from: "2026-02-30", to: "9999-99-99",
    })).toEqual({ page: 1 });
  });
  it("never mistakes an empty rating or zero page for a real filter", () => {
    expect(normalizeAdminReviewFilters({ rating: 0, page: 0, orderNumber: " " }))
      .toEqual({ page: 1 });
  });
});
