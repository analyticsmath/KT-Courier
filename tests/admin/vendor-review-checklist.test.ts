import { describe, expect, it } from "vitest";
import { vendorReviewChecklist } from "@/lib/admin/vendor-review-checklist";

const complete = {
  hasOwner: true,
  ownerActive: true,
  ownerEmailVerified: true,
  hasBusinessContact: true,
  hasPickupAddress: true,
  hasApprovedSellerIdentity: true,
  publishedOfferCount: 3,
  storefrontActive: true,
};

describe("vendor account dossier indicators", () => {
  it("recognizes complete independently verified account evidence", () => {
    expect(vendorReviewChecklist(complete).every(item => item.ready)).toBe(true);
  });
  it("does not confuse account activation with seller identity or catalog approval", () => {
    const items = vendorReviewChecklist({ ...complete, hasApprovedSellerIdentity: false, publishedOfferCount: 0, storefrontActive: false });
    expect(items.find(item => item.key === "owner")?.ready).toBe(true);
    expect(items.find(item => item.key === "seller")?.ready).toBe(false);
    expect(items.find(item => item.key === "catalog")?.ready).toBe(false);
  });
  it("shows missing owner and pickup evidence instead of hiding it", () => {
    const items = vendorReviewChecklist({ ...complete, hasOwner: false, ownerActive: false, ownerEmailVerified: false, hasPickupAddress: false });
    expect(items.find(item => item.key === "owner")?.ready).toBe(false);
    expect(items.find(item => item.key === "pickup")?.ready).toBe(false);
  });
  it("does not mark storefront-ready based solely on an offer count", () => {
    expect(vendorReviewChecklist({ ...complete, storefrontActive: false }).find(item => item.key === "catalog")?.ready).toBe(false);
  });
});
