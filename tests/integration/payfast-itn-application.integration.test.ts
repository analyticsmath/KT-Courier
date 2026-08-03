import { afterAll, describe, expect, it } from "vitest";
import { applyVerifiedPayfastItn } from "@/lib/services/payfast-itn-application.service";
import { createPhase12Attempt, verifiedEvent } from "./payfast-itn-fixtures";
import { paymentPrisma } from "./payment-fixtures";
afterAll(async () => paymentPrisma.$disconnect());
describe("Payfast ITN atomic application integration", () => {
  it("applies verified COMPLETE with one receipt, successful attempt/payment and one linked journal", async () => {
    const { attempt, fixture } = await createPhase12Attempt(); const event = verifiedEvent(attempt); const orderBefore = await paymentPrisma.order.findUniqueOrThrow({ where: { id: fixture.order.id } });
    await expect(applyVerifiedPayfastItn(event)).resolves.toMatchObject({ outcome: "APPLIED" });
    expect(await paymentPrisma.paymentWebhookEvent.count({ where: { eventFingerprint: event.receipt.fingerprint } })).toBe(1);
    expect(await paymentPrisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({ status: "SUCCEEDED", providerReference: event.fields.providerPaymentId });
    const payment = await paymentPrisma.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } });
    expect(payment).toMatchObject({ status: "SUCCEEDED", successfulAttemptId: attempt.id }); expect(payment.successLedgerJournalId).toBeTruthy();
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference, type: "EXTERNAL_PAYMENT_RECEIPT" } })).toBe(1);
    expect(await paymentPrisma.order.findUniqueOrThrow({ where: { id: fixture.order.id } })).toEqual(orderBefore);
  });
  it("rolls back journal, entries, projections, payment, attempt and event application after an injected post-ledger failure", async () => {
    const { attempt } = await createPhase12Attempt(); const event = verifiedEvent(attempt, "COMPLETE", { fingerprintSeed: "rollback-after-ledger" });
    const accountsBefore = await paymentPrisma.ledgerAccount.findMany({ where: { code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"] } }, orderBy: { code: "asc" } });
    await expect(applyVerifiedPayfastItn(event, { afterLedgerPosted: () => { throw new Error("injected after ledger"); } })).rejects.toBeInstanceOf(Error);
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference } })).toBe(0);
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).not.toMatchObject({ status: "SUCCEEDED" });
    expect(await paymentPrisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).not.toMatchObject({ status: "SUCCEEDED" });
    expect(await paymentPrisma.paymentWebhookEvent.findUniqueOrThrow({ where: { eventFingerprint: event.receipt.fingerprint } })).toMatchObject({ processingStatus: "TEMPORARY_FAILURE", appliedAt: null });
    const accountsAfter = await paymentPrisma.ledgerAccount.findMany({ where: { code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"] } }, orderBy: { code: "asc" } });
    expect(accountsAfter.map((account) => [account.currentBalance.toFixed(2), account.debitTotal.toFixed(2), account.creditTotal.toFixed(2)])).toEqual(accountsBefore.map((account) => [account.currentBalance.toFixed(2), account.debitTotal.toFixed(2), account.creditTotal.toFixed(2)]));
  });
});
