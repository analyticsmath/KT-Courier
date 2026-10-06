import { describe, expect, it } from "vitest";
import { assertCatalogPublicationEvidence } from "@/lib/catalog/catalog-publication-readiness";

const now = new Date("2026-10-06T08:00:00Z");
const ready = () => ({
  productStatus: "ACTIVE", moderationStatus: "APPROVED", categoryStatus: "ACTIVE",
  productTypeStatus: "ACTIVE", variantStatus: "ACTIVE", offerStatus: "ACTIVE",
  price: { status: "ACTIVE", amount: "40.00", currency: "ZAR", priceIncludesTax: true,
    effectiveFrom: new Date("2026-10-01T00:00:00Z"), effectiveUntil: null as Date | null },
});

describe("live catalogue publication evidence", () => {
  it("accepts an approved active offer with a current price", () => {
    expect(() => assertCatalogPublicationEvidence(ready(), now)).not.toThrow();
  });
  it.each(["productStatus", "moderationStatus", "categoryStatus", "productTypeStatus", "variantStatus", "offerStatus"] as const)(
    "rejects a non-ready %s after release approval", (field) => {
      const input = ready(); input[field] = "DRAFT";
      expect(() => assertCatalogPublicationEvidence(input, now)).toThrow();
    },
  );
  it("rejects a newer draft, a future price and an expired price", () => {
    const input = ready(); input.price.status = "DRAFT";
    expect(() => assertCatalogPublicationEvidence(input, now)).toThrow();
    input.price.status = "ACTIVE"; input.price.effectiveFrom = new Date(now.getTime() + 1);
    expect(() => assertCatalogPublicationEvidence(input, now)).toThrow();
    input.price.effectiveFrom = ready().price.effectiveFrom; input.price.effectiveUntil = now;
    expect(() => assertCatalogPublicationEvidence(input, now)).toThrow();
  });
  it("keeps the zero-price legacy item unpublished", () => {
    const input = ready(); input.price.amount = "0.00";
    expect(() => assertCatalogPublicationEvidence(input, now)).toThrow();
  });
});
