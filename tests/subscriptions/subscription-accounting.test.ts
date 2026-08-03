import { describe, expect, it } from "vitest";
import { subscriptionInvoiceSettlementPosting, subscriptionRevenueRecognitionPosting } from "@/lib/subscriptions/subscription-ledger-policy";
import { calculateSubscriptionRevenueRecognition } from "@/lib/subscriptions/subscription-revenue-recognition.service";

describe("subscription settlement and revenue accounting", () => {
  it("reclassifies exact customer-held funds into deferred revenue", () => {
    const posting = subscriptionInvoiceSettlementPosting({ invoiceReference: "subinv_A1", paymentReference: "pay_A1", amount: "115.00", netAmount: "100.00", taxAmount: "15.00", customerFundsHeldAccountId: "held", deferredRevenueAccountId: "deferred", taxPayableAccountId: "tax" });
    expect(posting.type).toBe("SUBSCRIPTION_INVOICE_SETTLEMENT");
    expect(posting.entries).toEqual(expect.arrayContaining([{ accountId: "held", direction: "DEBIT", amount: "115.00", lineCode: "CUSTOMER_FUNDS_HELD", memo: expect.any(String) }, { accountId: "deferred", direction: "CREDIT", amount: "100.00", lineCode: "SUBSCRIPTION_DEFERRED_REVENUE", memo: expect.any(String) }, { accountId: "tax", direction: "CREDIT", amount: "15.00", lineCode: "SUBSCRIPTION_TAX_PAYABLE", memo: expect.any(String) }]));
  });

  it("uses cumulative daily allocation so the final cent is exact and duplicate dates add nothing", () => {
    const base = { netAmount: "10.00", recognizedAmount: "0.00", serviceStart: new Date("2026-07-01T00:00:00Z"), serviceEnd: new Date("2026-07-04T00:00:00Z") };
    expect(calculateSubscriptionRevenueRecognition({ ...base, through: new Date("2026-07-01T12:00:00Z") })).toMatchObject({ amount: "3.33", cumulativeAmount: "3.33" });
    expect(calculateSubscriptionRevenueRecognition({ ...base, recognizedAmount: "6.67", through: new Date("2026-07-03T12:00:00Z") })).toMatchObject({ amount: "3.33", cumulativeAmount: "10.00", complete: true });
    expect(calculateSubscriptionRevenueRecognition({ ...base, recognizedAmount: "10.00", through: new Date("2026-07-03T12:00:00Z") })).toMatchObject({ amount: "0.00" });
  });

  it("posts recognition only from deferred revenue to subscription revenue", () => {
    expect(subscriptionRevenueRecognitionPosting({ invoiceReference: "subinv_A1", scheduleReference: "subrev_A1", recognitionDate: "2026-07-01", amount: "3.33", deferredRevenueAccountId: "deferred", subscriptionRevenueAccountId: "revenue" }).entries).toEqual([{ accountId: "deferred", direction: "DEBIT", amount: "3.33", lineCode: "SUBSCRIPTION_DEFERRED_REVENUE", memo: expect.any(String) }, { accountId: "revenue", direction: "CREDIT", amount: "3.33", lineCode: "SUBSCRIPTION_REVENUE", memo: expect.any(String) }]);
  });
});
