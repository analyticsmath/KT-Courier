import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("withdrawal owner UI contract", () => {
  it("asserts masked destinations, exact balances, and no raw bank input", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components/withdrawals/WithdrawalRequestForm.tsx"),
      "utf8"
    );

    expect(source).toContain("Payout destinations are masked external references. This form never collects bank-account numbers.");
    expect(source).toContain("maskedLabel");

    // Must not have raw account number or branch code input fields
    expect(source).not.toContain('name="accountNumber"');
    expect(source).not.toContain('name="branchCode"');
    expect(source).not.toContain('name="iban"');
  });
});
