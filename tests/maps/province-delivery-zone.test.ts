import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ regions: vi.fn(), province: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { deliveryRegion: { findMany: mocks.regions } } }));
vi.mock("@/lib/maps/geocode.service", () => ({ reverseGeocodeSouthAfricanProvince: mocks.province }));
import { checkDeliveryZone } from "@/lib/maps/delivery-zone.service";

const province = { id: "gauteng-wide", name: "Gauteng province-wide", province: "Gauteng", coverageMode: "PROVINCE", centerLat: null, centerLng: null, coverageRadiusKm: null, maxDistanceKm: null };
beforeEach(() => { vi.resetAllMocks(); mocks.regions.mockResolvedValue([province]); mocks.province.mockResolvedValue("Gauteng"); });

describe("province-wide operational coverage", () => {
  it.each([[-25.7479, 28.2293], [-26.2041, 28.0473], [-26.67, 27.93]])("accepts a verified Gauteng location independently of a city radius", async (lat, lng) => {
    expect(await checkDeliveryZone(lat, lng)).toMatchObject({ matched: true, regionId: "gauteng-wide", withinMaxDistance: true, calculationType: "provider_verified_province" });
    expect(mocks.province).toHaveBeenCalledWith(lat, lng);
    expect(mocks.regions).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true, pricingEnabled: true } }));
  });
  it.each(["North West", "Western Cape", null])("rejects other provinces and unresolved provider geography", async verified => {
    mocks.province.mockResolvedValue(verified);
    expect((await checkDeliveryZone(-26, 28)).matched).toBe(false);
  });
  it("does not turn legacy regions with missing radius data into province-wide coverage", async () => {
    mocks.regions.mockResolvedValue([{ ...province, coverageMode: "RADIUS" }]);
    expect((await checkDeliveryZone(-26, 28)).matched).toBe(false);
    expect(mocks.province).not.toHaveBeenCalled();
  });
  it("keeps valid radius behavior and avoids an unnecessary provider request", async () => {
    mocks.regions.mockResolvedValue([{ ...province, id: "radius", coverageMode: "RADIUS", centerLat: -26, centerLng: 28, coverageRadiusKm: 10, maxDistanceKm: 20 }, province]);
    expect((await checkDeliveryZone(-26, 28)).regionId).toBe("radius");
    expect(mocks.province).not.toHaveBeenCalled();
  });
});
