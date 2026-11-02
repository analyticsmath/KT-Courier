import { describe, expect, it, vi } from "vitest";
import { resolveVerifiedStorePickupCoordinates } from "@/lib/marketplace-checkout/verified-store-pickup-coordinates";

const address = {
  line1: "123 Market Road",
  line2: "Sandton",
  city: "Johannesburg",
  province: "Gauteng",
  country: "South Africa",
  postalCode: "2000",
  placeId: "ChIJ123456789",
  latitude: { toString: () => "-26.202" },
  longitude: { toString: () => "28.041" },
};

describe("merchant pickup coordinates require trusted provider verification", () => {
  it("uses the provider's point rather than merchant-saved coordinates", async () => {
    const resolver = vi.fn().mockResolvedValue({ latitude: -26.2041, longitude: 28.0473 });
    await expect(resolveVerifiedStorePickupCoordinates(address, resolver)).resolves.toEqual({
      latitude: -26.2041, longitude: 28.0473,
    });
    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({
      placeId: "ChIJ123456789",
      latitude: -26.202,
      longitude: 28.041,
      line1: "123 Market Road",
      province: "Gauteng",
    }));
  });
  it("fails closed when the mapping provider cannot confirm the selected point", async () => {
    const resolver = vi.fn().mockResolvedValue(null);
    expect(await resolveVerifiedStorePickupCoordinates(address, resolver)).toBeNull();
    expect(resolver).toHaveBeenCalledTimes(1);
  });
  it("rejects a pickup without a saved map marker even if a provider could geocode its street", async () => {
    const resolver = vi.fn().mockResolvedValue({ latitude: -26.2041, longitude: 28.0473 });
    expect(await resolveVerifiedStorePickupCoordinates({ ...address, latitude: null, longitude: null }, resolver)).toBeNull();
    expect(resolver).not.toHaveBeenCalled();
  });
  it("does not query the provider for invalid coordinates or an incomplete street address", async () => {
    const resolver = vi.fn();
    for (const pickup of [
      { ...address, latitude: "91" },
      { ...address, latitude: "0", longitude: "0" },
      { ...address, city: "" },
      { ...address, province: "" },
      { ...address, line2: "" },
      { ...address, postalCode: "" },
    ]) {
      expect(await resolveVerifiedStorePickupCoordinates(pickup, resolver)).toBeNull();
    }
    expect(resolver).not.toHaveBeenCalled();
  });
});
