import { describe, expect, it } from "vitest";
import { balanceDeltaForEntry, calculateAccountProjection } from "@/lib/ledger/balance-policy";
import { LedgerMoney } from "@/lib/ledger/money";

const money = (value: string) => value === "0.00" ? LedgerMoney.zero() : LedgerMoney.parse(value);
const account = (category: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE" | "EQUITY", balance = "0.00", allowNegative = false) => ({
  id: "account", category, currency: "ZAR" as const, status: "ACTIVE" as const, allowNegative,
  currentBalance: money(balance), debitTotal: LedgerMoney.zero(), creditTotal: LedgerMoney.zero(), version: 0,
});
const entry = (direction: "DEBIT" | "CREDIT", amount: string) => ({ accountId: "account", direction, amount: LedgerMoney.parse(amount), currency: "ZAR" as const, lineCode: direction });

describe("ledger balance policy", () => {
  it.each([
    ["ASSET", "DEBIT", "10.00"], ["LIABILITY", "CREDIT", "10.00"], ["REVENUE", "CREDIT", "10.00"],
    ["EXPENSE", "DEBIT", "10.00"], ["EQUITY", "CREDIT", "10.00"],
  ] as const)("increases %s with its normal %s side", (category, direction, expected) => {
    expect(balanceDeltaForEntry(category, direction, LedgerMoney.parse("10.00")).toString()).toBe(expected);
  });

  it("decreases on the opposite side and permits an exact boundary to zero", () => {
    expect(calculateAccountProjection(account("ASSET", "10.00"), [entry("CREDIT", "10.00")]).currentBalance.toString()).toBe("0.00");
    expect(balanceDeltaForEntry("LIABILITY", "DEBIT", LedgerMoney.parse("2.00")).toString()).toBe("-2.00");
  });

  it("blocks negative balances unless the account policy explicitly allows them", () => {
    expect(() => calculateAccountProjection(account("ASSET"), [entry("CREDIT", "1.00")])).toThrowError(expect.objectContaining({ code: "LEDGER_INSUFFICIENT_BALANCE" }));
    expect(calculateAccountProjection(account("ASSET", "0.00", true), [entry("CREDIT", "1.00")]).currentBalance.toString()).toBe("-1.00");
  });
});

