import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";

const stages: Readonly<Record<string,string>>={
 NOT_STARTED:"Not started",NOT_REQUESTED:"Not requested",PENDING_STORE_REVIEW:"Awaiting store review",
 PREPARING:"Preparing",ACCEPTED:"Accepted",READY_FOR_PICKUP:"Ready for pickup",
 REQUESTED:"Requested",BRIDGED:"Delivery created",DELIVERED:"Delivered",
};
type Workflow={status:string;acceptanceStatus:string;preparationStatus:string;deliveryBridgeStatus:string};
function knownStatus(code:string){const primary=presentCommerceStatus(code).label;return primary!=="Status unavailable"?primary:stages[code]??"Status unavailable";}
/** Four separate authoritative dimensions, not a concatenated set of database codes. */
export function operationalWorkflowStatus(state:Workflow){return [
 {label:"Order",value:knownStatus(state.status)},
 {label:"Store acceptance",value:knownStatus(state.acceptanceStatus)},
 {label:"Preparation",value:knownStatus(state.preparationStatus)},
 {label:"Driver handoff",value:knownStatus(state.deliveryBridgeStatus)},
];}
const reasons:Readonly<Record<string,string>>={
 ADMIN_CANONICAL_RESCAN:"Administrator-requested reconciliation rescan",
};
export function reconciliationReason(code:string){return reasons[code]??"Unclassified discrepancy";}
