import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { toPaymentSummaryDto } from "@/lib/payments/payment-dto-mappers";

const payment = {
  id: "payment-1", publicReference: "pay_guest_marketplace", provider: "PAYSTACK", status: "SUCCEEDED",
  amount: new Prisma.Decimal("205.00"), currency: "ZAR", version: 1, latestAttemptNumber: 1,
  expiresAt: null, succeededAt: new Date(), failedAt: null, cancelledAt: null,
  successfulAttemptId: "attempt-1", successWebhookEventId: "webhook-1", successLedgerJournalId: "journal-1",
  providerConfirmedAt: new Date(), reconciliationStatus: "CLEAR",
  createdAt: new Date(), updatedAt: new Date(), order: null, user: null,
  marketplaceCheckout: { id: "checkout-1", publicReference: "mcheckout_123" },
  successfulAttempt: { providerEnvironment: "SANDBOX" },
  attempts: [{ providerEnvironment: "SANDBOX" }],
};
describe("admin payment summaries include guest marketplace money", () => {
  it("does not break the entire admin list when a guest marketplace purchase has no courier order or registered payer", () => {
    const mapped = toPaymentSummaryDto(payment as never);
    expect(mapped).toMatchObject({
      order: { id: "checkout-1", reference: "mcheckout_123" },
      payer: { label: "Guest checkout" },
      providerEnvironment: "SANDBOX",
      amount: "205.00",
      status: "SUCCEEDED",
    });
  });
  it("retains unlinked payment evidence for reconciliation rather than failing all payments", () => {
    const mapped = toPaymentSummaryDto({ ...payment, marketplaceCheckout: null } as never);
    expect(mapped.order.reference).toBe(payment.publicReference);
    expect(mapped.payer.label).toBe("Guest checkout");
  });
});
