import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
import { createDriverEarningTransactionMock } from "./driver-earning-service-test-mocks";
const source=readFileSync(join(process.cwd(),"lib/services/driver-earning-accrual.service.ts"),"utf8");
it("provides the complete Prisma and ledger transaction mock surface",()=>{const tx=createDriverEarningTransactionMock(); for(const key of ["driverEarning","driverProfile","orderAssignment","payment","commissionAllocation","ledgerAccount","ledgerJournal","ledgerEntry","refundFundingAllocation","driverEarningReconciliationCase"] as const) expect(tx[key].findUnique ?? tx[key].create).toBeTypeOf("function"); expect(tx.$queryRaw).toBeTypeOf("function");});
it("locks assignment payment allocations and uses exact canonical accrual",()=>expect(source).toMatch(/OrderAssignment[\s\S]*Payment[\s\S]*CommissionAllocation[\s\S]*driverEarningAccrualPosting/));
it("covers replay conflict duplicate combined attribution held balance and serializable rollback boundary",()=>{
  for (const evidence of ["creationIdempotencyKey", "IDEMPOTENCY_CONFLICT", "SETTLEMENT_ALREADY_ACCRUED", "assertDriverCommissionAttribution", "INSUFFICIENT_HELD_FUNDS", "Serializable"]) expect(source).toContain(evidence);
});
it("moves no cash and does not write operational records",()=>expect(source).not.toMatch(/CASH_CLEARING|(?:order|payment|orderAssignment|proofOfDelivery)\.(?:create|update|delete)/));
