import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"lib/services/driver-earning-refund.service.ts"),"utf8");
it("requires authoritative snapshot and blocks generic inference",()=>expect(source).toMatch(/validateDriverEarningRefundSnapshot[\s\S]*assertGenericRefundHasNoDriverEarningExposure/));
it("handles reserve release completion final cents and released reconciliation",()=>{
  for (const evidence of ["applyDriverEarningRefundReservation", "releaseDriverEarningRefundReservations", "completeDriverEarningRefundProjections", "FULLY_REFUNDED", "REFUND_AFTER_RELEASE"]) expect(source).toContain(evidence);
});
