import { describe, expect, it, vi } from "vitest";
import { openPaymentReconciliationCaseWithinTransaction } from "@/lib/services/payment-reconciliation.service";

describe("payment reconciliation service", () => {
  it("creates an idempotent safe case without success authority", async () => {
    const tx = {
      payment: { findUnique: vi.fn().mockResolvedValue({ status: "PROCESSING" }) },
      paymentStatusHistory: { create: vi.fn() },
      paymentReconciliationCase: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => data) },
    };
    const created = await openPaymentReconciliationCaseWithinTransaction(tx as never, { paymentId: "payment", attemptId: "attempt", webhookEventId: "event", reason: "UNKNOWN_OUTCOME", safeEvidence: { eventReference: "pwe_safe" } });
    expect(created).toMatchObject({ caseKey: "payfast:payment:attempt:UNKNOWN_OUTCOME", status: "OPEN", safeEvidence: { eventReference: "pwe_safe" } });
    expect(JSON.stringify(created)).not.toMatch(/signature|passphrase|rawBody/i);
    expect(tx.paymentStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reasonCode: "PAYFAST_RECONCILIATION_OPENED" }) }));
  });
  it("updates observation count instead of creating duplicate open cases", async () => {
    const update = vi.fn().mockResolvedValue({ id: "case" });
    const tx = { paymentReconciliationCase: { findUnique: vi.fn().mockResolvedValue({ id: "case", status: "OPEN" }), update, create: vi.fn() }, paymentStatusHistory: { create: vi.fn() } };
    await openPaymentReconciliationCaseWithinTransaction(tx as never, { paymentId: "payment", attemptId: "attempt", reason: "UNKNOWN_OUTCOME" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ observationCount: { increment: 1 } }) }));
    expect(tx.paymentReconciliationCase.create).not.toHaveBeenCalled();
    expect(tx.paymentStatusHistory.create).not.toHaveBeenCalled();
  });
});
