import { afterEach, describe, expect, it, vi } from "vitest";
import { activePublicProductDocumentSql, activePublicStoreDocumentSql } from "@/lib/storefront/sql-store-publication";
import { resolveVerifiedStorePickupCoordinates } from "@/lib/marketplace-checkout/verified-store-pickup-coordinates";
import { isMerchantPickupEvidenceComplete } from "@/lib/store-presentation/merchant-pickup-evidence";
import { geocodeSouthAfricanAddress } from "@/lib/maps/geocode.service";
import { isSouthAfricanCountry } from "@/lib/validation/south-african-country";

const BASE_PICKUP = {
  line1: "22 Sandton Drive",
  line2: "Unit 4",
  suburb: "Sandton",
  city: "Johannesburg",
  province: "Gauteng",
  postalCode: "2196",
  country: "South Africa",
  latitude: -26.1076,
  longitude: 28.0567,
  placeId: "place_sandton_22",
};

describe("P1: South African country-code parity across SQL, preflight, presentation, and geocoding", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("includes ZA, ZAF, RSA, SOUTH AFRICA and 4-digit postal validation in storefront SQL fragments", () => {
    for (const fragment of [activePublicStoreDocumentSql, activePublicProductDocumentSql]) {
      const normalized = fragment.sql.replace(/\s+/g, " ");
      expect(normalized).toContain("IN ('ZA', 'ZAF', 'RSA', 'SOUTH AFRICA')");
      expect(normalized).toContain("regexp_replace(BTRIM(COALESCE(pickup.\"country\", '')), '[[:space:]]+', ' ', 'g')");
      expect(normalized).toContain("~ '^[0-9]{4}$'");
    }
  });

  it.each(["South Africa", "ZA", "ZAF", "RSA", " rsa ", "South  Africa", "zaf"])(
    "accepts %j consistently in pickup coordinates, merchant evidence, and country validator",
    async (country) => {
      expect(isSouthAfricanCountry(country)).toBe(true);
      expect(isMerchantPickupEvidenceComplete({ ...BASE_PICKUP, country })).toBe(true);

      const resolved = await resolveVerifiedStorePickupCoordinates(
        { ...BASE_PICKUP, country },
        async () => ({ latitude: -26.1076, longitude: 28.0567 }),
      );
      expect(resolved).toEqual({ latitude: -26.1076, longitude: 28.0567 });
    },
  );

  it("rejects US, unit-only line2 without suburb, and malformed postal code across helpers", async () => {
    expect(isSouthAfricanCountry("US")).toBe(false);
    expect(isMerchantPickupEvidenceComplete({ ...BASE_PICKUP, country: "US" })).toBe(false);
    expect(
      await resolveVerifiedStorePickupCoordinates(
        { ...BASE_PICKUP, country: "US" },
        async () => ({ latitude: -26.1076, longitude: 28.0567 }),
      ),
    ).toBeNull();

    const unitOnly = { ...BASE_PICKUP, country: "RSA", line2: "Unit 4", suburb: null };
    expect(isMerchantPickupEvidenceComplete(unitOnly)).toBe(false);
    expect(
      await resolveVerifiedStorePickupCoordinates(unitOnly, async () => ({
        latitude: -26.1076,
        longitude: 28.0567,
      })),
    ).toBeNull();

    const badPostal = { ...BASE_PICKUP, country: "ZAF", postalCode: "ABC" };
    expect(isMerchantPickupEvidenceComplete(badPostal)).toBe(false);
    expect(
      await resolveVerifiedStorePickupCoordinates(badPostal, async () => ({
        latitude: -26.1076,
        longitude: 28.0567,
      })),
    ).toBeNull();
  });

  it("forward-geocodes ZA, ZAF, RSA, and South Africa addresses while rejecting non-SA country input", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KT_NETWORK_DISABLED", "false");
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-maps-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [
            {
              geometry: {
                location: { lat: -26.1076, lng: 28.0567 },
                location_type: "ROOFTOP",
              },
              types: ["street_address"],
              address_components: [
                { short_name: "ZA", long_name: "South Africa", types: ["country", "political"] },
                { short_name: "GP", long_name: "Gauteng", types: ["administrative_area_level_1", "political"] },
                { short_name: "Johannesburg", long_name: "Johannesburg", types: ["locality", "political"] },
                { short_name: "Sandton", long_name: "Sandton", types: ["sublocality", "political"] },
                { short_name: "2196", long_name: "2196", types: ["postal_code"] },
              ],
            },
          ],
        }),
      })),
    );

    for (const country of ["South Africa", "ZA", "ZAF", "RSA"]) {
      const coords = await geocodeSouthAfricanAddress({
        line1: "22 Sandton Drive",
        suburb: "Sandton",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2196",
        country,
      });
      expect(coords).toEqual({ latitude: -26.1076, longitude: 28.0567 });
    }

    const rejected = await geocodeSouthAfricanAddress({
      line1: "22 Sandton Drive",
      suburb: "Sandton",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2196",
      country: "US",
    });
    expect(rejected).toBeNull();
  });
});
