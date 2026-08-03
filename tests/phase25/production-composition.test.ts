import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolvePromoterProductionComposition } from "@/lib/promoters/composition-root";
import { PROMOTERS_PRODUCTION_BLOCK_REASON, PROMOTERS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/promoters/production-readiness";

describe("Phase 25 production composition", () => {
  it("constructs a complete locked composition with concrete authorities", () => {
    const composition = resolvePromoterProductionComposition();
    expect(PROMOTERS_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(composition).toMatchObject({ status: "LOCKED", code: PROMOTERS_PRODUCTION_BLOCK_REASON });
    expect(composition.repositories).toMatchObject({ account: expect.any(Object), qualification: expect.any(Object), earning: expect.any(Object), operation: expect.any(Object) });
    expect(composition.qualification).toMatchObject({ courierOrder: expect.any(Function), marketplaceOrder: expect.any(Function), storeSettlement: expect.any(Function) });
    expect(composition.finance).toMatchObject({ accrueCommissionInTransaction: expect.any(Function), ensureLedgerAccount: expect.any(Function), ensureWalletForOwner: expect.any(Function), requestWithdrawal: expect.any(Function) });
    expect(composition.services).toMatchObject({ lifecycle: expect.any(Object), qualificationEarning: expect.any(Object), fraud: expect.any(Object), reconciliation: expect.any(Object) });
    expect(composition.outbox).toMatchObject({ append: expect.any(Function) });
  });
  it("uses the required dependency order before readiness assertion", () => {
    const source = readFileSync("lib/promoters/composition-root.ts", "utf8");
    const repositories = source.indexOf("createPrismaPromoterRepositories");
    const services = source.indexOf("const services");
    const readiness = source.lastIndexOf("assertPromotersProductionReady();");
    expect(repositories).toBeGreaterThan(-1);
    expect(services).toBeGreaterThan(repositories);
    expect(readiness).toBeGreaterThan(services);
  });
  it("does not hide fake repositories, fake finance, memory outbox, or no-op transactions", () => {
    const source = readFileSync("lib/promoters/composition-root.ts", "utf8");
    expect(source).not.toMatch(/mock|fake|inMemory|noop|no-op/i);
    expect(source).toMatch(/createPrismaPromoterRepositories/);
    expect(source).toMatch(/PrismaPromoterOutbox/);
    expect(source).toMatch(/accrueCommissionInTransaction/);
    expect(source).toMatch(/createWithdrawalRequest/);
  });
});
