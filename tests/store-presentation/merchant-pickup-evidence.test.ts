import { describe, expect, it } from "vitest";
import { isMerchantPickupEvidenceComplete } from "@/lib/store-presentation/merchant-pickup-evidence";

const pickup = { line1: "123 Main Road", line2: "Sandton", city: "Johannesburg", province: "Gauteng", country: "South Africa", postalCode: "2000", latitude: -26.2, longitude: 28.04 };

describe("merchant dashboard collection readiness", () => {
  it("never treats an imported legacy business address as saved courier pickup", () => {
    expect(isMerchantPickupEvidenceComplete(null)).toBe(false);
  });
  it("recognises a configured, mapped saved pickup without claiming delivery availability", () => {
    expect(isMerchantPickupEvidenceComplete(pickup)).toBe(true);
  });
  it("does not show saved-address readiness when map coordinates are absent", () => {
    expect(isMerchantPickupEvidenceComplete({ ...pickup, latitude: null, longitude: null })).toBe(false);
  });
  it("does not show saved-address readiness when postal code is absent", () => {
    expect(isMerchantPickupEvidenceComplete({ ...pickup, postalCode: null })).toBe(false);
  });
  it("does not show saved-address readiness when suburb is absent", () => {
    expect(isMerchantPickupEvidenceComplete({ ...pickup, line2: null })).toBe(false);
  });
  it("does not show saved-address readiness when street, province, or coordinates are invalid", () => {
    for (const value of [{ ...pickup, line1: "" }, { ...pickup, province: "" }, { ...pickup, latitude: 0, longitude: 0 }, { ...pickup, latitude: 91 }]) {
      expect(isMerchantPickupEvidenceComplete(value)).toBe(false);
    }
  });
});
