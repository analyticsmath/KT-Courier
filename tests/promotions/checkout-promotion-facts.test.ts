import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { projectCheckoutPromotionFacts, type CheckoutPromotionSnapshot } from "@/lib/promotions/checkout-promotion-facts";

const money = (s: string) => new Prisma.Decimal(s);
const snap: CheckoutPromotionSnapshot = {
  id: "checkout-100", reviewVersion: 2, customerUserId: "customer-9",
  guestAccessTokenHash: null,
  storeGroups: [{
    storeId: "store-1", deliveryFee: money("89.00"),
    deliveryQuoteReference: "quote-source-1", lines: [
      { id: "old-review", reviewVersion: 1, quantity: 1,
        baseUnitPrice: money("999.00"), modifierUnitTotal: money("0.00"),
        lineTotal: money("999.00"), productReference: "product-old", variantReference: "variant-old" },
      { id: "current-review", reviewVersion: 2, quantity: 3,
        baseUnitPrice: money("30.00"), modifierUnitTotal: money("2.50"),
        lineTotal: money("97.50"), productReference: "product-new", variantReference: "variant-new" },
    ],
  }],
};

describe("source-bound marketplace promotion checkout facts", () => {
  it("prices all quantities and excludes stale review versions", () => {
    const projected = projectCheckoutPromotionFacts(snap, new Date("2026-11-09T00:00:00Z"));
    expect(projected.checkoutId).toBe("checkout-100");
    expect(projected.customerUserId).toBe("customer-9");
    expect(projected.storeGroups).toHaveLength(1);
    expect(projected.storeGroups[0].lines).toHaveLength(1);
    expect(projected.storeGroups[0].lines[0].lineReference).toBe("current-review");
    expect(projected.storeGroups[0].lines[0].merchandiseSubtotal.toFixed(2)).toBe("90.00");
    expect(projected.storeGroups[0].lines[0].modifierSubtotal.toFixed(2)).toBe("7.50");
  });

  it("does not invent Johannesburg/Standard or a product category for targeted campaigns", () => {
    const projected = projectCheckoutPromotionFacts(snap, new Date());
    expect(projected.storeGroups[0].lines[0].categoryId).toBe("");
    expect(projected.deliveryQuotes).toEqual([{
      storeReference: "store-1", feeAmount: money("89.00"),
      deliveryServiceType: "", deliveryRegion: "",
    }]);
  });

  it("never creates a delivery promotion basis without a stored source quote reference", () => {
    const a = { ...snap, storeGroups: snap.storeGroups.map(g => ({ ...g, deliveryQuoteReference: null })) };
    expect(projectCheckoutPromotionFacts(a, new Date()).deliveryQuotes).toHaveLength(0);
  });

  it("rejects mismatched frozen line totals rather than discounting an invented amount", () => {
    const a = { ...snap, storeGroups: snap.storeGroups.map(g => ({
      ...g, lines: g.lines.map(l => l.reviewVersion === 2 ? { ...l, lineTotal: money("92.00") } : l),
    })) };
    expect(() => projectCheckoutPromotionFacts(a, new Date())).toThrow(/does not reconcile/);
  });

  it("rejects stale-only and impossible quantities", () => {
    const stale = { ...snap, storeGroups: snap.storeGroups.map(g => ({
      ...g, lines: g.lines.filter(l => l.reviewVersion === 1),
    })) };
    expect(() => projectCheckoutPromotionFacts(stale, new Date())).toThrow(/current review lines/);
    const zero = { ...snap, storeGroups: snap.storeGroups.map(g => ({
      ...g, lines: g.lines.map(l => l.reviewVersion === 2 ? { ...l, quantity: 0 } : l),
    })) };
    expect(() => projectCheckoutPromotionFacts(zero, new Date())).toThrow(/source-bound/);
  });

  it("permits legitimate negative-price option modifiers only when frozen totals reconcile", () => {
    const a = { ...snap, storeGroups: snap.storeGroups.map(g => ({
      ...g, lines: g.lines.map(l => l.reviewVersion === 2 ? {
        ...l, modifierUnitTotal: money("-2.00"), lineTotal: money("84.00"),
      } : l),
    })) };
    const r = projectCheckoutPromotionFacts(a, new Date());
    expect(r.storeGroups[0].lines[0].modifierSubtotal.toFixed(2)).toBe("-6.00");
  });

  it("retains scoped guest ownership without inventing an authenticated first-order claim", () => {
    const a = { ...snap, customerUserId: null, guestAccessTokenHash: "guest-hmac" };
    const r = projectCheckoutPromotionFacts(a, new Date());
    expect(r.customerUserId).toBeUndefined();
    expect(r.guestEvidenceReference).toBe("guest-hmac");
  });
});
