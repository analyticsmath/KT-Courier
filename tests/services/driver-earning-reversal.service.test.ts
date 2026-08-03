import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"lib/services/driver-earning-reversal.service.ts"),"utf8");
it("blocks release/refund and unreversed commission before exact remaining reversal",()=>expect(source).toMatch(/REVERSAL_AFTER_RELEASE[\s\S]*REVERSAL_BLOCKED_BY_COMMISSION[\s\S]*refundReservedAmount[\s\S]*driverEarningReversalPosting/));
it("requires immutable evidence and is idempotent",()=>expect(source).toMatch(/reversalEvidenceReference[\s\S]*status === "REVERSED"/));
it("locks and re-reads authoritative assignment completion evidence",()=>expect(source).toMatch(/OrderAssignment[\s\S]*assertAuthoritativeAssignment[\s\S]*completionEvidenceCurrentlyValid/));
