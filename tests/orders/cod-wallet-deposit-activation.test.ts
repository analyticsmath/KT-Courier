import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { activateDepositCashOnDeliveryWithinTransaction } from "@/lib/services/cash-on-delivery.service";

const money = (amount: string) => new Prisma.Decimal(amount);
const ref = "pay_split_123";
const payment = {
  id: "payment-1", publicReference: ref, subjectType: "COURIER_ORDER",
  orderId: "order-1", status: "SUCCEEDED", successLedgerJournalId: "provider-journal",
  metadata: {
    walletSplit: true, walletAmount: "25.00", walletOwnerType: "CUSTOMER",
    walletOwnerId: "customer-1", totalPayableAmount: "85.00",
  },
};
const journal = {
  idempotencyKey: `wallet-consume:paystack:wallet-consume:${ref}`,
  sourceReference: `WALLET_CONSUME:${ref}`,
  currency: "ZAR", totalDebits: money("25.00"), totalCredits: money("25.00"),
  reversalOfJournalId: null, reversalJournal: null,
  metadata: {
    category: "WALLET_SPEND_CONSUMPTION", subjectType: "COURIER_ORDER",
    subjectId: "order-1", subjectReference: ref, fromReserved: true,
    amount: "25.00", ownerType: "CUSTOMER", ownerId: "customer-1",
  },
};
const command = {
  orderId: "order-1", paymentId: "payment-1", amount: money("60.00"),
  verifiedEventReference: "provider-event-1",
  walletReceipt: { amount: "25.00", journalId: "wallet-consumed-journal-1" },
};
function tx() {
  return {
    cashOnDelivery: {
      findUnique: vi.fn().mockResolvedValue({
        id: "cod-1", policyMode: "DEPOSIT_PLUS_COD", status: "PENDING",
        paymentId: null, digitalRequired: money("85.00"), digitalPaid: money("0.00"),
      }),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    payment: { findUnique: vi.fn().mockResolvedValue(payment) },
    ledgerJournal: { findUnique: vi.fn().mockResolvedValue(journal) },
  };
}

describe("ledger-authorized split wallet deposit activation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the original posting journal, then activates exactly the full digital deposit", async () => {
    const db = tx();
    await expect(activateDepositCashOnDeliveryWithinTransaction(db as never, command))
      .resolves.toMatchObject({ status: "READY_FOR_COLLECTION" });
    expect(db.ledgerJournal.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: command.walletReceipt.journalId },
    }));
    expect(db.cashOnDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        digitalPaid: money("85.00"),
        status: "READY_FOR_COLLECTION",
        events: { create: expect.objectContaining({
          eventType: "DEPOSIT_VERIFIED",
          safeEvidence: expect.objectContaining({
            providerAmount: "60.00", walletAmount: "25.00",
            walletJournalId: "wallet-consumed-journal-1",
          }),
        }) },
      }),
    }));
  });

  it("refuses missing, reversed, unbalanced or other-order wallet consumption evidence", async () => {
    for (const tampered of [
      null,
      { ...journal, reversalJournal: { id: "reverse-1" } },
      { ...journal, totalCredits: money("24.99") },
      { ...journal, metadata: { ...journal.metadata, subjectId: "other-order" } },
      { ...journal, idempotencyKey: "wallet-consume:other-payment" },
    ]) {
      const db = tx();
      db.ledgerJournal.findUnique.mockResolvedValue(tampered);
      await expect(activateDepositCashOnDeliveryWithinTransaction(db as never, command))
        .rejects.toMatchObject({ code: "COD_DEPOSIT_NOT_SATISFIED" });
      expect(db.cashOnDelivery.update).not.toHaveBeenCalled();
    }
  });

  it("rejects unverified or conflicting wallet split metadata before using any journal", async () => {
    const db = tx();
    db.payment.findUnique.mockResolvedValue({ ...payment, metadata: { ...payment.metadata, walletAmount: "24.00" } });
    await expect(activateDepositCashOnDeliveryWithinTransaction(db as never, command))
      .rejects.toMatchObject({ code: "COD_DEPOSIT_NOT_SATISFIED" });
    expect(db.ledgerJournal.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a provider+wallet sum below the approved committed digital deposit", async () => {
    const db = tx();
    await expect(activateDepositCashOnDeliveryWithinTransaction(db as never, {
      ...command, amount: money("59.99"),
    })).rejects.toMatchObject({ code: "COD_DEPOSIT_NOT_SATISFIED" });
    expect(db.cashOnDelivery.update).not.toHaveBeenCalled();
  });

  it("keeps normal provider-only COD deposits usable without any wallet receipt", async () => {
    const db = tx();
    await expect(activateDepositCashOnDeliveryWithinTransaction(db as never, {
      orderId: "order-1", paymentId: "payment-1", amount: money("85.00"),
      verifiedEventReference: "provider-event-1",
    })).resolves.toMatchObject({ status: "READY_FOR_COLLECTION" });
    expect(db.payment.findUnique).not.toHaveBeenCalled();
    expect(db.ledgerJournal.findUnique).not.toHaveBeenCalled();
  });
});
