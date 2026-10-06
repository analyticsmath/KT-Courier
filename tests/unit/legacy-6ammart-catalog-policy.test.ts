import { describe, expect, it } from "vitest";
import {
  isLegacyMediaUsable,
  isLegacyStorePublicationCandidate,
  legacyItemDisposition,
  legacyProductTypeCode,
  normalizeLegacyPhone,
  parseLegacyVariants,
} from "@/lib/migrations/legacy-6ammart/catalog-policy";

describe("legacy 6amMart catalogue migration policy", () => {
  it("publishes only source-approved active non-test stores", () => {
    expect(
      isLegacyStorePublicationCandidate({
        id: 21,
        name: "Purple Plum Food Hub",
        status: 1,
        active: 1,
        moduleId: 6,
      }),
    ).toBe(true);

    expect(
      isLegacyStorePublicationCandidate({
        id: 7,
        name: "Test Store",
        status: 1,
        active: 1,
        moduleId: 4,
      }),
    ).toBe(false);

    expect(
      isLegacyStorePublicationCandidate({
        id: 11,
        name: "Pending Merchant",
        status: 0,
        active: 1,
        moduleId: 4,
      }),
    ).toBe(false);
  });

  it("requires physical non-zero primary media for automatic product publication", () => {
    const store = {
      id: 21,
      name: "Purple Plum Food Hub",
      status: 1,
      active: 1,
      moduleId: 6,
    } as const;
    const item = {
      id: 220,
      storeId: 21,
      moduleId: 6,
      status: 1,
      isApproved: 1,
    } as const;

    expect(
      legacyItemDisposition({
        item,
        store,
        primaryMedia: {
          exists: true,
          byteSize: 58_000,
          width: 579,
          height: 585,
          decodable: true,
        },
      }),
    ).toBe("PUBLISH");

    expect(
      legacyItemDisposition({
        item,
        store,
        primaryMedia: {
          exists: true,
          byteSize: 0,
          width: null,
          height: null,
          decodable: false,
        },
      }),
    ).toBe("PRESERVE_PENDING");

    expect(isLegacyMediaUsable(null)).toBe(false);
  });

  it("rejects products whose source store no longer exists", () => {
    expect(
      legacyItemDisposition({
        item: {
          id: 1,
          storeId: 999,
          moduleId: 4,
          status: 1,
          isApproved: 1,
        },
        store: null,
        primaryMedia: {
          exists: true,
          byteSize: 10,
          decodable: true,
        },
      }),
    ).toBe("REJECT_ORPHAN");
  });

  it("maps source modules and ecommerce categories to current product types", () => {
    expect(legacyProductTypeCode(2, ["Grocery"])).toBe("GROCERIES");
    expect(legacyProductTypeCode(3, ["Pharmacy"])).toBe("HEALTH_WELLNESS");
    expect(legacyProductTypeCode(6, ["Restaurants", "Burgers"])).toBe("FOOD_DINING");
    expect(legacyProductTypeCode(4, ["Automotive"])).toBe("AUTOMOTIVE");
    expect(legacyProductTypeCode(4, ["Printer Ink & Cartridges"])).toBe("ELECTRONICS");
    expect(legacyProductTypeCode(4, ["Skin Care"])).toBe("HEALTH_WELLNESS");
    expect(legacyProductTypeCode(4, ["Shipping Boxes"])).toBe("HOME_LIVING");
    expect(legacyProductTypeCode(4, ["CV Joint", "Parts"])).toBe("AUTOMOTIVE");
    expect(legacyProductTypeCode(4, ["Jewellery", "Gifts"])).toBe("FASHION_APPAREL");
    expect(legacyProductTypeCode(4, ["Body Butter", "Personal Care"])).toBe("HEALTH_WELLNESS");
  });

  it("normalizes South African phone numbers without inventing malformed values", () => {
    expect(normalizeLegacyPhone("063 936 3190")).toBe("+27639363190");
    expect(normalizeLegacyPhone("+27 63 936 3190")).toBe("+27639363190");
    expect(normalizeLegacyPhone("unknown")).toBe("unknown");
  });

  it("preserves legacy option pricing and stock as variants", () => {
    const variants = parseLegacyVariants({
      baseTitle: "Running Shoe",
      basePrice: 1_999,
      baseStock: 3,
      variations: [
        { type: "UK5", price: 2_025, stock: 10 },
        { type: "UK6", price: 2_025, stock: 9 },
      ],
    });

    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      title: "Running Shoe — UK5",
      price: 2_025,
      stock: 10,
    });
    expect(variants[1]?.optionFingerprint).toContain("uk6");
  });
});
