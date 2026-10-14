import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeSouthAfricanAddress } from "@/lib/maps/geocode.service";
const config = { serverKey: "server-test-key", geocodeApiUrl: "https://maps.googleapis.com/maps/api/geocode/json", regionBias: "za", routesApiUrl: "https://routes.googleapis.com/directions/v2:computeRoutes" };
const address = { line1: "158 Civic Boulevard", city: "Johannesburg", province: "Gauteng" };
const component = (name: string, type: string, short_name = name) => ({ long_name: name, short_name, types: [type] });
const good = { types: ["street_address"], geometry: { location: { lat: -26.1906, lng: 28.0391 }, location_type: "ROOFTOP" }, address_components: [component("South Africa", "country", "ZA"), component("Gauteng", "administrative_area_level_1"), component("Johannesburg", "locality")] };
const provider = (results: unknown[]) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "OK", results })));
afterEach(() => vi.restoreAllMocks());
describe("forward geocoding must preserve the requested address identity", () => {
  it.each([
    { ...good, partial_match: true },
    { ...good, geometry: { ...good.geometry, location_type: "APPROXIMATE" } },
    { ...good, address_components: [component("South Africa", "country", "ZA"), component("Gauteng", "administrative_area_level_1")] },
    { ...good, address_components: [component("South Africa", "country", "ZA"), component("Gauteng", "administrative_area_level_1"), component("Centurion", "locality")] },
    { ...good, address_components: [component("South Africa", "country", "ZA"), component("North West", "administrative_area_level_1"), component("Johannesburg", "locality")] },
    { ...good, address_components: [component("Zimbabwe", "country", "ZW"), component("Gauteng", "administrative_area_level_1"), component("Johannesburg", "locality")] },
  ])("refuses partial, approximate, incomplete or contradictory provider evidence", async result => { provider([result]); expect(await geocodeSouthAfricanAddress(address, config)).toBeNull(); });
  it("refuses a city mismatch even if the returned point happens to lie in Gauteng", async () => { provider([good]); expect(await geocodeSouthAfricanAddress({ ...address, line1: "Mpheni House, 159 Nelson Mandela Drive", city: "Rustenburg" }, config)).toBeNull(); });
  it("accepts a complete city identity and Johannesburg's municipality identity", async () => {
    const fetch = provider([good]); expect(await geocodeSouthAfricanAddress(address, config)).toEqual({ latitude: -26.1906, longitude: 28.0391 });
    fetch.mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [{ ...good, address_components: [component("South Africa", "country", "ZA"), component("Gauteng", "administrative_area_level_1"), component("Braamfontein", "locality"), component("City of Johannesburg Metropolitan Municipality", "administrative_area_level_2")] }] })));
    expect(await geocodeSouthAfricanAddress(address, config)).toEqual({ latitude: -26.1906, longitude: 28.0391 });
  });
  it("refuses multiple conflicting location results", async () => { provider([good, { ...good, geometry: { ...good.geometry, location: { lat: -26.2, lng: 28.1 } } }]); expect(await geocodeSouthAfricanAddress(address, config)).toBeNull(); });
});
