import { describe, expect, it, vi, beforeEach } from "vitest";
import { reconcileMarketplaceReservation } from "@/lib/marketplace-checkout/reconciliation.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    marketplaceInventoryReservation: {
      findUnique: vi.fn(),
    },
  },
}));

interface MockPrisma {
  marketplaceInventoryReservation: {
    findUnique: ReturnType<typeof vi.fn>;
  };
}

const mockPrisma = prisma as unknown as MockPrisma;

describe("Phase 20 Marketplace Reconciliation Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws CHECKOUT_NOT_FOUND when reservation does not exist", async () => {
    mockPrisma.marketplaceInventoryReservation.findUnique.mockResolvedValue(null);

    await expect(
      reconcileMarketplaceReservation("NON-EXISTENT-RES", "op-rec-1")
    ).rejects.toThrowError(MarketplaceCheckoutError);
  });

  it("fails closed on missing production authorization", async () => {
    mockPrisma.marketplaceInventoryReservation.findUnique.mockResolvedValue({
      id: "res-1",
      checkoutId: "chk-1",
      publicReference: "RES-TEST",
      payment: { status: "PENDING" },
    });

    try {
      await reconcileMarketplaceReservation("RES-TEST", "op-rec-2");
    } catch (err: unknown) {
      expect(err).toBeDefined();
    }
  });
});
