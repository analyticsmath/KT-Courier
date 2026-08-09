import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("withdrawal finance UI contract", () => {
  it("asserts headings, tables, permissions, and no mark-paid control", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components/withdrawals/FinanceWithdrawalActions.tsx"),
      "utf8"
    );

    expect(source).toContain("Finance withdrawal actions");
    expect(source).toContain("canReview");
    expect(source).toContain("canApprove");
    expect(source).toContain("canProcess");

    // Must NOT contain a client-side direct "mark paid" button without reference validation
    expect(source).not.toContain('button>Mark Paid</button>');
    expect(source).not.toMatch(/onClick\s*=\s*\{[^}]*status\s*[:=]\s*["']PAID["']/);

    // Requires verified external payout reference
    expect(source).toContain("externalPayoutReference");
    expect(source).toContain("manual-bank:");
  });
});
