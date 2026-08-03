import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createPayableOrder, paymentPrisma, resetPaymentTables } from "./payment-fixtures";
afterAll(async () => paymentPrisma.$disconnect());
beforeEach(async () => resetPaymentTables());
describe("Phase 10 live database invariants", () => {
  it("enforces payment identity and lifecycle-history immutability", async () => { const fixture = await createPayableOrder(); const payment = await prepareOrderPayment({ id: fixture.user.id, email: fixture.user.email }, { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:prepare` }); const history = await paymentPrisma.paymentStatusHistory.findFirstOrThrow({ where: { paymentId: payment.id } }); await expect(paymentPrisma.paymentStatusHistory.delete({ where: { id: history.id } })).rejects.toThrow(); expect(await paymentPrisma.ledgerJournal.count()).toBe(0); expect((await paymentPrisma.order.findUniqueOrThrow({ where: { id: fixture.order.id } })).status).toBe("PENDING"); });
  it("keeps webhook/refund placeholders inactive", async () => { expect(await paymentPrisma.paymentWebhookEvent.count()).toBe(0); expect(await paymentPrisma.paymentRefund.count()).toBe(0); });
});

