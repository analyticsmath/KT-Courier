import { afterAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { paymentPrisma } from "./payment-fixtures";
afterAll(async () => paymentPrisma.$disconnect());
describe("Payfast confirmation cross-module invariants", () => {
  it("has no confirmation writer for order, dispatch, driver, pricing, refund or withdrawal", async () => {
    const source = await readFile("lib/services/payfast-itn-application.service.ts", "utf8");
    expect(source).not.toMatch(/\b(?:order|orderAssignment|driverProfile|pricingQuote|paymentRefund|withdrawalRequest)\.(?:create|update|updateMany|upsert|delete)/);
  });
  it("keeps one receipt journal per payment and structural links coherent", async () => {
    const duplicates = await paymentPrisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM (SELECT "correlationId" FROM "LedgerJournal" WHERE "type"::text = 'EXTERNAL_PAYMENT_RECEIPT' GROUP BY "correlationId" HAVING COUNT(*) > 1) d`;
    expect(duplicates[0]?.count ?? 0).toBe(0);
  });
  it("scaffolds an idempotent stale-attempt scanner with no success, ledger, or order authority", async () => {
    const source = await readFile("scripts/scan-payment-reconciliation.mjs", "utf8");
    expect(source).toContain("STALE_PROCESSING_ATTEMPT"); expect(source).toContain("observationCount");
    expect(source).not.toMatch(/data:\s*\{[^}]*status:\s*["']SUCCEEDED|ledgerJournal\.(?:create|update)|order\.(?:create|update)/);
  });
});
