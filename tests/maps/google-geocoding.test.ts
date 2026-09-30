import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeSouthAfricanAddress } from "@/lib/maps/geocode.service";

describe("geocodeSouthAfricanAddress", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns provider coordinates for a valid South African address", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              geometry: {
                location: { lat: -26.107567, lng: 28.056702 },
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await geocodeSouthAfricanAddress({
      line1: "1 Sandton Drive",
      city: "Sandton",
      province: "Gauteng",
      postalCode: "2196",
    }, {
      serverKey: "server-test-key",
      geocodeApiUrl: "https://maps.googleapis.com/maps/api/geocode/json",
      regionBias: "za",
      routesApiUrl: "https://routes.googleapis.com/directions/v2:computeRoutes",
    });

    expect(result).toEqual({ latitude: -26.107567, longitude: 28.056702 });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("region")).toBe("za");
    expect(url.searchParams.get("components")).toBe("country:ZA");
    expect(url.searchParams.get("key")).toBe("server-test-key");
    expect(url.searchParams.get("address")).toContain("1 Sandton Drive");
  });

  it("returns null rather than inventing coordinates when geocoding has no result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await geocodeSouthAfricanAddress({
      line1: "Definitely Not A Real Address",
      city: "Johannesburg",
      province: "Gauteng",
    }, {
      serverKey: "server-test-key",
      geocodeApiUrl: "https://maps.googleapis.com/maps/api/geocode/json",
      regionBias: "za",
      routesApiUrl: "https://routes.googleapis.com/directions/v2:computeRoutes",
    });

    expect(result).toBeNull();
  });
});
