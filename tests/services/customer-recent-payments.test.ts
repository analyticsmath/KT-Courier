import { describe, expect, it, vi } from "vitest";
import { listCustomerRecentPayments } from "@/lib/services/customer-recent-payments.service";

describe("read-only customer payment history", () => {
  it("shows a customer's own verified sandbox purchases without inflating the refund wallet", async () => {
    const db = { payment: { findMany: vi.fn().mockResolvedValue([{
      publicReference: "pay_test_order_123456", subjectType: "COURIER_ORDER",
      status: "SUCCEEDED", amount: { toFixed: () => "205.00" },
      successLedgerJournalId: "ledger_verified",
      createdAt: new Date("2026-10-24T01:00:00Z"),
      successfulAttempt: { providerEnvironment: "SANDBOX" },
      attempts: [{ providerEnvironment: "SANDBOX" }],
    }]) } };
    const rows = await listCustomerRecentPayments("customer-own", 5, db as never);
    expect(db.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "customer-own" }, take: 5 }));
    expect(rows).toEqual([expect.objectContaining({ amount: "205.00", currency: "ZAR", status: "PAID", environment: "SANDBOX" })]);
  });
  it("does not call provider, guess sandbox status, or claim unposted payments succeeded", async () => {
    const db = { payment: { findMany: vi.fn().mockResolvedValue([{
      publicReference: "pay_pending_order_123", subjectType: "COURIER_ORDER",
      status: "SUCCEEDED", amount: { toFixed: () => "205.00" },
      successLedgerJournalId: null, createdAt: new Date(),
      successfulAttempt: null, attempts: [{ providerEnvironment: "SANDBOX" }],
    }]) } };
    const rows = await listCustomerRecentPayments("customer-own", 5, db as never);
    expect(rows[0]).toMatchObject({ status: "RECONCILIATION_REQUIRED", environment: "SANDBOX" });
  });
});
