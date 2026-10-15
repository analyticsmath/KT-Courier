import { beforeEach, describe, expect, it, vi } from "vitest";
import { expireMarketplaceCheckoutReservation, releaseMarketplaceCheckoutReservation, type MarketplaceReservationRepository, type MarketplaceReservationState } from "@/lib/marketplace-checkout/inventory-reservation.service";

describe("reservation expiry rechecks current payment authority", () => {
  const candidate: MarketplaceReservationState = { id: "reservation", checkoutId: "checkout", status: "ACTIVE", commercialFingerprint: "fingerprint", expiresAt: new Date(0), items: [{ lineReference: "line", inventoryLevelId: "level", inventoryItemReference: "item", locationReference: "location", quantity: 2 }] };
  let current: MarketplaceReservationState, paymentStatus: string | null, known: boolean, inside: boolean;
  const releaseStock = vi.fn(), movement = vi.fn(), checkout = vi.fn(), receipt = vi.fn();
  const repository: MarketplaceReservationRepository = {
    transaction: async work => { expect(inside).toBe(false); inside = true; try { return await work(); } finally { inside = false; } },
    lockReservationForRelease: async () => { expect(inside).toBe(true); return { reservation: current, paymentStatus, paymentOutcomeKnown: known }; },
    lockCheckout: vi.fn(), lockLevelsInStableOrder: vi.fn().mockResolvedValue([]), findActiveReservation: vi.fn(), createReservation: vi.fn(),
    updateReservation: async (_id, patch) => (current = { ...current, ...patch }),
    applyLevelReservation: releaseStock, appendMovement: movement, updateCheckout: checkout, completeOperation: receipt, applyLevelCommitment: vi.fn(),
  };
  beforeEach(() => { current = { ...candidate }; paymentStatus = null; known = true; inside = false; });
  it.each(["PAYMENT_PENDING_HOLD", "PAYMENT_UNCERTAIN", "CONSUMED"] as const)("keeps inventory held when payment preparation/finalization changed the candidate to %s", async status => {
    current = { ...candidate, status, paymentId: "payment" }; paymentStatus = status === "CONSUMED" ? "SUCCEEDED" : "PROCESSING";
    expect(await expireMarketplaceCheckoutReservation(repository, candidate, new Date(), "expiry")).toBeNull();
    expect(releaseStock).not.toHaveBeenCalled(); expect(checkout).not.toHaveBeenCalled();
  });
  it.each(["CREATED", "REQUIRES_ACTION", "PROCESSING", "PROVIDER_PENDING", "SUCCEEDED"])("refuses expiry after checkout payment becomes %s while reservation still reads ACTIVE", async status => {
    paymentStatus = status; known = !["PROCESSING", "PROVIDER_PENDING"].includes(status);
    expect(await expireMarketplaceCheckoutReservation(repository, candidate, new Date(), "expiry")).toBeNull(); expect(releaseStock).not.toHaveBeenCalled();
  });
  it("does not trust the cancellation caller's stale claim that payment definitely failed", async () => {
    paymentStatus = "SUCCEEDED";
    await expect(releaseMarketplaceCheckoutReservation(repository, { reservation: candidate, operationId: "cancel", reason: "CHECKOUT_CANCELLED", paymentOutcomeKnown: true, paymentStatus: "FAILED" })).rejects.toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });
    expect(releaseStock).not.toHaveBeenCalled();
  });
  it("releases an abandoned reservation once using locked current quantities, then replays without inventory mutation", async () => {
    current = { ...candidate, items: [{ ...candidate.items[0], quantity: 1 }] };
    expect(await expireMarketplaceCheckoutReservation(repository, candidate, new Date(), "expiry")).toMatchObject({ status: "EXPIRED" });
    expect(await expireMarketplaceCheckoutReservation(repository, candidate, new Date(), "expiry")).toMatchObject({ status: "EXPIRED" });
    expect(releaseStock).toHaveBeenCalledExactlyOnceWith("level", -1); expect(movement).toHaveBeenCalledOnce(); expect(receipt).toHaveBeenCalledOnce();
  });
  it("honours a freshly extended reservation expiry instead of the candidate timestamp", async () => {
    current = { ...candidate, expiresAt: new Date(Date.now() + 60_000) };
    expect(await expireMarketplaceCheckoutReservation(repository, candidate, new Date(), "expiry")).toBeNull(); expect(releaseStock).not.toHaveBeenCalled();
  });
  it("allows release after the canonical payment has definitely failed", async () => {
    paymentStatus = "FAILED";
    expect(await expireMarketplaceCheckoutReservation(repository, candidate, new Date(), "expiry")).toMatchObject({ status: "EXPIRED" }); expect(releaseStock).toHaveBeenCalledOnce();
  });
});
