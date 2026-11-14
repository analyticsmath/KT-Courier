import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rows: vi.fn(), checkout: vi.fn(), order: vi.fn(), reservation: vi.fn(), finalize: vi.fn(), gate: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { promotionReservation: { findMany: mock.rows, findUnique: mock.reservation }, marketplaceCheckout: { findUnique: mock.checkout }, marketplaceOrder: { findUnique: mock.order } } }));
vi.mock("@/lib/marketplace-checkout/marketplace-payment-success-hook.service", () => ({ onVerifiedMarketplacePaymentSucceededInProduction: mock.finalize }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
import { recoverPromotionCommitments } from "@/lib/promotions/promotion-commit-recovery";

beforeEach(() => {
  vi.resetAllMocks();
  mock.rows.mockResolvedValue([{ id: "r", checkoutId: "c" }]);
  mock.checkout.mockResolvedValue({ status: "RECONCILIATION_REQUIRED", marketplaceOrder: null, payment: { id: "p", status: "SUCCEEDED", subjectType: "MARKETPLACE_CHECKOUT" } });
  mock.order.mockResolvedValue({ id: "o", paymentId: "p" });
  mock.reservation.mockResolvedValue({ status: "COMMITTED", redemption: { marketplaceOrderId: "o" } });
});

it("dry-runs without invoking the finalizer", async () => {
  expect(await recoverPromotionCommitments()).toMatchObject({ examined: 1, eligible: 1, completed: 0, failed: 0 });
  expect(mock.finalize).not.toHaveBeenCalled();
});

it("retries once per checkout and confirms the durable source-bound redemption", async () => {
  mock.rows.mockResolvedValue([{ id: "r", checkoutId: "c" }, { id: "r2", checkoutId: "c" }]);
  expect(await recoverPromotionCommitments({ apply: true })).toMatchObject({ examined: 2, eligible: 1, completed: 1, failed: 0 });
  expect(mock.gate).toHaveBeenCalledWith("COMMITMENT");
  expect(mock.finalize).toHaveBeenCalledOnce();
  expect(mock.finalize).toHaveBeenCalledWith("p");
});

it("does not claim completion when the finalizer did not commit the reservation", async () => {
  mock.reservation.mockResolvedValue({ status: "RESERVED", redemption: null });
  expect(await recoverPromotionCommitments({ apply: true })).toMatchObject({ eligible: 1, completed: 0, failed: 1 });
});

it("skips unverified payments and already-created orders", async () => {
  mock.checkout.mockResolvedValueOnce({ status: "RECONCILIATION_REQUIRED", marketplaceOrder: null, payment: { id: "p", status: "PENDING", subjectType: "MARKETPLACE_CHECKOUT" } }).mockResolvedValueOnce({ status: "RECONCILIATION_REQUIRED", marketplaceOrder: { id: "o" }, payment: { id: "p", status: "SUCCEEDED", subjectType: "MARKETPLACE_CHECKOUT" } });
  expect(await recoverPromotionCommitments({ apply: true })).toMatchObject({ eligible: 0 });
  expect(await recoverPromotionCommitments({ apply: true })).toMatchObject({ eligible: 0 });
  expect(mock.finalize).not.toHaveBeenCalled();
});
