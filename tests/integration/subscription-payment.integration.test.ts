import { describe, expect, it } from "vitest";
import {
  subscriptionInvoiceSettlementPosting,
  subscriptionRevenueRecognitionPosting,
} from "@/lib/subscriptions/subscription-ledger-policy";

describe("Subscription Payment & Ledger Policy Integration Tests", () => {
  it("generates balanced double-entry journal for subscription invoice settlement", () => {
    const journal = subscriptionInvoiceSettlementPosting({
      invoiceReference: "INV-100",
      paymentReference: "PAY-200",
      amount: "115.00",
      netAmount: "100.00",
      taxAmount: "15.00",
      customerFundsHeldAccountId: "acc-held-1",
      deferredRevenueAccountId: "acc-def-2",
      taxPayableAccountId: "acc-tax-3",
    });

    expect(journal.type).toBe("SUBSCRIPTION_INVOICE_SETTLEMENT");
    expect(journal.currency).toBe("ZAR");
    expect(journal.entries.length).toBe(3);

    const debits = journal.entries.filter((e) => e.direction === "DEBIT");
    const credits = journal.entries.filter((e) => e.direction === "CREDIT");

    const totalDebit = debits.reduce((acc, e) => acc + Number(e.amount), 0);
    const totalCredit = credits.reduce((acc, e) => acc + Number(e.amount), 0);

    expect(totalDebit).toBeCloseTo(115.0, 2);
    expect(totalCredit).toBeCloseTo(115.0, 2);
    expect(totalDebit).toBe(totalCredit);
  });

  it("requires tax payable account if tax amount is greater than zero", () => {
    expect(() =>
      subscriptionInvoiceSettlementPosting({
        invoiceReference: "INV-100",
        paymentReference: "PAY-200",
        amount: "115.00",
        netAmount: "100.00",
        taxAmount: "15.00",
        customerFundsHeldAccountId: "acc-held-1",
        deferredRevenueAccountId: "acc-def-2",
        taxPayableAccountId: undefined, // missing
      })
    ).toThrowError(/Subscription tax account is required/);
  });

  it("generates straight-line daily revenue recognition journal", () => {
    const journal = subscriptionRevenueRecognitionPosting({
      invoiceReference: "INV-100",
      scheduleReference: "SCHED-1",
      recognitionDate: "2026-10-17",
      amount: "3.33",
      deferredRevenueAccountId: "acc-def-2",
      subscriptionRevenueAccountId: "acc-rev-4",
    });

    expect(journal.type).toBe("SUBSCRIPTION_REVENUE_RECOGNITION");
    expect(journal.entries.length).toBe(2);
    expect(journal.entries[0].direction).toBe("DEBIT");
    expect(journal.entries[0].amount).toBe("3.33");
    expect(journal.entries[1].direction).toBe("CREDIT");
    expect(journal.entries[1].amount).toBe("3.33");
  });
});
