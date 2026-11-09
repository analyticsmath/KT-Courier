import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  tx: vi.fn(), operator: vi.fn(), event: vi.fn(), journal: vi.fn(), payment: vi.fn(),
  updateEvent: vi.fn(), audit: vi.fn(), refund: vi.fn(), verifyAward: vi.fn(),
  post: vi.fn(),
}));
const tx = {
  user: { findUnique: m.operator },
  referralEvent: { findUnique: m.event, updateMany: m.updateEvent },
  ledgerJournal: { findUnique: m.journal },
  payment: { findUnique: m.payment },
  paymentRefund: { findFirst: m.refund },
  adminActivityLog: { create: m.audit },
};
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: m.tx } }));
vi.mock("@/lib/services/ledger-posting.service", () => ({
  postLedgerJournalWithinTransaction: m.post,
}));
vi.mock("@/lib/rewards/ordinary-referral-ledger-evidence", () => ({
  ORDINARY_REFERRAL_LEDGER_INCLUDE: {},
  verifyOrdinaryReferralAwardJournal: m.verifyAward,
}));
import { reverseRefundedOrdinaryReferral } from "@/lib/rewards/ordinary-referral-reversal.service";

const command = () => ({
  referralEventId: "referral-event-1", actorUserId: "super-admin",
  operationId: "reversal-command-001",
});
const rewarded = () => ({
  id: "referral-event-1", source: "ORDINARY_SIGNUP", status: "REWARDED",
  targetUserId: "new-customer",
  metadata: { rewardJournalId: "reward-journal" },
  referralCode: { ownerId: "referrer-1", ownerType: "CUSTOMER" },
});
const original = () => ({
  id: "reward-journal", reference: "LJ-REWARD-1", reversalOfJournalId: null,
  reversalJournal: null,
  entries: [
    { accountId: "expense-ledger", direction: "DEBIT", amount: new Prisma.Decimal("5.00"),
      lineCode: "REFERRAL-PLATFORM-EXPENSE", memo: null },
    { accountId: "wallet-ledger", direction: "CREDIT", amount: new Prisma.Decimal("5.00"),
      lineCode: "REFERRER-WALLET-CREDIT", memo: null },
  ],
});

beforeEach(() => {
  vi.resetAllMocks();
  m.tx.mockImplementation((cb: (client: typeof tx) => Promise<unknown>) => cb(tx));
  m.operator.mockResolvedValue({ role: "SUPER_ADMIN", status: "ACTIVE" });
  m.event.mockResolvedValue(rewarded());
  m.journal.mockResolvedValue(original());
  m.verifyAward.mockReturnValue({ amountZar: "5.00", qualifyingPaymentId: "payment-1" });
  m.payment.mockResolvedValue({
    id: "payment-1", userId: "new-customer", purpose: "ORDER", subjectType: "COURIER_ORDER",
    totalRefundedAmount: new Prisma.Decimal("10.00"), disputes: [],
  });
  m.refund.mockResolvedValue({ id: "completed-refund-1" });
  m.post.mockResolvedValue({ id: "reversal-journal", reference: "LJ-REVERSAL-1" });
  m.updateEvent.mockResolvedValue({ count: 1 });
  m.audit.mockResolvedValue({});
});

