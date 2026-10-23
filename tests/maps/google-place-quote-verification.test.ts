import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeSouthAfricanAddress } from "@/lib/maps/geocode.service";
import { PublicQuoteSchema } from "@/lib/client-platform/contracts";

const config = {
  serverKey: "test-server-key",
  geocodeApiUrl: "https://maps.googleapis.com/maps/api/geocode/json",
  regionBias: "za",
  routesApiUrl: "https://routes.googleapis.com/directions/v2:computeRoutes",
};
const component = (long_name: string, type: string, short_name = long_name) => ({ long_name, short_name, types: [type] });
const exactPlace = {
  types: ["establishment", "point_of_interest"],
  geometry: { location_type: "GEOMETRIC_CENTER", location: { lat: -25.73, lng: 28.28 } },
  address_components: [
    component("South Africa", "country", "ZA"),
    component("Gauteng", "administrative_area_level_1"),
    component("City of Tshwane Metropolitan Municipality", "administrative_area_level_2"),
    component("Pretoria", "locality"),
  ],
};
const selected = {
  line1: "Shop 7 and 8 Finforum, Dr Van Der Merwe Street",
  city: "Magalieskruin", province: "Gauteng",
  placeId: "ChIJ_validPlaceId123",
  latitude: -25.73, longitude: 28.28,
};
afterEach(() => vi.restoreAllMocks());

describe("quotes verify a browser-selected Google Place server-side", () => {
  it("retains Google Place evidence in the quote request without accepting coordinate-only quotations", () => {
    const base = { serviceKey: "CLIENT_ECONOMY", parcelSize: "SMALL", weightKg: "1", pickupAddress: selected, dropoffAddress: selected };
    expect(PublicQuoteSchema.safeParse(base).success).toBe(true);
    expect(PublicQuoteSchema.safeParse({ ...base, pickupAddress: { ...selected, placeId: undefined, latitude: -25.73 } }).success).toBe(false);
    expect(PublicQuoteSchema.safeParse({ ...base, pickupAddress: { ...selected, placeId: "bad place id" } }).success).toBe(false);
  });

  it("geocodes the selected place ID rather than losing a valid suburb-specific address in a free-text lookup", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [exactPlace] })));
    expect(await geocodeSouthAfricanAddress(selected, config)).toEqual({ latitude: -25.73, longitude: 28.28 });
    const request = new URL(String(spy.mock.calls[0][0]));
    expect(request.searchParams.get("place_id")).toBe(selected.placeId);
    expect(request.searchParams.has("address")).toBe(false);
    // Place ID geocoding only accepts place_id/key (+ reverse-geocoding
    // options). Forward-only country components/region can cause HTTP 400.
    expect(request.searchParams.has("components")).toBe(false);
    expect(request.searchParams.has("region")).toBe(false);
  });

  it("rejects forged coordinates rather than trusting the browser's marker", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [exactPlace] })));
    expect(await geocodeSouthAfricanAddress({ ...selected, latitude: -26.1, longitude: 28.1 }, config)).toBeNull();
  });

  it("rejects an address whose place ID resolves into another province or country", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [{ ...exactPlace,
      address_components: [component("South Africa", "country", "ZA"), component("Limpopo", "administrative_area_level_1")]
    }] })));
    expect(await geocodeSouthAfricanAddress(selected, config)).toBeNull();
    spy.mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [{ ...exactPlace,
      address_components: [component("Zimbabwe", "country", "ZW"), component("Gauteng", "administrative_area_level_1")]
    }] })));
    expect(await geocodeSouthAfricanAddress(selected, config)).toBeNull();
  });

  it("continues to reject broad/partial locations even with a place ID", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [{ ...exactPlace, partial_match: true }] })));
    expect(await geocodeSouthAfricanAddress(selected, config)).toBeNull();
  });
});
