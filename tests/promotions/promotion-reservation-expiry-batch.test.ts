import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ select: vi.fn(), checkout: vi.fn(), release: vi.fn(), tx: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $queryRaw: mock.select, $transaction: mock.tx } }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: vi.fn() }));
vi.mock("@/lib/promotions/promotion-release.service", () => ({ releaseCheckoutPromotions: mock.release }));
import { expirePromotionReservations } from "@/lib/promotions/promotion-reservation-expiry-batch";

it("does not release a reservation when the checkout has a payment", async () => {
  mock.select.mockResolvedValueOnce([{ id: "reservation", checkoutId: "checkout" }]);
  mock.checkout.mockResolvedValueOnce({ status: "EXPIRED", payment: { id: "payment" } });
  mock.tx.mockImplementationOnce(async (fn) => fn({ $queryRaw: vi.fn(), marketplaceCheckout: { findUnique: mock.checkout } }));
  expect(await expirePromotionReservations({ apply: true })).toMatchObject({ examined: 1, released: 0, skipped: 1 });
  expect(mock.release).not.toHaveBeenCalled();
});

it("releases a due reservation through canonical budget authority for an unpaid expired checkout", async () => {
  mock.select.mockResolvedValueOnce([{ id: "reservation", checkoutId: "checkout" }]);
  mock.checkout.mockResolvedValueOnce({ status: "EXPIRED", payment: null });
  mock.release.mockResolvedValueOnce({ releasedIds: ["reservation"], alreadyReleasedIds: [], skippedIds: [] });
  mock.tx.mockImplementationOnce(async (fn) => fn({ $queryRaw: vi.fn(), marketplaceCheckout: { findUnique: mock.checkout } }));
  expect(await expirePromotionReservations({ apply: true })).toMatchObject({ examined: 1, released: 1, failed: 0 });
  expect(mock.release).toHaveBeenCalledWith(expect.objectContaining({ reservationIds: ["reservation"], reason: "RESERVATION_EXPIRY", operationId: "promotion-reservation-expiry:reservation" }), expect.anything());
});
