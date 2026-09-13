import { describe, expect, it, vi, beforeEach } from "vitest";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

const mockPrisma = vi.hoisted(() => ({
  marketplaceCheckout: {
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: "chk-1", version: 3, status: "READY_FOR_REVIEW" }),
  },
  marketplaceCheckoutOperation: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  marketplaceCheckoutStoreGroup: {
    findMany: vi.fn().mockResolvedValue([
      {
        merchandiseSubtotal: "100.00",
        modifierSubtotal: "0.00",
        deliveryFee: "35.00",
        groupTotal: "135.00",
      },
    ]),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

const mockComposition = vi.hoisted(() => ({
  deliveryQuotes: {
    quoteStoreGroup: vi.fn(),
  },
}));

vi.mock("@/lib/marketplace-checkout/composition-root", () => ({
  resolveAndAssertMarketplaceCheckoutOperation: vi.fn(() => mockComposition),
}));

vi.mock("@/lib/db/serializable-retry", () => ({
  withSerializableRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/lib/marketplace-checkout/checkout.service", () => ({
  getMarketplaceCheckoutForOwner: vi.fn().mockImplementation(async (ref: string) => ({
    id: "chk-1",
    publicReference: ref,
    version: 3,
    status: "READY_FOR_REVIEW",
    storeGroups: [
      {
        id: "grp-1",
        storeId: "store-1",
        deliveryQuoteReference: "quote-1",
        deliveryFee: "35.00",
        groupTotal: "135.00",
        status: "READY",
        lines: [],
      },
    ],
  })),
}));

import { selectMarketplaceCheckoutDeliveryOptions } from "@/lib/marketplace-checkout/delivery-selection.service";

describe("Phase 1 Acceptance: Delivery Option Selection Persistence", () => {
  const owner = { type: "CUSTOMER" as const, userId: "user-1" };
  const mockCheckout = {
    id: "chk-1",
    publicReference: "chk_ref_abc",
    version: 2,
    status: "VALIDATING",
    customerUserId: "user-1",
    addressServiceAreaReference: "area-sandton",
    addressSnapshot: {
      serviceAreaReference: "area-sandton",
    },
    storeGroups: [
      {
        id: "grp-1",
        storeId: "store-1",
        pickupLocationReference: "pickup-1",
        fulfilmentMode: "COURIER_DELIVERY",
        merchandiseSubtotal: "100.00",
        modifierSubtotal: "0.00",
        lines: [{ id: "line-1" }],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists authoritative quote onto store group and advances checkout version", async () => {
    mockPrisma.marketplaceCheckout.findFirst.mockResolvedValueOnce(mockCheckout);
    mockPrisma.marketplaceCheckoutOperation.findUnique.mockResolvedValueOnce(null);

    mockComposition.deliveryQuotes.quoteStoreGroup.mockResolvedValueOnce({
      publicReference: "quote-pub-123",
      currency: "ZAR",
      fee: "35.00",
      version: "rule-v1",
      expiresAt: new Date("2026-09-30T12:00:00Z"),
      serviceabilityReference: "area-sandton",
    });

    const result = await selectMarketplaceCheckoutDeliveryOptions({
      reference: "chk_ref_abc",
      owner,
      operation: {
        operationId: "op-quote-1",
        requestHash: "hash-quote-1",
        expectedVersion: 2,
      },
      selections: [
        {
          storeReference: "store-1",
          quoteReference: "quote-pub-123",
          fulfilmentMode: "COURIER_DELIVERY",
        },
      ],
    });

    expect(mockPrisma.marketplaceCheckoutStoreGroup.update).toHaveBeenCalledWith({
      where: { id: "grp-1" },
      data: expect.objectContaining({
        deliveryQuoteReference: "quote-pub-123",
        deliveryQuoteVersion: "rule-v1",
        deliveryFee: "35.00",
        groupTotal: "135.00",
        status: "READY",
      }),
    });

    expect(mockPrisma.marketplaceCheckout.update).toHaveBeenCalledWith({
      where: { id: "chk-1" },
      data: expect.objectContaining({
        version: { increment: 1 },
      }),
    });

    expect(mockPrisma.marketplaceCheckoutOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checkoutId: "chk-1",
        operationId: "op-quote-1",
        requestHash: "hash-quote-1",
      }),
    });

    expect(result).toBeDefined();
    expect(result.publicReference).toBe("chk_ref_abc");
  });

  it("fails closed when selected quoteReference does not match authoritative evidence", async () => {
    mockPrisma.marketplaceCheckout.findFirst.mockResolvedValueOnce(mockCheckout);
    mockPrisma.marketplaceCheckoutOperation.findUnique.mockResolvedValueOnce(null);

    mockComposition.deliveryQuotes.quoteStoreGroup.mockResolvedValueOnce({
      publicReference: "quote-pub-123",
      currency: "ZAR",
      fee: "35.00",
      version: "rule-v1",
      expiresAt: new Date("2026-09-30T12:00:00Z"),
      serviceabilityReference: "area-sandton",
    });

    await expect(
      selectMarketplaceCheckoutDeliveryOptions({
        reference: "chk_ref_abc",
        owner,
        operation: {
          operationId: "op-quote-2",
          requestHash: "hash-quote-2",
          expectedVersion: 2,
        },
        selections: [
          {
            storeReference: "store-1",
            quoteReference: "quote-forged-or-stale", // Mismatched quote
            fulfilmentMode: "COURIER_DELIVERY",
          },
        ],
      }),
    ).rejects.toThrow(MarketplaceCheckoutError);
  });

  it("fails closed when destination address / service area is missing", async () => {
    const checkoutWithoutAddress = {
      ...mockCheckout,
      addressServiceAreaReference: null,
      addressSnapshot: null,
    };
    mockPrisma.marketplaceCheckout.findFirst.mockResolvedValueOnce(checkoutWithoutAddress);
    mockPrisma.marketplaceCheckoutOperation.findUnique.mockResolvedValueOnce(null);

    await expect(
      selectMarketplaceCheckoutDeliveryOptions({
        reference: "chk_ref_abc",
        owner,
        operation: {
          operationId: "op-quote-3",
          requestHash: "hash-quote-3",
          expectedVersion: 2,
        },
      }),
    ).rejects.toThrow(/destination address is required/i);
  });

  it("fails closed when expectedVersion does not match current checkout version", async () => {
    mockPrisma.marketplaceCheckout.findFirst.mockResolvedValueOnce(mockCheckout); // version 2

    await expect(
      selectMarketplaceCheckoutDeliveryOptions({
        reference: "chk_ref_abc",
        owner,
        operation: {
          operationId: "op-quote-4",
          requestHash: "hash-quote-4",
          expectedVersion: 1, // Stale version
        },
      }),
    ).rejects.toThrow(MarketplaceCheckoutError);
  });

  it("replays idempotent delivery selection when operationId matches same requestHash", async () => {
    mockPrisma.marketplaceCheckout.findFirst.mockResolvedValueOnce(mockCheckout);
    mockPrisma.marketplaceCheckoutOperation.findUnique.mockResolvedValueOnce({
      operationId: "op-quote-replay",
      requestHash: "hash-same",
    });

    const result = await selectMarketplaceCheckoutDeliveryOptions({
      reference: "chk_ref_abc",
      owner,
      operation: {
        operationId: "op-quote-replay",
        requestHash: "hash-same",
        expectedVersion: 2,
      },
    });

    expect(result).toBeDefined();
    expect(mockComposition.deliveryQuotes.quoteStoreGroup).not.toHaveBeenCalled();
  });
});
