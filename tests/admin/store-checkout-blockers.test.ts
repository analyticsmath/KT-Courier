import { describe, expect, it } from "vitest";
import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";
import { describeStoreCheckoutBlockers } from "@/lib/admin/store-checkout-blockers";

const pickup = {
  id: "pickup-1", storeId: "store-1", type: "PICKUP",
  line1: "15 Main Street", line2: "Sandton", city: "Johannesburg",
  province: "Gauteng", country: "ZA", postalCode: "2196",
  latitude: -26.1076, longitude: 28.0567, placeId: "verified-map-point",
};
const cert = {
  status: "APPROVED", pickupAddressId: "pickup-1",
  pickupFingerprint: pickupCertificationFingerprint(pickup),
  preparedByUserId: "admin-maker", approvedByUserId: "admin-reviewer",
  approvedAt: new Date("2026-11-09T08:00:00.000Z"),
  expiresAt: new Date("2026-11-10T08:00:00.000Z"),
  routeEvidenceDigest: "a".repeat(64), checkoutEvidenceDigest: "b".repeat(64),
};
const base = { status: "ACTIVE", name: "Gauteng Merchant", publishedOfferCount: 2, pickup, certification: cert, now: new Date("2026-11-09T12:00:00.000Z") };

describe("superuser store checkout-blocked inventory", () => {
  it("does not classify a current independently certified merchant as blocked", () => {
    expect(describeStoreCheckoutBlockers(base)).toEqual([]);
  });
  it("reports the merchant's exact missing pickup fields", () => {
    const blockers = describeStoreCheckoutBlockers({ ...base, pickup: { ...pickup, line2: "", postalCode: "", latitude: null } });
    expect(blockers).toContain("Suburb / area missing");
    expect(blockers).toContain("Postal code missing");
    expect(blockers).toContain("Map coordinates missing");
  });
  it("includes stores with valid pickup but missing, expired or self-approved checkout authority", () => {
    expect(describeStoreCheckoutBlockers({ ...base, certification: null })).toContain("Independent route and checkout certification missing");
    expect(describeStoreCheckoutBlockers({ ...base, now: new Date("2026-11-10T09:00:00.000Z") })).toContain("Checkout certification expired");
    expect(describeStoreCheckoutBlockers({ ...base, certification: { ...cert, approvedByUserId: "admin-maker" } }))
      .toContain("Independent route and paid-checkout review incomplete");
  });
  it("does not declare an unlisted store ready when it has zero published products or a pending account", () => {
    expect(describeStoreCheckoutBlockers({ ...base, publishedOfferCount: 0 })).toContain("No published products available");
    expect(describeStoreCheckoutBlockers({ ...base, status: "PENDING" })).toContain("Store account needs activation");
  });
  it("detects changed collection locations without manufacturing fresh certification", () => {
    expect(describeStoreCheckoutBlockers({ ...base, pickup: { ...pickup, id: "new-pickup" } }))
      .toContain("Collection address changed since checkout certification");
    expect(describeStoreCheckoutBlockers({ ...base, pickup: { ...pickup, latitude: -26.2001 } }))
      .toContain("Reconfirm the saved pickup against current approved checkout evidence");
  });
});
