import { describe, expect, it } from "vitest";
import { isActiveDeliveryServiceForPickup } from "@/lib/admin/store-service-matching";

const service = { active: true, provinces: ["Gauteng"], regionIds: ["jhb", "pta"] };

describe("store pickup preflight active delivery service matching", () => {
  it.each(["Gauteng", "GAUTENG", " gauteng ", "  Gauteng  "])(
    "recognises an equivalent province spelling %s", province => {
      expect(isActiveDeliveryServiceForPickup(service, province, "jhb")).toBe(true);
      expect(isActiveDeliveryServiceForPickup(service, province, "pta")).toBe(true);
    },
  );
  it("retains active service and exact coverage-region requirements", () => {
    expect(isActiveDeliveryServiceForPickup({ ...service, active: false }, "Gauteng", "jhb")).toBe(false);
    expect(isActiveDeliveryServiceForPickup(service, "Gauteng", "cape-town")).toBe(false);
    expect(isActiveDeliveryServiceForPickup(service, "Gauteng", null)).toBe(false);
    expect(isActiveDeliveryServiceForPickup(service, "Western Cape", "jhb")).toBe(false);
    expect(isActiveDeliveryServiceForPickup(service, "Gauteng", "JHB")).toBe(false);
  });
  it("honours intentionally unscoped services without inferring an empty province", () => {
    expect(isActiveDeliveryServiceForPickup({ active: true, provinces: ["Gauteng"], regionIds: [] }, "gauteng", "jhb")).toBe(true);
    expect(isActiveDeliveryServiceForPickup({ active: true, provinces: ["Gauteng"], regionIds: [] }, "", "jhb")).toBe(false);
    expect(isActiveDeliveryServiceForPickup({ active: true, provinces: [], regionIds: [] }, "gauteng", "jhb")).toBe(false);
  });
});
