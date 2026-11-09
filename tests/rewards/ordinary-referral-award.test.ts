import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  transaction: vi.fn(), findOperator: vi.fn(), findEvent: vi.fn(), findStore: vi.fn(),
  findSetting: vi.fn(), findJournal: vi.fn(), updateEvent: vi.fn(), audit: vi.fn(),
  inspect: vi.fn(), policy: vi.fn(), wallet: vi.fn(), account: vi.fn(), post: vi.fn(),
}));
const tx = {
  user: { findUnique: m.findOperator },
  referralEvent: { findUnique: m.findEvent, updateMany: m.updateEvent },
  store: { findUnique: m.findStore },
  systemSetting: { findUnique: m.findSetting },
  ledgerJournal: { findUnique: m.findJournal },
  adminActivityLog: { create: m.audit },
};
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/lib/rewards/ordinary-referral-eligibility.service", () => ({
  inspectOrdinaryReferralEligibility: m.inspect,
}));
vi.mock("@/lib/rewards/customer-reward-configuration", () => ({
  loadCustomerRewardPolicy: m.policy,
}));
vi.mock("@/lib/services/wallet-account.service", () => ({
  ensureWalletForOwnerInTx: m.wallet,
  ensureLedgerAccountInTx: m.account,
}));
vi.mock("@/lib/services/ledger-posting.service", () => ({
  postLedgerJournalWithinTransaction: m.post,
}));
import { awardVerifiedOrdinaryReferral, OrdinaryReferralAwardError } from "@/lib/rewards/ordinary-referral-award.service";

const command = () => ({
  referralEventId: "event-1", actorUserId: "superadmin-1", operationId: "client-operation-001",
});
const event = () => ({
  id: "event-1", status: "PENDING", source: "ORDINARY_SIGNUP", targetUserId: "new-customer-1",
  referralCode: { ownerType: "CUSTOMER", ownerId: "referrer-1", metadata: { program: "ORDINARY_REFERRAL_V1" } },
  metadata: { program: "ORDINARY_REFERRAL_V1" },
});

beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation((callback: (t: typeof tx) => Promise<unknown>) => callback(tx));
  m.findOperator.mockResolvedValue({ role: "SUPER_ADMIN", status: "ACTIVE" });
  m.findEvent.mockResolvedValue(event());
  m.findSetting.mockResolvedValue({ type: "BOOLEAN", value: true });
  m.inspect.mockResolvedValue({
    eligible: true, reason: "VERIFIED_FIRST_PAID_ORDER",
    referralEventId: "event-1", qualifyingPaymentId: "payment-1",
  });
  m.policy.mockResolvedValue({ referralRewardZar: "5.00" });
  m.wallet.mockImplementation(async (_tx: unknown, input: { ownerType: string }) => ({
    id: input.ownerType === "PLATFORM" ? "platform-wallet" : "referrer-wallet",
  }));
  m.account.mockImplementation(async (_tx: unknown, input: { purpose: string }) => ({
    id: input.purpose === "PLATFORM_PROMOTION_EXPENSE" ? "expense-ledger" : "referral-credit-ledger",
  }));
  m.post.mockResolvedValue({ id: "journal-1", reference: "LJ-1" });
  m.updateEvent.mockResolvedValue({ count: 1 });
  m.audit.mockResolvedValue({});
  m.findStore.mockResolvedValue({ id: "store-1", ownerUserId: "store-owner-1" });
  m.findJournal.mockResolvedValue(null);
});

