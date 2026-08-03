import { describe, expect, it } from "vitest";
import { normalSideForCategory, assertAccountCanPost } from "@/lib/ledger/account-policy";
import { LedgerMoney } from "@/lib/ledger/money";

const account = (overrides = {}) => ({
  id: "account",
  category: "ASSET" as const,
  currency: "ZAR" as const,
  status: "ACTIVE" as const,
  allowNegative: false,
  currentBalance: LedgerMoney.zero(),
  debitTotal: LedgerMoney.zero(),
  creditTotal: LedgerMoney.zero(),
  version: 0,
  ...overrides,
});

describe("ledger account policy", () => {
  it("derives normal sides centrally", () => {
    expect(normalSideForCategory("ASSET")).toBe("DEBIT");
    expect(normalSideForCategory("EXPENSE")).toBe("DEBIT");
    expect(normalSideForCategory("LIABILITY")).toBe("CREDIT");
    expect(normalSideForCategory("REVENUE")).toBe("CREDIT");
    expect(normalSideForCategory("EQUITY")).toBe("CREDIT");
  });

  it("permits active matching accounts and rejects frozen, closed, or mismatched accounts", () => {
    expect(() => assertAccountCanPost(account(), "ZAR")).not.toThrow();
    expect(() => assertAccountCanPost(account({ status: "FROZEN" as const }), "ZAR")).toThrowError(expect.objectContaining({ code: "LEDGER_ACCOUNT_FROZEN" }));
    expect(() => assertAccountCanPost(account({ status: "CLOSED" as const }), "ZAR")).toThrowError(expect.objectContaining({ code: "LEDGER_ACCOUNT_CLOSED" }));
    expect(() => assertAccountCanPost(account({ currency: "USD" as never }), "ZAR")).toThrowError(expect.objectContaining({ code: "LEDGER_ACCOUNT_CURRENCY_MISMATCH" }));
  });
});

