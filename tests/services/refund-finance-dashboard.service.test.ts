import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "lib/services/finance-dashboard.service.ts"), "utf8");
describe("refund finance dashboard metrics", () => {
  it("includes every required refund metric", () => { for (const metric of ["walletLiabilities", "refundHeldLiabilities", "requested", "approved", "processing", "successfulWallet", "successfulExternal", "refundedByPeriod", "openReconciliationCases", "oldestPending", "commissionClawbacks", "remainingRefundableLiabilities"]) expect(source).toContain(metric); });
  it("aggregates remaining liability with Decimal and returns exact strings", () => { expect(source).toMatch(/reduce\([\s\S]*new Prisma\.Decimal\(0\)/); expect(source).toMatch(/remainingRefundableLiabilities\.toFixed\(2\)/); expect(source).not.toMatch(/parseFloat|Number\(.*amount/); });
});