describe("verified ordinary first-paid-order referral wallet award", () => {
  it("credits an eligible customer with one balanced nonwithdrawable R5 journal and event receipt", async () => {
    const result = await awardVerifiedOrdinaryReferral(command());
    expect(result).toMatchObject({ status: "CREDITED", amountZar: "5.00", qualifyingPaymentId: "payment-1" });
    expect(m.inspect).toHaveBeenCalledWith("event-1", tx);
    expect(m.account).toHaveBeenCalledWith(tx, expect.objectContaining({
      purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY",
    }));
    expect(m.post).toHaveBeenCalledWith(tx, expect.objectContaining({
      actor: { kind: "USER", userId: "superadmin-1" },
      entries: [
        { accountId: "expense-ledger", direction: "DEBIT", amount: "5.00", lineCode: "REFERRAL-PLATFORM-EXPENSE" },
        { accountId: "referral-credit-ledger", direction: "CREDIT", amount: "5.00", lineCode: "REFERRER-WALLET-CREDIT" },
      ],
    }));
    expect(m.updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "event-1", status: "PENDING", source: "ORDINARY_SIGNUP" },
      data: expect.objectContaining({
        status: "REWARDED", metadata: expect.objectContaining({
          rewardJournalId: "journal-1", rewardAmountZar: "5.00",
          qualifyingPaymentId: "payment-1", recipientOwnerType: "CUSTOMER",
        }),
      }),
    }));
    expect(m.audit).toHaveBeenCalledTimes(1);
  });

  it("credits a store's separate nonwithdrawable referral account, never its withdrawable sales earnings", async () => {
    m.findEvent.mockResolvedValue({
      ...event(), referralCode: { ...event().referralCode, ownerType: "STORE", ownerId: "store-1" },
    });
    const result = await awardVerifiedOrdinaryReferral(command());
    expect(result.status).toBe("CREDITED");
    expect(m.account).toHaveBeenCalledWith(tx, expect.objectContaining({
      purpose: "STORE_REFERRAL_WALLET_AVAILABLE", category: "LIABILITY",
    }));
    expect(m.account).not.toHaveBeenCalledWith(tx, expect.objectContaining({
      purpose: "OWNER_WITHDRAWABLE",
    }));
  });

  it("refuses disabled issuing, incomplete first payment or missing finance evidence without posting", async () => {
    m.findSetting.mockResolvedValueOnce({ type: "BOOLEAN", value: false });
    await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "DISABLED" });
    expect(m.post).not.toHaveBeenCalled();

    m.inspect.mockResolvedValueOnce({
      eligible: false, reason: "REFUND_OR_DISPUTE", qualifyingPaymentId: "payment-1",
    });
    await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(m.wallet).not.toHaveBeenCalled();
    expect(m.post).not.toHaveBeenCalled();
  });

  it("rejects non-superadmin, inactive operators and self-awards", async () => {
    for (const op of [{ role: "ADMIN", status: "ACTIVE" }, { role: "SUPER_ADMIN", status: "INACTIVE" }]) {
      m.findOperator.mockResolvedValueOnce(op);
      await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    m.findEvent.mockResolvedValueOnce({ ...event(), targetUserId: command().actorUserId });
    await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    m.findEvent.mockResolvedValueOnce({
      ...event(), referralCode: { ...event().referralCode, ownerId: command().actorUserId },
    });
    await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.post).not.toHaveBeenCalled();
  });

  it("verifies an immutable journal and stable operation on replay without funding again", async () => {
    await awardVerifiedOrdinaryReferral(command());
    const updateCall = m.updateEvent.mock.calls[0]![0];
    m.findEvent.mockResolvedValue({
      ...event(), status: "REWARDED", metadata: updateCall.data.metadata,
    });
    const original = m.post.mock.calls[0]![1];
    m.findJournal.mockResolvedValue({
      id: "journal-1", reference: "LJ-1",
      sourceReference: original.sourceReference,
      idempotencyKey: original.idempotencyKey,
      metadata: original.metadata,
      type: "GENERAL", currency: "ZAR",
      totalDebits: new Prisma.Decimal("5.00"), totalCredits: new Prisma.Decimal("5.00"),
      entries: [
        { direction: "DEBIT", amount: new Prisma.Decimal("5.00"), account: {
          purpose: "PLATFORM_PROMOTION_EXPENSE", category: "EXPENSE",
          wallet: { ownerType: "PLATFORM", ownerId: "platform" },
        } },
        { direction: "CREDIT", amount: new Prisma.Decimal("5.00"), account: {
          purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY",
          wallet: { ownerType: "CUSTOMER", ownerId: "referrer-1" },
        } },
      ],
    });
    m.post.mockClear();
    const replay = await awardVerifiedOrdinaryReferral(command());
    expect(replay).toMatchObject({ status: "REPLAYED", amountZar: "5.00" });
    expect(m.post).not.toHaveBeenCalled();
    expect(m.inspect).toHaveBeenCalledTimes(1);

    await expect(awardVerifiedOrdinaryReferral({ ...command(), operationId: "different-operation-2" }))
      .rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
    expect(m.post).not.toHaveBeenCalled();

    const legitimate = await m.findJournal.mock.results[0]?.value;
    expect(legitimate).toBeDefined();
    const altered = { ...legitimate, totalCredits: new Prisma.Decimal("500.00") };
    m.findJournal.mockResolvedValueOnce(altered);
    await expect(awardVerifiedOrdinaryReferral(command()))
      .rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
    expect(m.post).not.toHaveBeenCalled();
  });

  it("fails closed on a changed event during the award transaction", async () => {
    m.updateEvent.mockResolvedValueOnce({ count: 0 });
    await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("refuses malformed operation IDs, cancelled events, absent store owner and zero-rate awards", async () => {
    await expect(awardVerifiedOrdinaryReferral({ ...command(), operationId: "x" }))
      .rejects.toBeInstanceOf(OrdinaryReferralAwardError);
    await expect(awardVerifiedOrdinaryReferral({ ...command(), operationId: undefined as unknown as string }))
      .rejects.toMatchObject({ code: "INVALID_EVENT" });
    m.findEvent.mockResolvedValueOnce({ ...event(), status: "CANCELLED" });
    await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    m.findEvent.mockResolvedValueOnce({
      ...event(), referralCode: { ...event().referralCode, ownerType: "STORE", ownerId: "store-1" },
    });
    m.findStore.mockResolvedValueOnce(null);
    await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    m.policy.mockResolvedValueOnce({ referralRewardZar: "0.00" });
    await expect(awardVerifiedOrdinaryReferral(command())).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(m.post).not.toHaveBeenCalled();
  });
});
