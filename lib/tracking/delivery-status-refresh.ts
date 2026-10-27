/** Browser visibility limits polling; a terminal order needs no continuous refresh. */
export function shouldRefreshParcelStatus(status: string): boolean {
  return !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status);
}

/** A failed attempt can still be rescheduled; a cancelled parent cannot.
 * Stop polling terminal marketplace orders even when a store delivery bridge
 * remains in a non-terminal state after cancellation. */
export function shouldRefreshMarketplaceStatus(storeDeliveryStatuses: readonly string[], marketplaceStatus?: string): boolean {
  if (marketplaceStatus === "CANCELLED") return false;
  return storeDeliveryStatuses.length === 0 || storeDeliveryStatuses.some((status) => status !== "DELIVERED");
}
