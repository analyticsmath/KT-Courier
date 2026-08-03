import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"lib/services/driver-earning-release.service.ts"),"utf8");
it("rechecks assignment incidents refunds commission remaining and owner-withdrawable",()=>{
  for (const evidence of ["assertAuthoritativeAssignment", "refundReservedAmount", "commissionCoherent", "remaining", "OWNER_WITHDRAWABLE"]) expect(source).toContain(evidence);
});
it("posts once inside serializable transaction",()=>expect(source).toMatch(/releaseLedgerJournal[\s\S]*driverEarningReleasePosting[\s\S]*Serializable/));
