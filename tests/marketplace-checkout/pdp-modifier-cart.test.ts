import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

const mockPrisma = vi.hoisted(() => ({
  storeCatalogOffer: {
    findFirst: vi.fn(),
  },
  storeOfferPriceVersion: {
    findFirst: vi.fn(),
  },
  storeOfferModifierGroup: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/marketplace-checkout/composition-root", () => ({
  assertStorefrontPublicExposureAllowed: vi.fn(),
}));

import { getStorefrontModifierGroupsForOffers } from "@/lib/services/storefront-catalog.service";
import { resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";

describe("Phase 1 Acceptance: PDP Interactive Modifiers & Server-Authoritative Cart Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStorefrontModifierGroupsForOffers", () => {
    it("returns empty record for empty offer list", async () => {
      const result = await getStorefrontModifierGroupsForOffers([]);
      expect(result).toEqual({});
    });

    it("loads and groups active modifier groups with formatted price deltas", async () => {
      mockPrisma.storeOfferModifierGroup.findMany.mockResolvedValueOnce([
        {
          offer: { publicReference: "offer-pizza-1" },
          group: {
            publicReference: "grp-crust",
            name: "Crust Choice",
            description: "Select your crust style",
            minimumSelections: 1,
            maximumSelections: 1,
            isRequired: true,
            options: [
              {
                publicReference: "opt-thin",
                name: "Thin Crust",
                priceDelta: new Prisma.Decimal("0.00"),
                currency: "ZAR",
              },
              {
                publicReference: "opt-cheese",
                name: "Cheese Stuffed Crust",
                priceDelta: new Prisma.Decimal("25.00"),
                currency: "ZAR",
              },
            ],
          },
        },
      ]);

      const result = await getStorefrontModifierGroupsForOffers(["offer-pizza-1"]);
      expect(result["offer-pizza-1"]).toBeDefined();
      expect(result["offer-pizza-1"]).toHaveLength(1);

      const group = result["offer-pizza-1"][0];
      expect(group.groupReference).toBe("grp-crust");
      expect(group.isRequired).toBe(true);
      expect(group.minimumSelections).toBe(1);
      expect(group.maximumSelections).toBe(1);
      expect(group.options).toEqual([
        {
          optionReference: "opt-thin",
          name: "Thin Crust",
          priceDelta: "0.00",
          currency: "ZAR",
        },
        {
          optionReference: "opt-cheese",
          name: "Cheese Stuffed Crust",
          priceDelta: "25.00",
          currency: "ZAR",
        },
      ]);
    });
  });

  describe("resolveMarketplaceCartLine server-authoritative modifier validation", () => {
    const offerWithModifiers = {
      id: "offer-id-1",
      publicReference: "offer-pizza-1",
      storeId: "store-pizza-palace",
      fulfilmentMode: "COURIER_DELIVERY",
      sellingUnit: "EACH",
      packagedQuantity: null,
      version: 1,
      variant: { publicReference: "var-large" },
      product: { publicReference: "prod-pizza" },
      modifierGroups: [
        {
          group: {
            publicReference: "grp-crust",
            status: "ACTIVE",
            minimumSelections: 1,
            maximumSelections: 1,
            isRequired: true,
            options: [
              {
                publicReference: "opt-thin",
                name: "Thin Crust",
                priceDelta: new Prisma.Decimal("0.00"),
                status: "ACTIVE",
              },
              {
                publicReference: "opt-cheese",
                name: "Cheese Stuffed Crust",
                priceDelta: new Prisma.Decimal("25.00"),
                status: "ACTIVE",
              },
            ],
          },
        },
        {
          group: {
            publicReference: "grp-toppings",
            status: "ACTIVE",
            minimumSelections: 0,
            maximumSelections: 2,
            isRequired: false,
            options: [
              {
                publicReference: "opt-mushrooms",
                name: "Mushrooms",
                priceDelta: new Prisma.Decimal("12.50"),
                status: "ACTIVE",
              },
              {
                publicReference: "opt-olives",
                name: "Olives",
                priceDelta: new Prisma.Decimal("10.00"),
                status: "ACTIVE",
              },
            ],
          },
        },
      ],
    };

    const priceVersion = {
      id: "price-id-1",
      publicReference: "price-ver-1",
      amount: new Prisma.Decimal("120.00"),
      currency: "ZAR",
    };

    it("fails closed when a required modifier group has no selection", async () => {
      mockPrisma.storeCatalogOffer.findFirst.mockResolvedValueOnce(offerWithModifiers);
      mockPrisma.storeOfferPriceVersion.findFirst.mockResolvedValueOnce(priceVersion);

      await expect(
        resolveMarketplaceCartLine({
          offerReference: "offer-pizza-1",
          variantReference: "var-large",
          quantity: 1,
          modifiers: [], // Missing required crust!
        }),
      ).rejects.toThrow(MarketplaceCheckoutError);
    });

    it("fails closed when selection exceeds maximumSelections", async () => {
      mockPrisma.storeCatalogOffer.findFirst.mockResolvedValueOnce(offerWithModifiers);
      mockPrisma.storeOfferPriceVersion.findFirst.mockResolvedValueOnce(priceVersion);

      await expect(
        resolveMarketplaceCartLine({
          offerReference: "offer-pizza-1",
          variantReference: "var-large",
          quantity: 1,
          modifiers: [
            // 2 crusts selected when maximumSelections is 1
            { groupReference: "grp-crust", optionReference: "opt-thin", quantity: 1 },
            { groupReference: "grp-crust", optionReference: "opt-cheese", quantity: 1 },
          ],
        }),
      ).rejects.toThrow(MarketplaceCheckoutError);
    });

    it("resolves valid line with server-authoritative price deltas, never trusting client pricing", async () => {
      mockPrisma.storeCatalogOffer.findFirst.mockResolvedValueOnce(offerWithModifiers);
      mockPrisma.storeOfferPriceVersion.findFirst.mockResolvedValueOnce(priceVersion);

      const resolved = await resolveMarketplaceCartLine({
        offerReference: "offer-pizza-1",
        variantReference: "var-large",
        quantity: 2,
        modifiers: [
          { groupReference: "grp-crust", optionReference: "opt-cheese", quantity: 1 },
          { groupReference: "grp-toppings", optionReference: "opt-mushrooms", quantity: 1 },
        ],
      });

      expect(resolved.offerReference).toBe("offer-pizza-1");
      expect(resolved.unitPrice).toBe("120.00");
      expect(resolved.quantity).toBe(2);
      expect(resolved.modifiers).toEqual([
        {
          groupReference: "grp-crust",
          optionReference: "opt-cheese",
          quantity: 1,
          priceDelta: "25.00",
        },
        {
          groupReference: "grp-toppings",
          optionReference: "opt-mushrooms",
          quantity: 1,
          priceDelta: "12.50",
        },
      ]);
    });
  });
});
