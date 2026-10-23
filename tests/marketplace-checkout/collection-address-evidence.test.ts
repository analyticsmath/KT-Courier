import { beforeEach, expect, it, vi } from "vitest";

const { geocode } = vi.hoisted(() => ({ geocode: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/maps/geocode.service", () => ({ geocodeSouthAfricanAddress: geocode }));
vi.mock("@/lib/marketplace-checkout/matrix-quote.service", () => ({ createMarketplaceMatrixQuote: vi.fn() }));
import { createPhase6MarketplaceQuoteAuthority } from "@/lib/marketplace-checkout/phase6-marketplace-quote-authority";

const input = { checkoutReference: "checkout_test", storeReference: "store", pickupLocationReference: "loc_store", serviceAreaReference: "gauteng", fulfilmentMode: "COURIER_DELIVERY", lineCount: 1 };
const point = { latitude: -26.1, longitude: 28.05 };
const address = { line1: "83 Rivonia Road", city: "Sandton", province: "Gauteng", postalCode: "2196", latitude: null, longitude: null };
function authority(pickup: unknown = address, status = "ACTIVE") {
  return createPhase6MarketplaceQuoteAuthority({ marketplaceCheckout: { findUnique: vi.fn().mockResolvedValue({ addressSnapshot: { line1: "Magwa Crescent", city: "Midrand", province: "Gauteng", protectedCoordinates: point, serviceAreaReference: "gauteng" }, storeGroups: [{ storeId: "store", store: { id: "store", status, defaultPickupAddress: pickup, savedAddresses: [] } }] }) } });
}
beforeEach(() => { geocode.mockReset(); geocode.mockResolvedValue(point); });
it("resolves a persisted legacy pickup address without inventing coordinates", async () => {
  const evidence = await authority().resolveEvidence(input);
  expect(geocode).toHaveBeenCalledWith({ line1: address.line1, line2: undefined, city: address.city, province: address.province, postalCode: address.postalCode });
  expect(evidence?.phase6Request).toMatchObject({ quoteInput: { pickupAddress: point } });
});
it("keeps existing coordinate evidence without another provider request", async () => {
  expect(await authority({ ...address, ...point }).resolveEvidence(input)).not.toBeNull();
  expect(geocode).not.toHaveBeenCalled();
});
it("blocks missing collection addresses with an actionable message", async () => {
  await expect(authority(null).resolveEvidence(input)).rejects.toThrow("complete collection address");
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
