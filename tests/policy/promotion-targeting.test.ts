import { describe, expect, it } from "vitest";
import { evaluateTargeting } from "@/lib/promotions/promotion-targeting-policy";

const baseLine = {
  storeId: "S1",
  categoryId: "C1",
  productId: "P1",
  variantId: "V1",
  deliveryServiceType: "STANDARD",
  deliveryRegion: "JHB",
};

describe("Promotion Targeting", () => {
  it("returns true for ALL_ELIGIBLE_MARKETPLACE_LINES", () => {
    expect(
      evaluateTargeting(
        [
          {
            type: "ALL_ELIGIBLE_MARKETPLACE_LINES",
            mode: "INCLUDE",
            targetReference: "*",
          },
        ],
        baseLine,
      ),
    ).toBe(true);
  });

  it("returns true for INCLUDE STORE match", () => {
    expect(
      evaluateTargeting(
        [{ type: "STORE", mode: "INCLUDE", targetReference: "S1" }],
        baseLine,
      ),
    ).toBe(true);
  });

  it("returns false for INCLUDE STORE no match", () => {
    expect(
      evaluateTargeting(
        [{ type: "STORE", mode: "INCLUDE", targetReference: "S2" }],
        baseLine,
      ),
    ).toBe(false);
  });

  it("returns false for EXCLUDE STORE match", () => {
    expect(
      evaluateTargeting(
        [{ type: "STORE", mode: "EXCLUDE", targetReference: "S1" }],
        baseLine,
      ),
    ).toBe(false);
  });

  it("returns false when INCLUDE CATEGORY matches but EXCLUDE STORE also matches", () => {
    expect(
      evaluateTargeting(
        [
          { type: "CATEGORY", mode: "INCLUDE", targetReference: "C1" },
          { type: "STORE", mode: "EXCLUDE", targetReference: "S1" },
        ],
        baseLine,
      ),
    ).toBe(false);
  });

  it("returns true when no targets defined", () => {
    expect(evaluateTargeting([], baseLine)).toBe(true);
  });
});

describe("combined promotion scopes", () => {
  it("requires the selected product within the selected business", () => {
    const targets = [
      {
        type: "STORE" as const,
        mode: "INCLUDE" as const,
        targetReference: "S1",
      },
      {
        type: "PRODUCT" as const,
        mode: "INCLUDE" as const,
        targetReference: "P1",
      },
    ];
    expect(evaluateTargeting(targets, baseLine)).toBe(true);
    expect(evaluateTargeting(targets, { ...baseLine, productId: "P2" })).toBe(
      false,
    );
    expect(evaluateTargeting(targets, { ...baseLine, storeId: "S2" })).toBe(
      false,
    );
  });
  it("respects exclusions even for all eligible lines", () => {
    expect(
      evaluateTargeting(
        [
          {
            type: "ALL_ELIGIBLE_MARKETPLACE_LINES",
            mode: "INCLUDE",
            targetReference: "*",
          },
          { type: "PRODUCT", mode: "EXCLUDE", targetReference: "P1" },
        ],
        baseLine,
      ),
    ).toBe(false);
  });
  it("requires both the delivery service and the region when scoped", () => {
    expect(
      evaluateTargeting(
        [
          {
            type: "DELIVERY_SERVICE_TYPE",
            mode: "INCLUDE",
            targetReference: "STANDARD",
          },
          { type: "DELIVERY_REGION", mode: "INCLUDE", targetReference: "PTA" },
        ],
        baseLine,
      ),
    ).toBe(false);
  });
});
