import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("Phase B Payment subject database integrity contract", () => {
  it("keeps application policy and the forward PostgreSQL guard aligned for every supported subject", () => {
    const policy = read("lib/payments/payment-subject-policy.ts");
    const migration = read("prisma/migrations/20260814100000_phase_b_payment_subject_integrity_reconciliation/migration.sql");
    for (const subject of ["COURIER_ORDER", "MARKETPLACE_CHECKOUT", "SUBSCRIPTION_INVOICE", "MANAGED_MARKETING_REQUEST"]) {
      expect(policy).toContain(subject);
      expect(migration).toContain(subject);
    }
    expect(migration).toMatch(/managedMarketingRequestId" IS NOT NULL/);
    expect(migration).toMatch(/managed_marketing_requester_id IS DISTINCT FROM NEW\."userId"/);
    expect(migration).toMatch(/marketplaceOrderId" IS NOT NULL/);
    expect(migration).toMatch(/Payment_subject_shape_check/);
  });
});
