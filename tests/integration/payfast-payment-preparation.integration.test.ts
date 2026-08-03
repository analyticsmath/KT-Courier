import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createPayableOrder, paymentPrisma, resetPaymentTables } from "./payment-fixtures";

afterAll(async () => paymentPrisma.$disconnect());
beforeEach(async () => resetPaymentTables());

describe("Phase 11 Payfast payment preparation", () => {
  it("derives exact ZAR once and changes no accounting or order state", async () => {
    const fixture = await createPayableOrder();
    const before = await paymentPrisma.order.findUniqueOrThrow({ where: { id: fixture.order.id } });
    const beforeHistory = await paymentPrisma.orderStatusHistory.count({ where: { orderId: fixture.order.id } });
    const payment = await prepareOrderPayment(
      { id: fixture.user.id, email: fixture.user.email },
      { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:payfast:prepare` },
    );
    expect(payment).toMatchObject({ amount: "115.00", currency: "ZAR", status: "CREATED" });
    expect(await paymentPrisma.payment.count({ where: { orderId: fixture.order.id } })).toBe(1);
    expect(await paymentPrisma.paymentAttempt.count({ where: { paymentId: payment.id } })).toBe(0);
    expect(await paymentPrisma.ledgerJournal.count()).toBe(0);
    expect(await paymentPrisma.walletTransaction.count()).toBe(0);
    expect(await paymentPrisma.order.findUniqueOrThrow({ where: { id: fixture.order.id } })).toEqual(before);
    expect(await paymentPrisma.orderStatusHistory.count({ where: { orderId: fixture.order.id } })).toBe(beforeHistory);
  });
});
