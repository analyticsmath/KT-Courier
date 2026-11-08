import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/promotions/production-lock", () => ({
  assertPromotionsProductionReady: vi.fn(),
}));
vi.mock("@/lib/promotions/promotion-repositories", () => ({
  lockCheckout: vi.fn(async () => {}),
  lockCustomer: vi.fn(async () => {}),
  lockCampaignVersions: vi.fn(async () => {}),
  lockCodes: vi.fn(async () => {}),
  lockBudgets: vi.fn(async () => {}),
}));
vi.mock("@/lib/promotions/promotion-budget.service", () => ({
  recordBudgetMovement: vi.fn(async () => {}),
}));

import {
  reserveCheckoutPromotions, type ReservationInput, type ReservationRecord,
} from "@/lib/promotions/promotion-reservation.service";
import type {
  AppliedPromotion, PromotionEvaluationResult,
} from "@/lib/promotions/promotion-evaluation.service";

const dec = (amount: string) => new Prisma.Decimal(amount);
const applied = (id: string): AppliedPromotion => ({
  campaignVersionId: id, campaignId: "campaign-" + id, publicReference: "PROMO-" + id,
  applicationMethod: "AUTOMATIC", discountScope: "ORDER",
  calculatedDiscount: dec("5.00"), fundingType: "PLATFORM",
  platformFundingShareBps: null, customerFacingTitle: "Test-only offer",
  campaignName: "Test-only campaign", category: "AUTOMATIC_MERCHANDISE",
  allocations: [], platformFunding: dec("5.00"), storeFunding: dec("0.00"),
});
const buildInput = (names = ["ordinary"]): ReservationInput => {
  const promotions = names.map(applied);
  const evaluationResult: PromotionEvaluationResult = {
    eligible: promotions, applied: promotions, rejected: [],
    stackingEvidence: {
      selectedPromotionIds: names, rejectedPromotionIds: [], rejectionReasons: {},
    },
    totalDiscount: dec(String(names.length * 5) + ".00"),
    totalPlatformFunding: dec(String(names.length * 5) + ".00"),
    totalStoreFunding: dec("0.00"), allocations: [],
  };
  return {
    checkoutId: "checkout-1", checkoutReviewVersion: 4,
    customerUserId: "customer-1", evaluationResult, appliedPromotions: promotions,
    operationId: "promotion-command-1", requestHash: "digest-one",
    now: new Date("2026-11-08T10:00:00.000Z"),
  };
};

function mockTransaction(input: ReservationInput) {
  const stored: ReservationRecord[] = [];
  const database = {
    promotionOperation: {
      findUnique: vi.fn(async () => null as null | { operationType: string; requestHash: string }),
      create: vi.fn(async () => ({ id: "operation-1" })),
    },
    promotionReservation: {
      findMany: vi.fn(async () => [] as ReservationRecord[]),
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: ReservationRecord }) => {
        stored.push(data);
        return data;
      }),
    },
    promotionCampaignVersion: { count: vi.fn(async () => 0) },
    marketplaceOrder: { count: vi.fn(async () => 0) },
    promotionRedemption: { count: vi.fn(async () => 0) },
    promotionCode: { findMany: vi.fn(async () => []) },
    promotionBudget: {
      findMany: vi.fn(async () => input.appliedPromotions.map(p => ({
        id: "budget-" + p.campaignVersionId,
        campaignVersionId: p.campaignVersionId,
      }))),
    },
  };
  return { tx: database as unknown as Prisma.TransactionClient, database, stored };
}

