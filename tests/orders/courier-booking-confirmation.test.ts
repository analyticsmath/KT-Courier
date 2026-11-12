import { describe, expect, it } from "vitest";
import { OrderStatus } from "@/types/db";
import { initialCourierBookingStatus } from "@/lib/orders/courier-confirmation-policy";

describe("direct parcel booking initial status and COD authority", () => {
  it("confirms an already-policy-approved full-COD booking without falsely claiming payment", () => {
    expect(initialCourierBookingStatus({ mode: "FULL_COD", digitalRequired: "0.00" })).toBe(OrderStatus.CONFIRMED);
  });

  it("keeps card, split COD and unknown cash options pending for actual funding", () => {
    for (const entry of [
      null,
      { mode: "DIGITAL_ONLY", digitalRequired: "170.00" },
      { mode: "DEPOSIT_PLUS_COD", digitalRequired: "85.00" },
      { mode: "FULL_COD", digitalRequired: "25.00" },
    ]) {
      expect(initialCourierBookingStatus(entry)).toBe(OrderStatus.PENDING);
    }
  });
});
