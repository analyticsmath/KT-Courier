import { describe, expect, it, vi } from "vitest";
import { getCourierPaymentReadiness, requirePaymentBeforeCourierProgress } from "@/lib/services/courier-payment-readiness.service";
const payment = { publicReference: "pay_123", status: "SUCCEEDED", amount: { toFixed: () => "205.85" }, successLedgerJournalId: "journal_1", providerConfirmedAt: new Date(), provider: "PAYSTACK", succeededAt: new Date() };
const query = (order: Record<string, unknown>) => ({ order: { findMany: vi.fn().mockResolvedValue([order]) } });
const base = { id: "order-1", payments: [], cashOnDelivery: null, marketplaceStoreOrderBridge: null };
describe("courier payment readiness", () => {
  it("treats a canonical settled parcel payment as eligible", async () => { const db = query({ ...base, payments: [payment] }); const result = await getCourierPaymentReadiness("order-1", db as never); expect(result).toMatchObject({ status: "PAID", dispatchEligible: true, paymentReference: "pay_123" }); });
  it("blocks a successful provider status without financial ledger posting", async () => { const db = query({ ...base, payments: [{ ...payment, successLedgerJournalId: null }] }); expect(await getCourierPaymentReadiness("order-1", db as never)).toMatchObject({ status: "RECONCILIATION_REQUIRED", dispatchEligible: false }); });
  it("blocks not-yet-paid online parcel payments", async () => { const db = query({ ...base, payments: [{...payment, status:"REQUIRES_ACTION",successLedgerJournalId:null}] }); expect(await getCourierPaymentReadiness("order-1", db as never)).toMatchObject({ status: "PAYMENT_REQUIRED", dispatchEligible: false }); });
  it("does not misrepresent authorised full COD as paid, but permits dispatch", async () => { const db = query({ ...base, cashOnDelivery:{ policyMode:"FULL_COD", digitalRequired:{toNumber:()=>0}, cashObligation:{toFixed:()=>"170.00"},cashCollected:{toFixed:()=>"0.00"},status:"READY_FOR_COLLECTION"} }); expect(await getCourierPaymentReadiness("order-1", db as never)).toMatchObject({ status: "CASH_DUE_ON_DELIVERY", dispatchEligible:true }); });
  it("shows no cash outstanding once the driver records the entire full COD fee", async () => {
    const db = query({ ...base, cashOnDelivery: {
      policyMode: "FULL_COD", digitalRequired: { toNumber: () => 0 },
      cashObligation: { toFixed: () => "179.00" },
      cashCollected: { toFixed: () => "179.00" }, status: "COLLECTED",
    } });
    expect(await getCourierPaymentReadiness("order-1", db as never)).toMatchObject({
      status: "CASH_COLLECTED", dispatchEligible: true, cashDue: "0.00",
      amount: "179.00",
    });
  });
  it("blocks dispatch if driver reported failed cash collection", async () => {
    const db = query({ ...base, cashOnDelivery: {
      policyMode: "FULL_COD", digitalRequired: { toNumber: () => 0 },
      cashObligation: { toFixed: () => "205.85" },
      cashCollected: { toFixed: () => "0.00" }, status: "COLLECTION_FAILED",
    } });
    expect(await getCourierPaymentReadiness("order-1", db as never)).toMatchObject({
      status: "RECONCILIATION_REQUIRED", dispatchEligible: false,
    });
  });
  it("blocks dispatch on incomplete or malformed full COD financial records", async () => {
    const db = query({ ...base, cashOnDelivery: {
      policyMode: "FULL_COD", digitalRequired: { toNumber: () => 0 },
      cashObligation: { toFixed: () => "205.85" },
      cashCollected: { toFixed: () => "0.00" }, status: "PENDING",
    } });
    expect(await getCourierPaymentReadiness("order-1", db as never)).toMatchObject({
      status: "RECONCILIATION_REQUIRED", dispatchEligible: false,
    });
  });
  it("does not call a paid deposit a fully paid delivery when cash is still outstanding", async () => {
    const db=query({...base,payments:[payment],cashOnDelivery:{
      policyMode:"DEPOSIT_PLUS_COD",
      digitalRequired:{toNumber:()=>85},cashObligation:{toFixed:()=>"120.85"},
    }});
    expect(await getCourierPaymentReadiness("order-1",db as never)).toMatchObject({
      status:"DEPOSIT_PAID_CASH_DUE",dispatchEligible:true,cashDue:"120.85",paymentReference:"pay_123",
    });
  });
  it("requires verified digital deposit for mixed COD", async () => { const db=query({...base,cashOnDelivery:{policyMode:"DEPOSIT_PLUS_COD",digitalRequired:{toNumber:()=>85},cashObligation:{toFixed:()=>"85.00"}}}); expect(await getCourierPaymentReadiness("order-1",db as never)).toMatchObject({status:"PAYMENT_REQUIRED",dispatchEligible:false}); });
  it("uses parent checkout payment for bridged marketplace courier orders", async () => { const db=query({...base,marketplaceStoreOrderBridge:{storeOrder:{marketplaceOrder:{payment}}}}); expect(await getCourierPaymentReadiness("order-1",db as never)).toMatchObject({status:"PAID",dispatchEligible:true,paymentReference:"pay_123"}); });
  it("missing orders cannot be cleared for dispatch", async () => { const db = { order: { findMany: vi.fn().mockResolvedValue([]) } }; expect(await getCourierPaymentReadiness("missing", db as never)).toMatchObject({status:"UNKNOWN",dispatchEligible:false}); });
});

describe("admin courier progress payment gate", () => {
  const unpaid = { status: "PAYMENT_REQUIRED" as const, dispatchEligible: false, paymentReference: null, amount: null, cashDue: null };
  it("blocks pickup and delivery progress without ledger authorization", () => {
    for (const status of ["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]) {
      expect(() => requirePaymentBeforeCourierProgress(status, unpaid)).toThrow(/payment/i);
    }
  });
  it("allows pre-payment booking/cancellation and verified COD progress", () => {
    for (const status of ["CONFIRMED", "CANCELLED", "FAILED"]) {
      expect(() => requirePaymentBeforeCourierProgress(status, unpaid)).not.toThrow();
    }
    expect(() => requirePaymentBeforeCourierProgress("PICKED_UP", { ...unpaid, status: "CASH_DUE_ON_DELIVERY", dispatchEligible: true })).not.toThrow();
  });
});
