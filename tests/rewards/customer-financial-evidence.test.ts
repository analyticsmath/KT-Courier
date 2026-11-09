import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isCanonicalCustomerPaymentReceipt } from "@/lib/rewards/customer-financial-evidence";

describe("customer reward source must be the exact full-value externally verified receipt", () => {
  const money = (value: string) => new Prisma.Decimal(value);
  const debit = (amount = "100.00") => ({
    direction: "DEBIT", amount: money(amount),
    account: { code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET" },
  });
  const held = (amount = "100.00") => ({
    direction: "CREDIT", amount: money(amount),
    account: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY" },
  });

  it("accepts the canonical fully balanced Paystack and PayFast receipt in either entry order", () => {
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [debit(), held()] })).toBe(true);
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [held(), debit()] })).toBe(true);
  });

  it("refuses a journal where a held credit exists but does not cover the paid amount", () => {
    const diverted = {
      direction: "CREDIT", amount: money("99.00"),
      account: { code: "PLATFORM-OTHER-LIABILITY-ZAR", purpose: "HELD", category: "LIABILITY" },
    };
    // Old 'some()' check accepted this: R1 held, R99 elsewhere,
    // while the journal totals remained exactly R100 each direction.
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [
      debit(), held("1.00"), diverted,
    ] })).toBe(false);
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [
      debit(), held("1.00"),
    ] })).toBe(false);
  });

  it("refuses forged source category, account purpose or journal directions", () => {
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [
      { ...debit(), account: { ...debit().account, category: "LIABILITY" } }, held(),
    ] })).toBe(false);
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [
      debit(), { ...held(), account: { ...held().account, purpose: "AVAILABLE" } },
    ] })).toBe(false);
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [
      { ...debit(), direction: "CREDIT" }, held(),
    ] })).toBe(false);
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [
      debit(), { ...held(), direction: "DEBIT" },
    ] })).toBe(false);
  });

  it("rejects zero-value and over/under-valued receipts", () => {
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("0.00"), entries: [debit("0.00"), held("0.00")] })).toBe(false);
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [debit("100.01"), held()] })).toBe(false);
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [debit(), held("100.01")] })).toBe(false);
    expect(isCanonicalCustomerPaymentReceipt({ amount: money("100.00"), entries: [debit()] })).toBe(false);
  });
});
