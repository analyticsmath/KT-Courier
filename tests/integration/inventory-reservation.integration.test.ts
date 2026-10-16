import { describe, expect, it } from "vitest";
import {
  reserveMarketplaceCheckoutInventory,
  releaseMarketplaceCheckoutReservation,
  type MarketplaceReservationRepository,
  type MarketplaceReservationState,
} from "@/lib/marketplace-checkout/inventory-reservation.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

describe("Phase 20 Marketplace Inventory Reservation Domain Tests", () => {
  it("rejects duplicate or invalid reservation lines", async () => {
    const fakeRepo: MarketplaceReservationRepository = {
      transaction: async (fn) => fn(),
      lockCheckout: async () => null,
      lockLevelsInStableOrder: async () => [],
      findActiveReservation: async () => null,
      lockReservationForRelease: async () => null,
      createReservation: async (r) => r,
      updateReservation: async (id, p) => ({
        id,
        checkoutId: "chk-1",
        status: "ACTIVE",
        commercialFingerprint: "fp-1",
        expiresAt: new Date(),
        items: [],
        ...p,
      }),
      applyLevelReservation: async () => {},
      applyLevelCommitment: async () => {},
      appendMovement: async () => {},
      updateCheckout: async () => {},
    };

    await expect(
      reserveMarketplaceCheckoutInventory(fakeRepo, {
        checkoutId: "chk-1",
        publicReference: "RES-1",
        commercialFingerprint: "fp-1",
        lines: [
          { lineReference: "l-1", inventoryLevelId: "inv-1", inventoryItemReference: "item-1", locationReference: "loc-1", quantity: 2 },
          { lineReference: "l-2", inventoryLevelId: "inv-1", inventoryItemReference: "item-1", locationReference: "loc-1", quantity: 1 },
        ],
        expiresAt: new Date(),
        operationId: "op-1",
      })
    ).rejects.toThrowError(MarketplaceCheckoutError);
  });

  it("enforces that checkout must be READY_FOR_REVIEW with matching accepted fingerprint", async () => {
    const fakeRepo: MarketplaceReservationRepository = {
      transaction: async (fn) => fn(),
      findActiveReservation: async () => null,
      lockCheckout: async () => ({
        id: "chk-1",
        status: "DRAFT", // not READY_FOR_REVIEW
        acceptedFingerprint: "fp-diff",
        reviewAcceptedAt: null,
      }),
      lockLevelsInStableOrder: async () => [],
      lockReservationForRelease: async () => null,
      createReservation: async (r) => r,
      updateReservation: async (id, p) => ({
        id,
        checkoutId: "chk-1",
        status: "ACTIVE",
        commercialFingerprint: "fp-1",
        expiresAt: new Date(),
        items: [],
        ...p,
      }),
      applyLevelReservation: async () => {},
      applyLevelCommitment: async () => {},
      appendMovement: async () => {},
      updateCheckout: async () => {},
    };

    await expect(
      reserveMarketplaceCheckoutInventory(fakeRepo, {
        checkoutId: "chk-1",
        publicReference: "RES-1",
        commercialFingerprint: "fp-expected",
        lines: [
          { lineReference: "l-1", inventoryLevelId: "inv-1", inventoryItemReference: "item-1", locationReference: "loc-1", quantity: 1 },
        ],
        expiresAt: new Date(),
        operationId: "op-1",
      })
    ).rejects.toThrowError(/An accepted current checkout review is required/i);
  });

  it("handles existing active reservation idempotently when fingerprint matches", async () => {
    const existing: MarketplaceReservationState = {
      id: "RES-EXISTING",
      checkoutId: "chk-1",
      status: "ACTIVE",
      commercialFingerprint: "fp-match",
      expiresAt: new Date(Date.now() + 60000),
      items: [{ lineReference: "l-1", inventoryLevelId: "inv-1", inventoryItemReference: "item-1", locationReference: "loc-1", quantity: 1 }],
    };

    const fakeRepo: MarketplaceReservationRepository = {
      transaction: async (fn) => fn(),
      findActiveReservation: async () => existing,
      lockCheckout: async () => null,
      lockLevelsInStableOrder: async () => [],
      lockReservationForRelease: async () => null,
      createReservation: async (r) => r,
      updateReservation: async (id, p) => ({
        id,
        checkoutId: "chk-1",
        status: "ACTIVE",
        commercialFingerprint: "fp-1",
        expiresAt: new Date(),
        items: [],
        ...p,
      }),
      applyLevelReservation: async () => {},
      applyLevelCommitment: async () => {},
      appendMovement: async () => {},
      updateCheckout: async () => {},
    };

    const result = await reserveMarketplaceCheckoutInventory(fakeRepo, {
      checkoutId: "chk-1",
      publicReference: "RES-NEW",
      commercialFingerprint: "fp-match",
      lines: [{ lineReference: "l-1", inventoryLevelId: "inv-1", inventoryItemReference: "item-1", locationReference: "loc-1", quantity: 1 }],
      expiresAt: new Date(),
      operationId: "op-1",
    });

    expect(result.id).toBe("RES-EXISTING");
    expect(result.status).toBe("ACTIVE");
  });

  it("fails release when reservation cannot be locked or is unavailable", async () => {
    const fakeRepo: MarketplaceReservationRepository = {
      transaction: async (fn) => fn(),
      findActiveReservation: async () => null,
      lockCheckout: async () => null,
      lockLevelsInStableOrder: async () => [],
      lockReservationForRelease: async () => null, // unavailable
      createReservation: async (r) => r,
      updateReservation: async (id, p) => ({
        id,
        checkoutId: "chk-1",
        status: "ACTIVE",
        commercialFingerprint: "fp-1",
        expiresAt: new Date(),
        items: [],
        ...p,
      }),
      applyLevelReservation: async () => {},
      applyLevelCommitment: async () => {},
      appendMovement: async () => {},
      updateCheckout: async () => {},
    };

    await expect(
      releaseMarketplaceCheckoutReservation(fakeRepo, {
        reservation: {
          id: "RES-1",
          checkoutId: "chk-1",
          status: "ACTIVE",
          commercialFingerprint: "fp-1",
          expiresAt: new Date(),
          items: [],
        },
        operationId: "op-rel-1",
        reason: "CHECKOUT_CANCELLED",
        paymentOutcomeKnown: true,
      })
    ).rejects.toThrowError(/Reservation is unavailable for release/i);
  });
});
