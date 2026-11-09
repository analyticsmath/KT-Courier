import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  verifyOrdinaryReferralAwardJournal, type OrdinaryReferralJournal,
} from "@/lib/rewards/ordinary-referral-ledger-evidence";

const digest = "A".repeat(64);
const operationDigest = "B".repeat(64);
const source = {
  id: "event-1", targetUserId: "referred-customer",
  referralCode: { ownerType: "CUSTOMER", ownerId: "referrer-1" },
  metadata: {
    rewardAmountZar: "5.00", qualifyingPaymentId: "payment-1",
    rewardJournalId: "journal-1", rewardOperationDigest: operationDigest,
    recipientOwnerType: "CUSTOMER", recipientOwnerId: "referrer-1",
  },
};
const amount = (s: string) => new Prisma.Decimal(s);
function journal(): OrdinaryReferralJournal {
  return {
    id: "journal-1", sourceReference: "ORDINARY_REFERRAL:" + digest,
    idempotencyKey: "ordinary-referral-award-" + digest,
    type: "GENERAL", currency: "ZAR", totalDebits: amount("5.00"),
    totalCredits: amount("5.00"), reversalJournal: null,
    metadata: {
      category: "ORDINARY_REFERRAL_AWARD", referralEventId: "event-1",
      referredUserId: "referred-customer", recipientOwnerType: "CUSTOMER",
      recipientOwnerId: "referrer-1", qualifyingPaymentId: "payment-1",
      rewardOperationDigest: operationDigest, policyRewardZar: "5.00",
    },
    entries: [
      { direction: "DEBIT", amount: amount("5.00"), account: {
        purpose: "PLATFORM_PROMOTION_EXPENSE", category: "EXPENSE",
        wallet: { ownerType: "PLATFORM", ownerId: "platform" },
      } },
      { direction: "CREDIT", amount: amount("5.00"), account: {
        purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY",
        wallet: { ownerType: "CUSTOMER", ownerId: "referrer-1" },
      } },
    ],
  } as unknown as OrdinaryReferralJournal;
}

describe("source-linked ordinary referral award ledger proof", () => {
  it("accepts only the original balanced R5 credit to the actual referrer", () => {
    expect(verifyOrdinaryReferralAwardJournal(source, journal(), digest)).toEqual({
      amountZar: "5.00", qualifyingPaymentId: "payment-1", operationDigest,
    });
  });

  it("rejects forged recipient, amount, payment or idempotency source without issuing any balance", () => {
    const j = journal();
    const forged = [
      { ...j, totalCredits: amount("500.00") },
      { ...j, idempotencyKey: "other-event" },
      { ...j, entries: j.entries.map((e, i) => i !== 1 ? e : {
        ...e, account: { ...e.account, wallet: { ...e.account.wallet, ownerId: "attacker" } },
      }) },
      { ...j, metadata: { ...(j.metadata as Record<string, unknown>), qualifyingPaymentId: "foreign-payment" } },
      { ...j, sourceReference: "ORDINARY_REFERRAL:" + "C".repeat(64) },
    ];
    for (const changed of forged) {
      expect(() => verifyOrdinaryReferralAwardJournal(source, changed as OrdinaryReferralJournal, digest)).toThrow();
    }
  });

  it("does not accept a store referral credited to a withdrawable sales or customer wallet", () => {
    const storeEvent = {
      ...source, referralCode: { ownerType: "STORE", ownerId: "store-1" },
      metadata: { ...source.metadata, recipientOwnerType: "STORE", recipientOwnerId: "store-1" },
    };
    expect(() => verifyOrdinaryReferralAwardJournal(storeEvent, journal(), digest)).toThrow();
  });
});
