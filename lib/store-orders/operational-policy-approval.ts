import { assertStoreOrder } from "@/lib/store-orders/errors";

/** The same identity must not approve and activate a live vendor policy. */
export function assertDistinctStoreOrderPolicyActivator(
  approvedByUserId: string | null | undefined,
  activatedByUserId: string | null | undefined,
): void {
  assertStoreOrder(
    Boolean(approvedByUserId && activatedByUserId && approvedByUserId !== activatedByUserId),
    "STORE_ORDER_POLICY_APPROVAL_SEPARATION",
    "A different authorized administrator must activate the approved store-order policy.",
  );
}
