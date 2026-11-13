import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ update: vi.fn(), budget: vi.fn(), operation: vi.fn(), movement: vi.fn() }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: vi.fn() }));
vi.mock("@/lib/promotions/promotion-budget.service", () => ({ recordBudgetMovement: mock.movement }));
vi.mock("@/lib/promotions/promotion-repositories", () => ({ lockCampaignVersions: vi.fn(), lockBudgets: vi.fn() }));
import { releaseCheckoutPromotions } from "@/lib/promotions/promotion-release.service";

beforeEach(() => vi.clearAllMocks());

it("never releases a committed reservation or changes its budget", async () => {
  const tx = { $queryRaw: vi.fn(), promotionReservation: { findMany: vi.fn(async () => [{ id: "reservation", campaignVersionId: "version", status: "COMMITTED", reservedDiscountAmount: "10", checkoutId: "checkout" }]), update: mock.update }, promotionBudget: { findMany: mock.budget }, promotionOperation: { create: mock.operation } };
  mock.budget.mockResolvedValueOnce([{ id: "budget", campaignVersionId: "version" }]);
  mock.operation.mockResolvedValueOnce({});
  const result = await releaseCheckoutPromotions({ reservationIds: ["reservation"], reason: "RESERVATION_EXPIRY", operationId: "op", requestHash: "hash", now: new Date() }, tx as never);
  expect(result.skippedIds).toContain("reservation");
  expect(mock.update).not.toHaveBeenCalled();
  expect(mock.movement).not.toHaveBeenCalled();
  expect(mock.operation).not.toHaveBeenCalled();
});

it("does not expire a reservation before its deadline", async () => {
  const tx = { $queryRaw: vi.fn(), promotionReservation: { findMany: vi.fn(async () => [{ id: "reservation", campaignVersionId: "version", status: "RESERVED", expiresAt: new Date("2030-01-01") }]), update: mock.update }, promotionBudget: { findMany: mock.budget }, promotionOperation: { create: mock.operation } };
  mock.operation.mockResolvedValueOnce({});
  const result = await releaseCheckoutPromotions({ reservationIds: ["reservation"], reason: "RESERVATION_EXPIRY", operationId: "op", requestHash: "hash", now: new Date("2026-01-01") }, tx as never);
  expect(result.skippedIds).toContain("reservation");
  expect(mock.update).not.toHaveBeenCalled();
  expect(mock.movement).not.toHaveBeenCalled();
  expect(mock.operation).not.toHaveBeenCalled();
});