describe("promotion reservation financial authority and multi-campaign idempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not treat every ordinary offer as first-order-only", async () => {
    const input = buildInput(), { tx, database } = mockTransaction(input);
    const result = await reserveCheckoutPromotions(input, tx);
    expect(result.reservationIds).toHaveLength(1);
    expect(database.promotionCampaignVersion.count).toHaveBeenCalledWith({
      where: { id: { in: ["ordinary"] }, eligibility: { some: { rule: "FIRST_MARKETPLACE_ORDER" } } },
    });
    expect(database.marketplaceOrder.count).not.toHaveBeenCalled();
    expect(database.promotionReservation.create).toHaveBeenCalledTimes(1);
  });

  it("rejects first-order claims when a real source-verified order already exists", async () => {
    const input = buildInput(["welcome"]), { tx, database } = mockTransaction(input);
    database.promotionCampaignVersion.count.mockResolvedValue(1);
    database.marketplaceOrder.count.mockResolvedValue(1);
    await expect(reserveCheckoutPromotions(input, tx)).rejects.toThrow("already has a paid marketplace order");
    expect(database.marketplaceOrder.count).toHaveBeenCalledWith({
      where: {
        customerUserId: "customer-1", status: "CONFIRMED",
        payment: { status: "SUCCEEDED", successLedgerJournalId: { not: null } },
      },
    });
    expect(database.promotionReservation.create).not.toHaveBeenCalled();
  });

  it("serializes an outstanding first-order claim even before payment", async () => {
    const input = buildInput(["welcome"]), { tx, database } = mockTransaction(input);
    database.promotionCampaignVersion.count.mockResolvedValue(1);
    database.promotionReservation.count.mockResolvedValue(1);
    await expect(reserveCheckoutPromotions(input, tx)).rejects.toThrow("promotion claim");
    expect(database.promotionReservation.count).toHaveBeenCalledWith({
      where: {
        customerUserId: "customer-1", status: "RESERVED",
        expiresAt: { gt: input.now },
        campaignVersion: { eligibility: { some: { rule: "FIRST_MARKETPLACE_ORDER" } } },
      },
    });
  });

  it("preserves once-only rules after refund and blocks unauthenticated claims", async () => {
    const input = buildInput(["welcome"]), { tx, database } = mockTransaction(input);
    database.promotionCampaignVersion.count.mockResolvedValue(1);
    database.promotionRedemption.count.mockResolvedValue(1);
    await expect(reserveCheckoutPromotions(input, tx)).rejects.toThrow("promotion claim");
    expect(database.promotionRedemption.count).toHaveBeenCalledWith({
      where: {
        customerUserId: "customer-1",
        campaignVersion: { eligibility: { some: { rule: "FIRST_MARKETPLACE_ORDER" } } },
      },
    });
    await expect(reserveCheckoutPromotions({ ...input, customerUserId: undefined }, tx))
      .rejects.toThrow("authenticated customer");
  });

  it("idempotent replay happens before self-conflicting first-order claim checks", async () => {
    const input = buildInput(["welcome"]), { tx, database } = mockTransaction(input);
    const expiry = new Date("2026-11-08T10:20:00.000Z");
    const previous = {
      id: "reservation-original", publicReference: "ORIGINAL", campaignVersionId: "welcome",
      promotionCodeId: null, checkoutId: input.checkoutId,
      checkoutReviewVersion: input.checkoutReviewVersion, customerUserId: input.customerUserId!,
      status: "RESERVED" as const, reservedDiscountAmount: dec("5.00"),
      reservedPlatformFunding: dec("5.00"), reservedStoreFunding: dec("0.00"),
      expiresAt: expiry, operationId: input.operationId, requestHash: input.requestHash,
    };
    database.promotionOperation.findUnique.mockResolvedValue({
      operationType: "RESERVATION", requestHash: input.requestHash,
    });
    database.promotionReservation.findMany.mockResolvedValue([previous]);
    const replayed = await reserveCheckoutPromotions(input, tx);
    expect(replayed.reservationIds).toEqual(["reservation-original"]);
    expect(replayed.expiresAt).toEqual(expiry);
    expect(database.promotionCampaignVersion.count).not.toHaveBeenCalled();
    expect(database.promotionReservation.create).not.toHaveBeenCalled();
    expect(database.promotionOperation.create).not.toHaveBeenCalled();
    // Even equal request hashes cannot reuse a reservation across tenants.
    await expect(reserveCheckoutPromotions({ ...input, checkoutId: "checkout-attacker" }, tx))
      .rejects.toThrow("different, expired or changed");
    await expect(reserveCheckoutPromotions({ ...input, now: expiry }, tx))
      .rejects.toThrow("different, expired or changed");
  });

  it("one operation can reserve two different campaign versions exactly once", async () => {
    const input = buildInput(["automatic", "code"]), { tx, database, stored } = mockTransaction(input);
    const result = await reserveCheckoutPromotions(input, tx);
    expect(result.reservationIds).toHaveLength(2);
    expect(new Set(stored.map(row => row.campaignVersionId))).toEqual(new Set(["automatic", "code"]));
    expect(stored.every(row => row.operationId === input.operationId)).toBe(true);
    expect(database.promotionOperation.create).toHaveBeenCalledTimes(1);
  });

  it("rejects changed financial evaluation before writing any reservation", async () => {
    const input = buildInput(["ordinary"]), { tx, database } = mockTransaction(input);
    const modified = {
      ...input, appliedPromotions: [{ ...input.appliedPromotions[0], platformFunding: dec("0.00") }],
    };
    await expect(reserveCheckoutPromotions(modified, tx)).rejects.toThrow("does not match evaluated");
    expect(database.promotionReservation.create).not.toHaveBeenCalled();
  });
});