describe("finance-controlled source-refunded referral reversal", () => {
  it("inverts the original two ledger legs and persists the reversal with status in one transaction", async () => {
    const result = await reverseRefundedOrdinaryReferral(command());
    expect(result).toMatchObject({ status: "REVERSED", journalId: "reversal-journal" });
    expect(m.verifyAward).toHaveBeenCalledWith(expect.objectContaining({ id: "referral-event-1" }),
      expect.objectContaining({ id: "reward-journal" }), expect.any(String));
    expect(m.payment).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-1" },
    }));
    expect(m.post).toHaveBeenCalledWith(tx, expect.objectContaining({
      type: "REVERSAL", reversalOfJournalId: "reward-journal",
      actor: { kind: "USER", userId: "super-admin" },
      entries: [
        expect.objectContaining({ accountId: "expense-ledger", direction: "CREDIT", amount: "5.00" }),
        expect.objectContaining({ accountId: "wallet-ledger", direction: "DEBIT", amount: "5.00" }),
      ],
    }));
    expect(m.updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "referral-event-1", status: "REWARDED", source: "ORDINARY_SIGNUP" },
      data: expect.objectContaining({
        status: "CANCELLED", metadata: expect.objectContaining({
          rewardReversalJournalId: "reversal-journal", reversalCause: "SOURCE_REFUND_OR_DISPUTE",
        }),
      }),
    }));
    expect(m.audit).toHaveBeenCalledTimes(1);
  });

  it("rejects uncompleted refund reservations and clean orders", async () => {
    m.payment.mockResolvedValueOnce({
      id: "payment-1", userId: "new-customer", purpose: "ORDER", subjectType: "COURIER_ORDER",
      totalRefundedAmount: new Prisma.Decimal("0.00"), disputes: [],
    });
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    m.refund.mockResolvedValueOnce(null);
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(m.post).not.toHaveBeenCalled();
  });

  it("requires source ownership and permits reversal for a real payment dispute", async () => {
    m.payment.mockResolvedValueOnce({
      id: "payment-1", userId: "different-customer", purpose: "ORDER", subjectType: "COURIER_ORDER",
      totalRefundedAmount: new Prisma.Decimal("50.00"), disputes: [],
    });
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    m.payment.mockResolvedValueOnce({
      id: "payment-1", userId: "new-customer", purpose: "ORDER", subjectType: "COURIER_ORDER",
      totalRefundedAmount: new Prisma.Decimal("0.00"), disputes: [{ id: "dispute-1" }],
    });
    expect((await reverseRefundedOrdinaryReferral(command())).status).toBe("REVERSED");
  });

  it("refuses non-superadmin and beneficiary-initiated reversal", async () => {
    m.operator.mockResolvedValueOnce({ role: "ADMIN", status: "ACTIVE" });
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    m.event.mockResolvedValueOnce({ ...rewarded(), targetUserId: command().actorUserId });
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    m.event.mockResolvedValueOnce({ ...rewarded(), referralCode: { ownerId: command().actorUserId, ownerType: "CUSTOMER" } });
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.post).not.toHaveBeenCalled();
  });

  it("never changes referral status if wallet reversal fails for insufficient balance", async () => {
    m.post.mockRejectedValueOnce(new Error("LEDGER_NEGATIVE_BALANCE"));
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toThrow("LEDGER_NEGATIVE_BALANCE");
    expect(m.updateEvent).not.toHaveBeenCalled();
  });

  it("rejects original journal conflicts and already reversed ledger postings", async () => {
    m.verifyAward.mockImplementationOnce(() => { throw Error("invalid wallet owner"); });
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
    m.journal.mockResolvedValueOnce({ ...original(), reversalJournal: { id: "foreign-reversal" } });
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
    expect(m.post).not.toHaveBeenCalled();
  });

  it("returns the same immutable reversal receipt and rejects a changed operation on replay", async () => {
    const first = await reverseRefundedOrdinaryReferral(command());
    const metadata = m.updateEvent.mock.calls[0]![0].data.metadata;
    m.event.mockResolvedValue({ ...rewarded(), status: "CANCELLED", metadata });
    m.journal.mockResolvedValue({
      id: first.journalId, reference: first.journalReference,
      reversalOfJournalId: "reward-journal",
      idempotencyKey: m.post.mock.calls[0]![1].idempotencyKey,
    });
    m.post.mockClear();
    expect((await reverseRefundedOrdinaryReferral(command())).status).toBe("REPLAYED");
    await expect(reverseRefundedOrdinaryReferral({ ...command(), operationId: "another-reversal-id" }))
      .rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
    expect(m.post).not.toHaveBeenCalled();
  });

  it("rolls back on status conflict and rejects malformed operation IDs", async () => {
    m.updateEvent.mockResolvedValueOnce({ count: 0 });
    await expect(reverseRefundedOrdinaryReferral(command())).rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
    expect(m.audit).not.toHaveBeenCalled();
    await expect(reverseRefundedOrdinaryReferral({ ...command(), operationId: "bad" }))
      .rejects.toMatchObject({ code: "INVALID_EVENT" });
  });
});
