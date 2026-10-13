import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocodeSouthAfricanProvince } from "@/lib/maps/geocode.service";

const config = { serverKey: "server-test-key", geocodeApiUrl: "https://maps.googleapis.com/maps/api/geocode/json", regionBias: "za", routesApiUrl: "https://routes.googleapis.com/directions/v2:computeRoutes" };
const result = (province: string, country = "ZA") => ({ address_components: [
  { long_name: province, types: ["administrative_area_level_1", "political"] },
  { short_name: country, types: ["country", "political"] },
] });
afterEach(() => vi.restoreAllMocks());

describe("provider-verified province", () => {
  it("uses actual coordinates and an authenticated server geocoder result", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [result("Gauteng")] })));
    expect(await reverseGeocodeSouthAfricanProvince(-25.7479, 28.2293, config)).toBe("Gauteng");
    const query = new URL(String(fetch.mock.calls[0][0]));
    expect(query.searchParams.get("latlng")).toBe("-25.7479,28.2293");
    expect(query.searchParams.get("result_type")).toBe("administrative_area_level_1");
    expect(query.searchParams.has("address")).toBe(false);
    expect(query.searchParams.get("key")).toBe("server-test-key");
  });
  it.each([
    { status: "OK", results: [result("Gauteng", "ZW")] },
    { status: "OK", results: [result("Gauteng"), result("Gauteng", "ZW")] },
    { status: "OK", results: [result("Unknown")] },
    { status: "OK", results: [result("Gauteng"), result("North West")] },
    { status: "ZERO_RESULTS", results: [] },
  ])("rejects foreign, unknown, ambiguous and unresolved locations", async payload => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(payload)));
    expect(await reverseGeocodeSouthAfricanProvince(-26, 28, config)).toBeNull();
  });
  it("fails closed on provider errors and invalid coordinates", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));
    expect(await reverseGeocodeSouthAfricanProvince(-26, 28, config)).toBeNull();
    fetch.mockClear();
    for (const [lat, lng] of [[NaN, 28], [-91, 28], [-26, 181]]) expect(await reverseGeocodeSouthAfricanProvince(lat, lng, config)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
