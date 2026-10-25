import { describe, expect, it } from "vitest";
import { operationalWorkflowStatus, reconciliationReason } from "@/lib/commerce-admin-presentation/store-order-reconciliation";

describe("small-screen store order reconciliation presentation",()=>{
 it("renders explicit labels for each independent operational dimension",()=>{
  expect(operationalWorkflowStatus({status:"SETTLED",acceptanceStatus:"PENDING_STORE_REVIEW",preparationStatus:"NOT_STARTED",deliveryBridgeStatus:"NOT_REQUESTED"})).toEqual([
   {label:"Order",value:"Settled"},{label:"Store acceptance",value:"Awaiting store review"},
   {label:"Preparation",value:"Not started"},{label:"Driver handoff",value:"Not requested"},
  ]);
 });
 it("does not misrepresent unknown internal workflow codes as real states",()=>{
  expect(operationalWorkflowStatus({status:"BOGUS",acceptanceStatus:"BOGUS",preparationStatus:"BOGUS",deliveryBridgeStatus:"BOGUS"}).every(x=>x.value==="Status unavailable")).toBe(true);
 });
 it("uses a readable reason while preserving the machine code separately",()=>{
  expect(reconciliationReason("ADMIN_CANONICAL_RESCAN")).toBe("Administrator-requested reconciliation rescan");
  expect(reconciliationReason("UNEXPECTED_INTERNAL_STATE")).toBe("Unclassified discrepancy");
 });
});
