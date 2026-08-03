import { afterAll, describe, expect, it } from "vitest";
import { applyVerifiedPayfastItn } from "@/lib/services/payfast-itn-application.service";
import { createPhase12Attempt, verifiedEvent } from "./payfast-itn-fixtures";
import { paymentPrisma } from "./payment-fixtures";
afterAll(async () => paymentPrisma.$disconnect());
describe("Payfast out-of-order reconciliation integration", () => {
  it("ignores stale PENDING and reconciles FAILED after established success", async () => {
    const { attempt } = await createPhase12Attempt(); const complete = verifiedEvent(attempt, "COMPLETE", { providerPaymentId: "pf-status" }); await applyVerifiedPayfastItn(complete);
    await expect(applyVerifiedPayfastItn(verifiedEvent(attempt, "PENDING", { providerPaymentId: "pf-status" }))).resolves.toMatchObject({ outcome: "IGNORED_STALE" });
    await expect(applyVerifiedPayfastItn(verifiedEvent(attempt, "FAILED", { providerPaymentId: "pf-status" }))).resolves.toMatchObject({ outcome: "RECONCILIATION_REQUIRED" });
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).toMatchObject({ status: "SUCCEEDED" });
    expect(await paymentPrisma.paymentReconciliationCase.count({ where: { paymentId: attempt.paymentId, reason: "CONFLICTING_PROVIDER_STATUS" } })).toBe(1);
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference } })).toBe(1);
  });
  it("keeps unknown verified status unresolved and opens one idempotent case", async () => {
    const { attempt } = await createPhase12Attempt(); const unknown = verifiedEvent(attempt, "UNKNOWN", { providerPaymentId: "pf-unknown", fingerprintSeed: "unknown" });
    await expect(applyVerifiedPayfastItn(unknown)).resolves.toMatchObject({ outcome: "RECONCILIATION_REQUIRED" });
    expect(await paymentPrisma.paymentReconciliationCase.count({ where: { paymentId: attempt.paymentId, reason: "UNRECOGNIZED_PROVIDER_STATUS" } })).toBe(1);
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference } })).toBe(0);
  });
  it("captures a different body with the same provider payment ID as conflicting evidence", async () => {
    const { attempt } = await createPhase12Attempt(); await applyVerifiedPayfastItn(verifiedEvent(attempt, "COMPLETE", { providerPaymentId: "pf-same", fingerprintSeed: "body-one" }));
    await expect(applyVerifiedPayfastItn(verifiedEvent(attempt, "COMPLETE", { providerPaymentId: "pf-same", fingerprintSeed: "body-two" }))).resolves.toMatchObject({ outcome: "RECONCILIATION_REQUIRED" });
    expect(await paymentPrisma.paymentReconciliationCase.count({ where: { paymentId: attempt.paymentId, reason: "CONFLICTING_PROVIDER_STATUS" } })).toBe(1);
    expect(await paymentPrisma.ledgerJournal.count({ where: { correlationId: attempt.payment.publicReference } })).toBe(1);
  });
});
