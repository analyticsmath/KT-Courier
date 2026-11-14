import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/promotions/production-lock", () => ({
  assertPromotionsProductionReady: vi.fn(),
}));
vi.mock("@/lib/promotions/promotion-budget.service", () => ({
  recordBudgetMovement: vi.fn(),
}));
vi.mock("@/lib/services/ledger-posting.service", () => ({
  postLedgerJournalWithinTransaction: vi.fn(),
}));
vi.mock("@/lib/services/wallet-account.service", () => ({
  ensureWalletForOwnerInTx: vi.fn(async () => ({ id: "wallet-1" })),
  ensureLedgerAccountInTx: vi.fn(async (_tx, input) => ({ id: input.purpose === "HELD" ? "account-held" : "account-expense" })),
}));

import { commitMarketplacePromotionRedemptions, type RedemptionCommitInput } from "@/lib/promotions/promotion-redemption.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { normalizeLedgerPosting } from "@/lib/ledger/posting-normalization";

const money = (value: string) => new Prisma.Decimal(value);
const payment = () => ({
  id: "pay-1", marketplaceCheckoutId: "ck-1", marketplaceOrderId: "order-1",
  createdAt: new Date("2026-11-08T11:00:00Z"),
  subjectType: "MARKETPLACE_CHECKOUT", status: "SUCCEEDED", currency: "ZAR",
  amount: money("50.00"),
  successfulAttempt: { status: "SUCCEEDED", amount: money("50.00") },
  successWebhookEvent: {
    processingStatus: "APPLIED", signatureVerified: true, merchantVerified: true,
    amountVerified: true, providerDataVerified: true,
  },
  successLedgerJournal: {
    type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR",
    totalDebits: money("50.00"), totalCredits: money("50.00"),
    entries: [
      { direction: "DEBIT", amount: money("50.00"), account: { code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET" } },
      { direction: "CREDIT", amount: money("50.00"), account: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY" } },
    ],
  },
});
const input = (): RedemptionCommitInput => ({
  checkoutId: "ck-1", checkoutReviewVersion: 2,
  acknowledgementFingerprint: "fingerprint-accepted",
  paymentId: "pay-1", paymentStatus: "SUCCEEDED", marketplaceOrderId: "order-1",
  reservationIds: ["res-1"], operationId: "commit-1", requestHash: "digest-commit",
  now: new Date("2026-11-08T12:00:00Z"),
  frozenEvaluation: {
    eligible: [], applied: [], rejected: [],
    stackingEvidence: { selectedPromotionIds: [], rejectedPromotionIds: [], rejectionReasons: {} },
    totalDiscount: money("0.00"), totalPlatformFunding: money("0.00"),
    totalStoreFunding: money("0.00"), allocations: [],
  },
});

function database() {
  const tx = {
    marketplaceCheckout: { findUnique: vi.fn(async () => ({
      id: "ck-1", customerUserId: "customer-1", reviewVersion: 2,
      acceptedFingerprint: "fingerprint-accepted", reviewAcceptedAt: new Date(),
      digitalRequired: money("50.00"), grandTotal: money("50.00"),
    })) },
    marketplaceOrder: { findUnique: vi.fn(async () => ({
      id: "order-1", checkoutId: "ck-1", paymentId: "pay-1",
      customerUserId: "customer-1", status: "CONFIRMED",
      commercialFingerprint: "fingerprint-accepted",
      cashRequired: money("0.00"), digitalRequired: money("50.00"),
    })) },
    payment: { findUnique: vi.fn(async () => payment()) },
    promotionRedemption: { findMany: vi.fn(async () => [] as unknown[]) },
    promotionReservation: { findMany: vi.fn() },
    promotionOperation: { create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return tx;
}
const asTx = (tx: ReturnType<typeof database>): Prisma.TransactionClient =>
  tx as unknown as Prisma.TransactionClient;

describe("promotion commitment provider and marketplace source authority", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a fabricated caller success flag when provider payment is not successful", async () => {
    const tx = database();
    tx.payment.findUnique.mockResolvedValue({ ...payment(), status: "CREATED" });
    await expect(commitMarketplacePromotionRedemptions(input(), asTx(tx)))
      .rejects.toThrow("source-bound verified digital receipt");
    expect(tx.promotionRedemption.findMany).not.toHaveBeenCalled();
    expect(postLedgerJournalWithinTransaction).not.toHaveBeenCalled();
  });

  it("rejects a success receipt with the wrong held-funds ledger account", async () => {
    const tx = database(), p = payment();
    p.successLedgerJournal.entries[1].account.code = "UNTRUSTED-ACCOUNT";
    tx.payment.findUnique.mockResolvedValue(p);
    await expect(commitMarketplacePromotionRedemptions(input(), asTx(tx)))
      .rejects.toThrow("source-bound verified digital receipt");
    expect(postLedgerJournalWithinTransaction).not.toHaveBeenCalled();
  });

  it("rejects a stale accepted fingerprint and a crossed merchant checkout", async () => {
    const tx = database();
    await expect(commitMarketplacePromotionRedemptions({
      ...input(), acknowledgementFingerprint: "changed-after-approval",
    }, asTx(tx))).rejects.toThrow("source-owned accepted checkout");
    tx.marketplaceOrder.findUnique.mockResolvedValue({
      ...await tx.marketplaceOrder.findUnique(), checkoutId: "other-user-checkout",
    });
    await expect(commitMarketplacePromotionRedemptions(input(), asTx(tx)))
      .rejects.toThrow("source-owned accepted checkout");
    expect(postLedgerJournalWithinTransaction).not.toHaveBeenCalled();
  });

  it("rejects duplicate reservation IDs before any payment or ledger calls", async () => {
    const tx = database();
    await expect(commitMarketplacePromotionRedemptions({
      ...input(), reservationIds: ["res-1", "res-1"],
    }, asTx(tx))).rejects.toThrow("distinct reservation evidence");
    expect(tx.payment.findUnique).not.toHaveBeenCalled();
  });

  it("replays an already committed source-matched redemption without funding it twice", async () => {
    const tx = database();
    tx.promotionRedemption.findMany.mockResolvedValue([{
      id: "redemption-1", publicReference: "PROMO-REDEMPTION-1",
      campaignVersionId: "campaign-1", promotionCodeId: null,
      reservationId: "res-1", checkoutId: "ck-1", marketplaceOrderId: "order-1",
      customerUserId: "customer-1", status: "COMMITTED",
      discountAmount: money("5.00"), platformFunding: money("5.00"), storeFunding: money("0.00"),
      operationId: "commit-1", requestHash: "digest-commit",
    }]);
    const result = await commitMarketplacePromotionRedemptions(input(), asTx(tx));
    expect(result.redemptions).toHaveLength(1);
    expect(result.redemptions[0].id).toBe("redemption-1");
    expect(postLedgerJournalWithinTransaction).not.toHaveBeenCalled();
    await expect(commitMarketplacePromotionRedemptions({
      ...input(), reservationIds: ["somebody-elses-reservation"],
    }, asTx(tx))).rejects.toThrow("replay does not match");
  });

  it("submits a ledger-valid, balanced subsidy for a verified redemption", async () => {
    const tx = database();
    const reservation = { id: "res-1", publicReference: "reservation-ref", campaignVersionId: "campaign-1", checkoutId: "ck-1", checkoutReviewVersion: 2, customerUserId: "customer-1", status: "RESERVED", createdAt: new Date("2026-11-08T10:00:00Z"), expiresAt: new Date("2027-01-01"), promotionCodeId: null, reservedDiscountAmount: money("5.00"), reservedPlatformFunding: money("5.00"), reservedStoreFunding: money("0.00"), allocationEvidence: [{ lineReference: "line-1", storeGroupReference: "group-1", allocationType: "MERCHANDISE", basisAmount: "20.00", discountAmount: "5.00", platformFunding: "5.00", storeFunding: "0.00" }] };
    tx.promotionReservation.findMany.mockResolvedValue([reservation] as never);
    Object.assign(tx, {
      promotionBudget: { findMany: vi.fn(async () => [{ id: "budget-1", campaignVersionId: "campaign-1" }]) },
      promotionEventIntent: { create: vi.fn() },
      promotionFinancialAllocation: { createMany: vi.fn() },
      marketplaceCheckoutStoreGroup: { findMany: vi.fn(async () => [{ id: "group-1", storeId: "store-1", deliveryFee: money("0.00"), lines: [{ id: "line-1", lineTotal: money("20.00") }] }]) },
    });
    Object.assign(tx.promotionRedemption, { create: vi.fn() });
    Object.assign(tx.promotionReservation, { update: vi.fn() });
    const request = input();
    request.frozenEvaluation.applied = [{ campaignVersionId: "campaign-1", calculatedDiscount: money("5.00"), platformFunding: money("5.00"), storeFunding: money("0.00") }] as typeof request.frozenEvaluation.applied;
    await commitMarketplacePromotionRedemptions(request, asTx(tx));
    const posting = vi.mocked(postLedgerJournalWithinTransaction).mock.calls[0][1];
    const normalized = normalizeLedgerPosting(posting);
    expect(normalized.sourceReference).toMatch(/^PROMO:[A-F0-9]{64}$/);
    expect(normalized.totalDebits.toString()).toBe(normalized.totalCredits.toString());
    expect((tx as unknown as { promotionFinancialAllocation: { createMany: ReturnType<typeof vi.fn> } }).promotionFinancialAllocation.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ lineReference: "line-1", storeGroupReference: "group-1" })] }));
  });
});
