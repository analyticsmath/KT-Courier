import { describe, expect, it } from "vitest";
import { OrderStatus } from "@/types/db";
import { establishesCustody } from "@/lib/driver-operations/custody-policy";

describe("custody policy", () => {
  it("establishes custody only at PICKED_UP", () => {
    expect(establishesCustody(OrderStatus.PICKUP_SCHEDULED)).toBe(false);
    expect(establishesCustody(OrderStatus.PICKED_UP)).toBe(true);
  });
});
