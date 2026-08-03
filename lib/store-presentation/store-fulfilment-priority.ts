/**
 * Presentation-only ordering for the store fulfilment bench.
 *
 * `listStoreOrderQueue` has already applied its canonical server ordering within
 * every section. This module only makes the section precedence explicit for UI
 * composition; it never derives urgency or changes an operational state.
 */
export type StoreFulfilmentQueueRow = Readonly<{
  publicReference: string;
  acceptanceStatus: string;
  preparationStatus: string;
  resolutionStatus: string;
  deliveryBridgeStatus: string;
  reviewDeadlineAt: Date | null;
  createdAt: Date;
}>;

export const STORE_FULFILMENT_SECTIONS = [
  ["customerActionRequired", "Needs attention"],
  ["needsReview", "Needs review"],
  ["preparing", "In preparation"],
  ["accepted", "Accepted"],
  ["readyForPickup", "Ready for collection"],
  ["handoffInProgress", "Collection in progress"],
  ["reconciliationRequired", "Requires reconciliation"],
  ["rejectedOrCancelled", "Closed or cancelled"],
  ["completedHandoff", "Collected"],
] as const;

export type StoreFulfilmentSectionKey = (typeof STORE_FULFILMENT_SECTIONS)[number][0];
export type StoreFulfilmentQueue = Readonly<Record<StoreFulfilmentSectionKey, readonly StoreFulfilmentQueueRow[]>>;

export function getStoreFulfilmentSummary(queue: StoreFulfilmentQueue) {
  return Object.freeze({
    needsAttention: queue.customerActionRequired.length + queue.reconciliationRequired.length + queue.needsReview.length,
    needsPreparation: queue.accepted.length + queue.preparing.length,
    readyForCollection: queue.readyForPickup.length,
  });
}

export function getPrioritisedStoreFulfilmentRows(queue: StoreFulfilmentQueue, limit?: number) {
  const rows = STORE_FULFILMENT_SECTIONS.flatMap(([key]) => queue[key]);
  return Object.freeze(limit === undefined ? rows : rows.slice(0, limit));
}
