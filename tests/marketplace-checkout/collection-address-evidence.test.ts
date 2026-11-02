import { beforeEach, expect, it, vi } from "vitest";

const { geocode } = vi.hoisted(() => ({ geocode: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/maps/geocode.service", () => ({ geocodeSouthAfricanAddress: geocode }));
vi.mock("@/lib/marketplace-checkout/matrix-quote.service", () => ({ createMarketplaceMatrixQuote: vi.fn() }));
import { createPhase6MarketplaceQuoteAuthority } from "@/lib/marketplace-checkout/phase6-marketplace-quote-authority";

const input = { checkoutReference: "checkout_test", storeReference: "store", pickupLocationReference: "loc_store", serviceAreaReference: "gauteng", fulfilmentMode: "COURIER_DELIVERY", lineCount: 1 };
const point = { latitude: -26.1, longitude: 28.05 };
const address = {
  storeId: "store",
  type: "PICKUP",
  country: "South Africa",
  line1: "83 Rivonia Road",
  line2: "Sandton",
  city: "Johannesburg",
  province: "Gauteng",
  postalCode: "2196",
  latitude: -26.1,
  longitude: 28.05,
};
function authority(pickup: unknown = address, status = "ACTIVE") {
  return createPhase6MarketplaceQuoteAuthority({ marketplaceCheckout: { findUnique: vi.fn().mockResolvedValue({ addressSnapshot: { line1: "Magwa Crescent", city: "Midrand", province: "Gauteng", protectedCoordinates: point, serviceAreaReference: "gauteng" }, storeGroups: [{ storeId: "store", store: { id: "store", status, defaultPickupAddress: pickup, savedAddresses: [] } }] }) } });
}
beforeEach(() => { geocode.mockReset(); geocode.mockResolvedValue(point); });
it("reverifies a complete saved pickup with an explicit suburb, postal code and map marker", async () => {
  const evidence = await authority().resolveEvidence(input);
  expect(geocode).toHaveBeenCalledWith(expect.objectContaining({ line1: address.line1, line2: address.line2, city: address.city, province: address.province, postalCode: address.postalCode, latitude: address.latitude, longitude: address.longitude }));
  expect(evidence?.phase6Request).toMatchObject({ quoteInput: { pickupAddress: point } });
});
it("reverifies a saved browser map marker before pricing any merchant delivery", async () => {
  const providerPoint = { latitude: -26.102, longitude: 28.052 };
  geocode.mockResolvedValue(providerPoint);
  const evidence = await authority({ ...address, ...point, placeId: "ChIJmerchantlocation" }).resolveEvidence(input);
  expect(geocode).toHaveBeenCalledWith(expect.objectContaining({
    line1: address.line1,
    city: address.city,
    province: address.province,
    latitude: point.latitude,
    longitude: point.longitude,
    placeId: "ChIJmerchantlocation",
  }));
  expect(evidence?.phase6Request).toMatchObject({ quoteInput: { pickupAddress: providerPoint } });
});
it("rejects saved map coordinates when the provider cannot independently verify them", async () => {
  geocode.mockResolvedValue(null);
  await expect(authority({ ...address, ...point }).resolveEvidence(input))
    .rejects.toThrow("collection address could not be verified");
  expect(geocode).toHaveBeenCalledTimes(1);
});
it("blocks missing collection addresses with an actionable message", async () => {
  await expect(authority(null).resolveEvidence(input)).rejects.toThrow("complete collection address");
  expect(geocode).not.toHaveBeenCalled();
});
it("blocks incomplete saved pickup evidence before contacting the geocoder", async () => {
  for (const patch of [{ line2: null }, { postalCode: null }, { latitude: null, longitude: null }]) {
    await expect(authority({ ...address, ...patch }).resolveEvidence(input)).rejects.toThrow("complete collection address");
  }
  expect(geocode).not.toHaveBeenCalled();
});
it("blocks unresolved store locations", async () => {
  geocode.mockResolvedValue(null);
  await expect(authority().resolveEvidence(input)).rejects.toThrow("collection address could not be verified");
});
it("never geocodes suspended stores", async () => {
  expect(await authority(address, "SUSPENDED").resolveEvidence(input)).toBeNull();
  expect(geocode).not.toHaveBeenCalled();
});
