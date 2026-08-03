import { afterAll, describe, expect, it } from "vitest";
import { applyVerifiedPayfastItn } from "@/lib/services/payfast-itn-application.service";
import { createPhase12Attempt, verifiedEvent } from "./payfast-itn-fixtures";
import { paymentPrisma } from "./payment-fixtures";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
afterAll(async () => paymentPrisma.$disconnect());
describe("Payfast ITN concurrency integration", () => {
  it("converges concurrent exact duplicates to one event, journal and projection update", async () => {
    const { attempt } = await createPhase12Attempt(); const event = verifiedEvent(attempt, "COMPLETE", { fingerprintSeed: "concurrent-exact" });
    const settled = await Promise.allSettled([1, 2, 3].map(() => applyVerifiedPayfastItn(event)));
    expect(settled.every((entry) => entry.status === "fulfilled")).toBe(true);
    expect(await paymentPrisma.paymentWebhookEvent.count({ where: { eventFingerprint: event.receipt.fingerprint } })).toBe(1);
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference } })).toBe(1);
  });
  it("captures same merchant reference with conflicting provider payment ID without a second journal", async () => {
    const { attempt } = await createPhase12Attempt(); await applyVerifiedPayfastItn(verifiedEvent(attempt, "COMPLETE", { providerPaymentId: "pf-first" }));
    await expect(applyVerifiedPayfastItn(verifiedEvent(attempt, "COMPLETE", { providerPaymentId: "pf-conflict" }))).resolves.toMatchObject({ outcome: "RECONCILIATION_REQUIRED" });
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference } })).toBe(1);
  });
  it("uses deterministic account lock order when racing another ledger posting", async () => {
    const { attempt } = await createPhase12Attempt(); const event = verifiedEvent(attempt, "COMPLETE", { fingerprintSeed: "lock-order" });
    const accounts = await paymentPrisma.ledgerAccount.findMany({ where: { code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"] } } });
    const cash = accounts.find((account) => account.code === "PLATFORM-CASH-CLEARING-ZAR")!; const held = accounts.find((account) => account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR")!;
    const settled = await Promise.allSettled([applyVerifiedPayfastItn(event), postLedgerJournal({ idempotencyKey: `race:${attempt.id}`, sourceReference: `race:${attempt.id}`, type: "GENERAL", currency: "ZAR", actor: { kind: "SYSTEM" }, entries: [{ accountId: held.id, direction: "CREDIT", amount: "1.00", lineCode: "HELD" }, { accountId: cash.id, direction: "DEBIT", amount: "1.00", lineCode: "CASH" }] })]);
    expect(settled.every((entry) => entry.status === "fulfilled")).toBe(true);
  });
});
