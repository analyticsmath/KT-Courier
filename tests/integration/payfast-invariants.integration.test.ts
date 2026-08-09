import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { paymentPrisma, resetPaymentTables } from "./payment-fixtures";

afterAll(async () => paymentPrisma.$disconnect());
beforeEach(async () => resetPaymentTables());

describe("Phase 11 Payfast persisted invariants", () => {
  it("stores FORM_POST audit without secret, signature, or raw-form material", async () => {
    const attempts = await paymentPrisma.paymentAttempt.findMany({ where: { provider: "PAYFAST" } });
    for (const attempt of attempts) {
      expect(attempt.merchantReference.length).toBeLessThanOrEqual(100);
      expect(attempt.publicReference).toMatch(/^pat_[A-Za-z0-9_-]+$/);
      if (attempt.status === "REQUIRES_ACTION") {
        expect(attempt.providerEnvironment).toBe("SANDBOX");
        expect(["FORM_POST", "REDIRECT_GET"]).toContain(attempt.checkoutActionType);
      }
      expect(JSON.stringify({
        request: attempt.requestSnapshot,
        result: attempt.resultSnapshot,
        payload: "providerPayload" in attempt ? attempt.providerPayload : undefined,
      })).not.toMatch(/"(merchant[_-]?key|passphrase|signature|email_address)"\s*:/i);
    }
  });

  it("keeps ITN, refund, ledger, wallet, production, and authoritative outcomes absent", async () => {
    expect(await paymentPrisma.paymentWebhookEvent.count({ where: { provider: "PAYFAST" } })).toBe(0);
    expect(await paymentPrisma.paymentRefund.count({ where: { payment: { provider: "PAYFAST" } } })).toBe(0);
    expect(await paymentPrisma.ledgerJournal.count()).toBe(0);
    expect(await paymentPrisma.walletTransaction.count()).toBe(0);
    expect(await paymentPrisma.paymentAttempt.count({
      where: {
        provider: "PAYFAST",
        OR: [
          { providerEnvironment: "PRODUCTION" },
          { status: "SUCCEEDED" },
          { status: "CANCELLED" },
          { providerReference: { not: null } },
        ],
      },
    })).toBe(0);
  });

  it("creates no order status history after a Payfast payment is prepared", async () => {
    const payments = await paymentPrisma.payment.findMany({
      where: { provider: "PAYFAST" },
      select: { orderId: true, createdAt: true },
    });
    for (const payment of payments) {
      if (!payment.orderId) continue;
      expect(await paymentPrisma.orderStatusHistory.count({
        where: { orderId: payment.orderId, createdAt: { gte: payment.createdAt } },
      })).toBe(0);
    }
  });
});
